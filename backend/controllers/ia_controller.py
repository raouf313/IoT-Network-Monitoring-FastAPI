"""
controllers/ia_controller.py — Logique métier IA.
Orchestre les appels à lmstudio_service et exécute les actions du chatbot.
"""
import json
import re
from fastapi import HTTPException
from models.schemas import AIRequest, ChatbotRequest
from config.database import get_db
from services.lmstudio_service import (
    chat_completion,
    build_analyse_panne_messages,
    build_chatbot_messages,
)


# ── Analyse de panne ────────────────────────────────────────────────────────
def analyser_panne(req: AIRequest) -> dict:
    try:
        messages = build_analyse_panne_messages(req.type_panne, req.description, req.valeur)
        analyse = chat_completion(messages, max_tokens=500)
        db = get_db(); cur = db.cursor()
        from config.settings import settings
        cur.execute(
            "INSERT INTO analyses_ia (panne_id, resultat, modele) VALUES (%s, %s, %s)",
            (req.panne_id, analyse, settings.LM_STUDIO_MODEL)
        )
        db.commit(); cur.close(); db.close()
        return {"analyse": analyse, "status": "ok"}
    except Exception as e:
        return {"analyse": f"Erreur IA: {str(e)}", "status": "error"}


# ── Chatbot ─────────────────────────────────────────────────────────────────
def chatbot(req: ChatbotRequest) -> dict:
    try:
        context = _get_db_context()
        system_prompt = _build_system_prompt(context, req.user_role)
        messages = build_chatbot_messages(system_prompt, req.historique, req.message)
        ai_response = chat_completion(messages, max_tokens=800, temperature=0.4)

        final_response = ai_response
        action_result  = None

        if "ACTION:" in ai_response:
            idx       = ai_response.find("ACTION:")
            text_part = ai_response[:idx].strip()
            after     = ai_response[idx + len("ACTION:"):].strip()
            json_str  = _extract_json(after)
            if json_str:
                try:
                    action_data  = json.loads(json_str)
                    action_result = _execute_chatbot_action(action_data)
                    final_response = (text_part + "\n\n" + action_result) if text_part else action_result
                except Exception as e:
                    final_response = (text_part or ai_response) + f"\n\n⚠️ (Action non exécutée : {e})"
            else:
                final_response = text_part if text_part else ai_response

        return {"reponse": final_response, "action_executee": action_result is not None, "status": "ok"}
    except Exception as e:
        return {"reponse": f"❌ **Erreur LM Studio :** {e}\n\nVérifiez que LM Studio tourne sur http://localhost:1234", "status": "error", "action_executee": False}


# ── Helpers privés ──────────────────────────────────────────────────────────
def _extract_json(text: str) -> str | None:
    start = text.find('{')
    if start < 0:
        return None
    depth = 0; in_str = False; esc = False
    for i in range(start, len(text)):
        c = text[i]
        if esc:       esc = False; continue
        if c == '\\': esc = True;  continue
        if c == '"':  in_str = not in_str; continue
        if in_str:    continue
        if c == '{':  depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return text[start:i+1]
    return None


def _json_safe(obj):
    import decimal, datetime
    if isinstance(obj, decimal.Decimal): return float(obj)
    if isinstance(obj, (datetime.date, datetime.datetime)): return obj.isoformat()
    if isinstance(obj, dict): return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)): return [_json_safe(i) for i in obj]
    return obj


def _get_db_context() -> dict:
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("""
        SELECT u.id, u.nom, u.specialite, u.disponible,
               COUNT(CASE WHEN m.statut IN ('en_cours','acceptee','en_attente') THEN 1 END) missions_actives
        FROM utilisateurs u LEFT JOIN missions m ON m.technicien_id=u.id
        WHERE u.role='technicien' GROUP BY u.id
    """); techniciens = cur.fetchall()
    cur.execute("SELECT * FROM pannes WHERE statut='ouverte' ORDER BY date_detection DESC LIMIT 10")
    pannes_ouvertes = cur.fetchall()
    cur.execute("SELECT m.*, u.nom technicien_nom FROM missions m LEFT JOIN utilisateurs u ON m.technicien_id=u.id ORDER BY m.date_creation DESC LIMIT 20")
    missions = cur.fetchall()
    cur.execute("SELECT r.id, r.titre, r.statut, u.nom technicien_nom FROM rapports r LEFT JOIN utilisateurs u ON r.technicien_id=u.id ORDER BY r.date_creation DESC LIMIT 10")
    rapports_recents = cur.fetchall()
    cur.execute("SELECT COUNT(*) v FROM alertes WHERE lue=0");  alertes_non_lues = cur.fetchone()["v"]
    cur.execute("SELECT COUNT(*) v FROM rapports WHERE statut='soumis'"); rapports_en_attente = cur.fetchone()["v"]
    cur.execute("SELECT COUNT(*) v FROM missions WHERE statut='en_attente' AND technicien_id IS NULL"); missions_non_assignees = cur.fetchone()["v"]
    cur.execute("SELECT COUNT(*) v FROM missions WHERE statut='terminee'"); missions_terminees = cur.fetchone()["v"]
    cur.execute("SELECT COUNT(*) v FROM missions WHERE statut IN ('en_cours','acceptee','en_attente')"); missions_actives = cur.fetchone()["v"]
    cur.close(); db.close()
    return {
        "techniciens": _json_safe(techniciens),
        "pannes_ouvertes": _json_safe(pannes_ouvertes),
        "missions": _json_safe(missions),
        "rapports_recents": _json_safe(rapports_recents),
        "alertes_non_lues": alertes_non_lues,
        "rapports_en_attente": rapports_en_attente,
        "missions_non_assignees": missions_non_assignees,
        "missions_terminees": missions_terminees,
        "missions_actives": missions_actives,
    }


