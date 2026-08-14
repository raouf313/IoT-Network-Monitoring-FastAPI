"""
services/tech_service.py — Logique métier liée aux techniciens.
Auto-assignation, scoring IA, redistribution, scheduler helpers.
"""
import re
import json
from config.database import get_db
from services.lmstudio_service import chat_completion, build_ai_assign_messages

# ── Géographie ──────────────────────────────────────────────────────────────
LOCALISATION_ZONE = {
    'tunis': 'nord', 'ariana': 'nord', 'ben arous': 'nord',
    'manouba': 'nord', 'bizerte': 'nord', 'nabeul': 'nord', 'zaghouan': 'nord',
    'jendouba': 'nord-ouest', 'ghardimaou': 'nord-ouest', 'ain draham': 'nord-ouest',
    'beja': 'nord-ouest', 'kef': 'nord-ouest', 'siliana': 'nord-ouest',
    'sousse': 'centre', 'monastir': 'centre', 'mahdia': 'centre',
    'kairouan': 'centre', 'kasserine': 'centre', 'sidi bouzid': 'centre',
    'sfax': 'sud', 'gabes': 'sud', 'mednine': 'sud',
    'tataouine': 'sud', 'gafsa': 'sud', 'tozeur': 'sud', 'kebili': 'sud',
}

SPECIALITE_MOTS = {
    'réseau':        ['réseau', 'fibre', 'adsl', 'backbone', 'routeur', 'commutateur', 'câblage'],
    'électricité':   ['électrique', 'électrogen', 'électricité', 'courant', 'tension'],
    'informatique':  ['firmware', 'logiciel', 'informatique', 'serveur', 'système', 'software'],
    'climatisation': ['refroidissement', 'climatisation', 'température', 'hvac', 'cooling', 'critique'],
}


def get_zone(localisation: str) -> str:
    loc = (localisation or '').lower()
    for key, zone in LOCALISATION_ZONE.items():
        if key in loc:
            return zone
    return 'inconnu'


def get_tech_zone(tech_id: int, db=None) -> str:
    close_db = db is None
    if close_db:
        db = get_db()
    try:
        cur = db.cursor(dictionary=True)
        cur.execute(
            "SELECT localisation FROM missions WHERE technicien_id=%s AND statut='terminee' "
            "ORDER BY date_fin DESC LIMIT 10", (tech_id,)
        )
        rows = cur.fetchall()
        cur.close()
        zones = [get_zone(r['localisation']) for r in rows if r['localisation']]
        return max(set(zones), key=zones.count) if zones else 'inconnu'
    finally:
        if close_db:
            db.close()


def _score_specialite(specialite: str, description: str) -> int:
    sp = (specialite or '').lower()
    mots = SPECIALITE_MOTS.get(sp, [])
    desc = (description or '').lower()
    return sum(1 for mot in mots if mot in desc)


def _pre_filter_candidates(tech: dict, candidates: list) -> list:
    PRIO_RANK = {'critique': 0, 'eleve': 1, 'moyen': 2, 'faible': 3}
    sp = (tech.get('specialite') or '').lower()
    mots = SPECIALITE_MOTS.get(sp, [])

    if mots:
        scored = [
            (m, _score_specialite(tech.get('specialite', ''), m.get('description', '')))
            for m in candidates
        ]
        matching = [(m, sc) for m, sc in scored if sc > 0]
        if matching:
            matching.sort(key=lambda x: (-x[1], PRIO_RANK.get(x[0].get('priorite', 'moyen'), 2)))
            print(f"[PRE-FILTER] {tech.get('nom')} ({sp}): {len(matching)}/{len(candidates)} mission(s) matchen specialty")
            return [m for m, _ in matching]

    candidates_sorted = sorted(candidates, key=lambda m: PRIO_RANK.get(m.get('priorite', 'moyen'), 2))
    print(f"[PRE-FILTER] {tech.get('nom')} ({sp}): fallback sur toutes les missions dispo")
    return candidates_sorted

