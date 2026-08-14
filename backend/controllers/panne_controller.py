"""
controllers/panne_controller.py
"""
import random, string
from config.database import get_db
from models.schemas import PanneManuelle

def gen_ticket():
    return "TT-" + ''.join(random.choices(string.digits, k=6))

def get_pannes() -> dict:
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("""SELECT p.*, c.nom capteur_nom FROM pannes p
        LEFT JOIN capteurs c ON p.capteur_id=c.id
        ORDER BY FIELD(p.priorite,'critique','eleve','moyen','faible'), p.date_detection DESC""")
    rows = cur.fetchall(); cur.close(); db.close()
    for r in rows: r["date_detection"] = r["date_detection"].isoformat()
    return {"pannes": rows}

def creer_panne(data: PanneManuelle) -> dict:
    db = get_db(); cur = db.cursor()
    t = gen_ticket()
    cur.execute("INSERT INTO pannes (capteur_id,description,type,priorite,numero_ticket,source) VALUES (%s,%s,%s,%s,%s,'manuel')",
        (data.capteur_id, data.description, data.type, data.priorite, t))
    pid = cur.lastrowid
    cur.execute("INSERT INTO alertes (type,message,severite,panne_id) VALUES (%s,%s,%s,%s)",
        ("warning", f"⚠️ Panne manuelle: {data.description}", "warning", pid))
    db.commit(); cur.close(); db.close()
    return {"status": "ok", "ticket": t, "panne_id": pid}

def update_panne_statut(pid: int, data: dict) -> dict:
    db = get_db(); cur = db.cursor()
    cur.execute("UPDATE pannes SET statut=%s WHERE id=%s", (data["statut"], pid))
    db.commit(); cur.close(); db.close()
    return {"status": "ok"}
