"""
controllers/alerte_controller.py
"""
from config.database import get_db

def get_alertes() -> dict:
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("SELECT * FROM alertes ORDER BY created_at DESC LIMIT 50")
    rows = cur.fetchall(); cur.close(); db.close()
    for r in rows: r["created_at"] = r["created_at"].isoformat()
    return {"alertes": rows}

def lire_alerte(aid: int) -> dict:
    db = get_db(); cur = db.cursor()
    cur.execute("UPDATE alertes SET lue=1 WHERE id=%s", (aid,))
    db.commit(); cur.close(); db.close()
    return {"status": "ok"}