def fix_disponible_state():
    """
    Synchronise la disponibilité des techniciens selon l'état réel du terrain.
    Un technicien redevient disponible (1) automatiquement s'il n'a pas de mission active acceptée/en cours.
    """
    db = get_db()
    try:
        cur = db.cursor()
        
        # 1. On bloque (0) UNIQUEMENT si le technicien est déjà sur le terrain (acceptée ou en cours)
        cur.execute("""
            UPDATE utilisateurs u SET u.disponible = 0
            WHERE u.role = 'technicien'
              AND EXISTS (
                  SELECT 1 FROM missions m 
                  WHERE m.technicien_id = u.id
                    AND m.statut IN ('acceptee', 'en_cours')
              )
        """)
        
        # 2. On libère (1) si aucune mission n'est réellement active sur son compte
        cur.execute("""
            UPDATE utilisateurs u SET u.disponible = 1
            WHERE u.role = 'technicien'
              AND NOT EXISTS (
                  SELECT 1 FROM missions m 
                  WHERE m.technicien_id = u.id
                    AND m.statut IN ('acceptee', 'en_cours')
              )
        """)
        
        db.commit()
        cur.close()
        print("[fix_disponible] 🔄 États de disponibilité synchronisés avec succès.")
    except Exception as e:
        print(f"[fix_disponible] ⚠️ Erreur synchro : {e}")
    finally:
        db.close()

def _ai_pick_best_mission(tech: dict, candidates: list) -> tuple:
    tech_zone = tech.get("zone", "inconnu")
    missions_info = "\n".join([
        f"- ID:{m['id']} | {m['description'][:80]} | "
        f"Localisation:{m.get('localisation','?')} (Zone:{get_zone(m.get('localisation',''))}) | "
        f"Priorité:{m.get('priorite','moyen')}"
        for m in candidates
    ])
    
    prompt = (
        f"Choose the best mission from the list for this technician:\n"
        f"TECHNICIAN: Name:{tech.get('nom')} | Specialty:{tech.get('specialite','N/A')} | Zone:{tech_zone}\n"
        f"AVAILABLE MISSIONS:\n{missions_info}\n\n"
        f"You must respond with ONLY a single line JSON matching this example exactly:\n"
        f'{{"mission_id": 12, "priorite_suggeree": "moyen", "raison": "Matches specialty and zone"}}\n'
        f"Return the JSON for the best mission now:"
    )
    try:
        raw = chat_completion(build_ai_assign_messages(prompt), max_tokens=250, temperature=0.1, timeout=8)
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            clean_json = match.group().strip()
            result = json.loads(clean_json)
            result = {k.strip(): v for k, v in result.items()}
            
            mid = result.get("mission_id")
            if mid is not None:
                mid = int(mid)
                if mid in [m["id"] for m in candidates]:
                    return mid, result.get("priorite_suggeree"), result.get("raison", "AI assignment")
    except Exception as e:
        print(f"[AI-ASSIGN] ⚠️ Erreur modèle ({e}), fallback scoring local")

    # Fallback local
    sp    = (tech.get('specialite') or '').lower()
    mots  = SPECIALITE_MOTS.get(sp, [])
    tech_zone = tech.get("zone", "inconnu")
    best_m, best_sc = None, -1
    for m in candidates:
        desc   = (m.get('description') or '').lower()
        sp_sc  = sum(1 for mot in mots if mot in desc)
        geo_sc = 2 if get_zone(m.get('localisation', '')) == tech_zone else 0
        if sp_sc + geo_sc > best_sc:
            best_sc = sp_sc + geo_sc
            best_m  = m
    chosen = best_m or candidates[0]
    return chosen["id"], chosen.get("priorite"), f"Fallback scoring local (score={best_sc})"


