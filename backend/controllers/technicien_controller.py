"""
controllers/technicien_controller.py
"""
from datetime import datetime, timedelta
import mysql.connector
from fastapi import HTTPException
from config.database import get_db
from models.schemas import TechnicienCreate, TechnicienUpdate
from services.tech_service import auto_assign_mission, redistribute_missions_of_unavailable_tech

def get_techniciens() -> dict:
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("""SELECT id FROM utilisateurs WHERE role='technicien' AND disponible=0
        AND retour_disponible IS NOT NULL AND retour_disponible <= NOW()""")
    revenus = [r['id'] for r in cur.fetchall()]
    if revenus:
        cur.execute("""UPDATE utilisateurs SET disponible=1, retour_disponible=NULL, duree_retour_minutes=NULL
            WHERE role='technicien' AND disponible=0 AND retour_disponible IS NOT NULL AND retour_disponible <= NOW()""")
        db.commit()
        for tid in revenus:
            try: auto_assign_mission(tid)
            except: pass
    cur.execute("""SELECT u.id,u.nom,u.email,u.disponible,u.telephone,u.specialite,u.created_at,
               u.retour_disponible, u.duree_retour_minutes,
               COUNT(CASE WHEN m.statut IN ('en_cours','acceptee') THEN 1 END) missions_en_cours,
               COUNT(CASE WHEN m.statut='terminee' THEN 1 END) missions_terminees,
               COUNT(CASE WHEN m.statut IN ('en_attente','acceptee','en_cours') THEN 1 END) missions_actives
        FROM utilisateurs u LEFT JOIN missions m ON m.technicien_id=u.id
        WHERE u.role='technicien' GROUP BY u.id""")
    rows = cur.fetchall(); cur.close(); db.close()
    for r in rows:
        r['created_at'] = r['created_at'].isoformat() if r['created_at'] else None
        r['retour_disponible'] = r['retour_disponible'].isoformat() if r.get('retour_disponible') else None
    return {'techniciens': rows}

def get_technicien(tid: int) -> dict:
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("""SELECT id FROM utilisateurs WHERE id=%s AND role='technicien' AND disponible=0
        AND retour_disponible IS NOT NULL AND retour_disponible <= NOW()""", (tid,))
    if cur.fetchone():
        cur.execute("UPDATE utilisateurs SET disponible=1, retour_disponible=NULL, duree_retour_minutes=NULL WHERE id=%s", (tid,))
        db.commit()
        try: auto_assign_mission(tid)
        except: pass
    cur.execute("""SELECT id,nom,email,disponible,telephone,specialite,retour_disponible,duree_retour_minutes
        FROM utilisateurs WHERE id=%s AND role='technicien'""", (tid,))
    row = cur.fetchone(); cur.close(); db.close()
    if not row: raise HTTPException(404, "Technicien introuvable")
    if row.get("retour_disponible"): row["retour_disponible"] = row["retour_disponible"].isoformat()
    return {"technicien": row}

def ajouter_technicien(data: TechnicienCreate) -> dict:
    db = get_db(); cur = db.cursor()
    try:
        cur.execute("INSERT INTO utilisateurs (nom,email,mot_de_passe,role,telephone,specialite) VALUES (%s,%s,%s,'technicien',%s,%s)",
            (data.nom, data.email, data.mot_de_passe, data.telephone, data.specialite))
        db.commit()
    except mysql.connector.IntegrityError:
        raise HTTPException(400, "Email déjà existant")
    finally: cur.close(); db.close()
    return {"status": "ok"}

def supprimer_technicien(tid: int) -> dict:
    db = get_db(); cur = db.cursor()
    cur.execute("UPDATE missions SET technicien_id=NULL WHERE technicien_id=%s AND statut!='terminee'", (tid,))
    cur.execute("DELETE FROM utilisateurs WHERE id=%s AND role='technicien'", (tid,))
    db.commit(); cur.close(); db.close()
    return {"status": "ok"}

def update_technicien(tid: int, data: TechnicienUpdate, add_background_task=None) -> dict:
    db = get_db(); cur = db.cursor()
    updates = []; values = []
    if data.disponible is not None and data.role_appelant == 'admin':
        updates.append("disponible=%s"); values.append(data.disponible)
        if not data.disponible:
            retour_dt = None
            if data.retour_disponible:
                try:
                    s = data.retour_disponible.replace('T',' ')
                    if len(s) == 16: s += ':00'
                    retour_dt = datetime.fromisoformat(s)
                except: pass
            if retour_dt is None and data.duree_retour_minutes:
                retour_dt = datetime.now() + timedelta(minutes=data.duree_retour_minutes)
            if retour_dt:
                duree_min = max(1, int((retour_dt - datetime.now()).total_seconds() / 60))
                updates += ["retour_disponible=%s", "duree_retour_minutes=%s"]
                values  += [retour_dt, duree_min]
            else:
                updates += ["retour_disponible=NULL", "duree_retour_minutes=NULL"]
        else:
            updates += ["retour_disponible=NULL", "duree_retour_minutes=NULL"]
    if data.telephone is not None: updates.append("telephone=%s");  values.append(data.telephone)
    if data.specialite is not None: updates.append("specialite=%s"); values.append(data.specialite)
    if updates:
        values.append(tid)
        cur.execute(f"UPDATE utilisateurs SET {','.join(updates)} WHERE id=%s", values)
        db.commit()
    cur.close(); db.close()
    if data.disponible and data.role_appelant == 'admin':
        auto_assign_mission(tid)
    elif data.disponible is False and data.role_appelant == 'admin' and add_background_task:
        add_background_task(redistribute_missions_of_unavailable_tech, tid)
    return {"status": "ok"}

def technicien_set_indisponible(tid: int, add_background_task=None) -> dict:
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("SELECT nom FROM utilisateurs WHERE id=%s AND role='technicien'", (tid,))
    tech = cur.fetchone()
    if not tech: cur.close(); db.close(); raise HTTPException(404, "Technicien introuvable")
    cur2 = db.cursor()
    cur2.execute("UPDATE utilisateurs SET disponible=0 WHERE id=%s", (tid,))
    cur2.execute("INSERT INTO alertes (type,message,severite) VALUES ('disponibilite',%s,'warning')",
        (f"🔴 {tech['nom']} s'est marqué indisponible",))
    db.commit(); cur.close(); cur2.close(); db.close()
    if add_background_task:
        add_background_task(redistribute_missions_of_unavailable_tech, tid)
    return {"status": "ok"}