def _build_system_prompt(ctx: dict, user_role: str) -> str:
    return f"""Tu es l'assistant intelligent de Tunisie Telecom Workflow Automation.
Tu as accès en temps réel à la base de données et tu PEUX effectuer des actions concrètes.

DONNÉES ACTUELLES DE LA BD :
- Techniciens : {json.dumps(ctx['techniciens'], ensure_ascii=False)}
- Pannes ouvertes : {json.dumps(ctx['pannes_ouvertes'], ensure_ascii=False)}
- Missions récentes : {json.dumps(ctx['missions'], ensure_ascii=False)}
- Alertes non lues : {ctx['alertes_non_lues']}
- Rapports en attente : {ctx['rapports_en_attente']}
- Missions non assignées : {ctx['missions_non_assignees']}
- Missions terminées : {ctx['missions_terminees']}

RÔLE UTILISATEUR : {user_role}

RÈGLES :
- disponible=false → NE PAS assigner de mission
- MAX 1 mission active par technicien
- Toujours répondre en français, de manière professionnelle

ACTIONS DISPONIBLES (retourner JSON après "ACTION:") :
- Ajouter technicien   : {{"action":"ajouter_technicien","params":{{"nom":"...","email":"...","mot_de_passe":"tech123","telephone":"...","specialite":"..."}}}}
- Modifier dispo       : {{"action":"modifier_disponibilite","params":{{"technicien_id":X,"disponible":true/false}}}}
- Créer mission        : {{"action":"creer_mission","params":{{"description":"...","localisation":"...","priorite":"...","technicien_id":X}}}}
- Créer panne          : {{"action":"creer_panne","params":{{"description":"...","type":"...","priorite":"..."}}}}
- Résoudre panne       : {{"action":"resoudre_panne","params":{{"panne_id":X}}}}
- Approuver rapport    : {{"action":"approuver_rapport","params":{{"rapport_id":X}}}}
- Rejeter rapport      : {{"action":"rejeter_rapport","params":{{"rapport_id":X}}}}
- Stats missions       : {{"action":"stats_missions","params":{{}}}}

FORMAT : question → réponse directe avec les chiffres BD. Action → explication + ACTION: {{json}}
"""


def _execute_chatbot_action(data: dict) -> str:
    action = data.get("action")
    params = data.get("params", {})
    db = get_db(); cur = db.cursor()
    try:
        if action == "ajouter_technicien":
            cur.execute(
                "INSERT INTO utilisateurs (nom,email,mot_de_passe,role,telephone,specialite) VALUES (%s,%s,%s,'technicien',%s,%s)",
                (params["nom"], params["email"], params.get("mot_de_passe","tech123"), params.get("telephone"), params.get("specialite"))
            )
            db.commit()
            return f"✅ Technicien **{params['nom']}** ajouté avec succès."

        elif action == "modifier_disponibilite":
            cur.execute("UPDATE utilisateurs SET disponible=%s WHERE id=%s", (params["disponible"], params["technicien_id"]))
            db.commit()
            etat = "disponible" if params["disponible"] else "indisponible"
            return f"✅ Technicien #{params['technicien_id']} marqué **{etat}**."

        elif action == "creer_mission":
            from services.tech_service import auto_assign_mission
            cur.execute(
                "INSERT INTO missions (description,localisation,priorite,technicien_id,statut) VALUES (%s,%s,%s,%s,'en_attente')",
                (params["description"], params.get("localisation","Non spécifié"), params.get("priorite","moyen"), params.get("technicien_id"))
            )
            db.commit()
            return f"✅ Mission créée : **{params['description'][:60]}**"

        elif action == "creer_panne":
            import random, string
            ticket = "TT-" + ''.join(random.choices(string.digits, k=6))
            cur.execute(
                "INSERT INTO pannes (description,type,priorite,numero_ticket,source) VALUES (%s,%s,%s,%s,'chatbot')",
                (params["description"], params.get("type","manuelle"), params.get("priorite","moyen"), ticket)
            )
            db.commit()
            return f"✅ Panne créée — Ticket **{ticket}**"

        elif action == "resoudre_panne":
            cur.execute("UPDATE pannes SET statut='resolue' WHERE id=%s", (params["panne_id"],))
            db.commit()
            return f"✅ Panne #{params['panne_id']} marquée **résolue**."

        elif action == "approuver_rapport":
            cur.execute("UPDATE rapports SET statut='approuve' WHERE id=%s", (params["rapport_id"],))
            db.commit()
            return f"✅ Rapport #{params['rapport_id']} **approuvé**."

        elif action == "rejeter_rapport":
            cur.execute("UPDATE rapports SET statut='rejete' WHERE id=%s", (params["rapport_id"],))
            db.commit()
            return f"✅ Rapport #{params['rapport_id']} **rejeté**."

        elif action == "stats_missions":
            cur2 = db.cursor(dictionary=True)
            cur2.execute("SELECT statut, COUNT(*) v FROM missions GROUP BY statut")
            rows = cur2.fetchall(); cur2.close()
            lines = [f"- {r['statut']}: **{r['v']}**" for r in rows]
            return "📊 Statistiques missions :\n" + "\n".join(lines)

        else:
            return f"⚠️ Action inconnue : `{action}`"
    except Exception as e:
        return f"❌ Erreur lors de l'action `{action}` : {e}"
    finally:
        cur.close(); db.close()