def auto_assign_mission(technicien_id: int, db=None) -> list:
    close_db = db is None
    if close_db:
        db = get_db()
    assigned = []
    try:
        cur = db.cursor(dictionary=True)

        # 1. Vérif disponibilité
        cur.execute("SELECT disponible, nom, specialite FROM utilisateurs WHERE id=%s", (technicien_id,))
        tech = cur.fetchone()
        if not tech or not tech["disponible"]:
            cur.close()
            return assigned

        # 1b. Pas de mission active
        cur.execute(
            "SELECT COUNT(*) v FROM missions WHERE technicien_id=%s "
            "AND statut IN ('en_attente','acceptee','en_cours')", (technicien_id,)
        )
        if cur.fetchone()["v"] > 0:
            cur.close()
            return assigned

        # 2. Get missions libres
        cur.execute(
            "SELECT id, description, localisation, priorite, statut FROM missions "
            "WHERE technicien_id IS NULL "
            "ORDER BY FIELD(priorite,'critique','eleve','moyen','faible'), date_creation ASC LIMIT 10"
        )
        candidates = cur.fetchall()
        cur.close()

        if not candidates:
            return assigned

        # 3. Pré-filtre spécialité
        tech["zone"]    = get_tech_zone(technicien_id, db)
        tech["actives"] = 0
        filtered = _pre_filter_candidates(tech, candidates)

        # 4. Choix IA 
        mission_id, prio_suggeree, raison_ai = _ai_pick_best_mission(tech, filtered)

        # 5. Lock optimiste FOR UPDATE
        cur2 = db.cursor(dictionary=True)
        cur2.execute("SELECT id, technicien_id, statut FROM missions WHERE id=%s FOR UPDATE", (mission_id,))
        row = cur2.fetchone()
        
        if not row or row["technicien_id"] is not None:
            db.rollback(); cur2.close()
            return assigned

        # Update s7i7
        cur2.execute(
            "UPDATE missions SET technicien_id=%s, statut='en_attente' WHERE id=%s",
            (technicien_id, mission_id)
        )
        
        best_mission = next(m for m in candidates if m["id"] == mission_id)
        PRIOS = {'critique', 'eleve', 'moyen', 'faible'}
        if prio_suggeree in PRIOS and prio_suggeree != best_mission.get("priorite"):
            cur2.execute("UPDATE missions SET priorite=%s WHERE id=%s", (prio_suggeree, mission_id))

        cur2.execute(
            "INSERT INTO alertes (type, message, severite) VALUES ('info', %s, 'info')",
            (f"✅ Mission #{mission_id} assignée à {tech['nom']} — {raison_ai}",)
        )
        db.commit(); cur2.close()
        
        best_mission["statut"] = 'en_attente'
        best_mission["technicien_id"] = technicien_id
        assigned.append(best_mission)
        print(f"[AI-ASSIGN] ✅ Mission#{mission_id} ➔ {tech['nom']} | {raison_ai}")

    except Exception as e:
        try: db.rollback()
        except: pass
        print(f"[auto_assign_mission] ⚠️ Erreur tech#{technicien_id}: {e}")
    finally:
        if close_db:
            db.close()
    return assigned


def auto_assign_all_available() -> int:
    db = get_db()
    total = 0
    try:
        cur = db.cursor(dictionary=True)
        cur.execute("""
            SELECT u.id FROM utilisateurs u
            WHERE u.role='technicien' AND u.disponible=1
              AND (SELECT COUNT(*) FROM missions m WHERE m.technicien_id=u.id
                   AND m.statut IN ('en_attente','acceptee','en_cours')) = 0
        """)
        techs = cur.fetchall(); cur.close()
        for t in techs:
            result = auto_assign_mission(t["id"], db)
            total += len(result)
    finally:
        db.close()
    return total


def redistribute_missions_of_unavailable_tech(tech_id: int):
    db = get_db()
    try:
        cur = db.cursor(dictionary=True)
        cur.execute(
            "SELECT id FROM missions WHERE technicien_id=%s AND statut IN ('en_attente','acceptee','en_cours')",
            (tech_id,)
        )
        missions = cur.fetchall(); cur.close()
        for m in missions:
            cur2 = db.cursor()
            cur2.execute(
                "UPDATE missions SET technicien_id=NULL, statut='en_attente' WHERE id=%s", (m["id"],)
            )
            db.commit(); cur2.close()
        auto_assign_all_available()
    finally:
        db.close()


def check_missions_bloquees():
    db = get_db()
    try:
        cur = db.cursor(dictionary=True)
        cur.execute("""
            SELECT id, description, priorite FROM missions
            WHERE statut='en_attente' AND technicien_id IS NULL
              AND TIMESTAMPDIFF(HOUR, date_creation, NOW()) >= 2
              AND id NOT IN (
                SELECT DISTINCT CAST(REGEXP_SUBSTR(message,'#[0-9]+') AS UNSIGNED)
                FROM alertes WHERE type='mission_bloquee' AND created_at >= NOW() - INTERVAL 2 HOUR
              )
        """)
        missions = cur.fetchall(); cur.close()
        if missions:
            cur2 = db.cursor()
            for m in missions:
                msg = f"⏰ Mission #{m['id']} ({m['priorite'].upper()}) sans technicien depuis 2h+"
                cur2.execute(
                    "INSERT INTO alertes (type, message, severite) VALUES ('mission_bloquee', %s, 'critique')",
                    (msg,)
                )
            db.commit(); cur2.close()
    finally:
        db.close()