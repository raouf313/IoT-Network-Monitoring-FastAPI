"""
controllers/message_controller.py
"""
from config.database import get_db
from models.schemas import MessageCreate

def envoyer_message(data: MessageCreate) -> dict:
    db = get_db(); cur = db.cursor()
    cur.execute("INSERT INTO messages (expediteur_id,destinataire_id,contenu) VALUES (%s,%s,%s)",
        (data.expediteur_id, data.destinataire_id, data.contenu))
    db.commit(); cur.close(); db.close()
    return {"status": "ok"}

def get_messages(uid: int) -> dict:
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("""SELECT m.*, u.nom expediteur_nom FROM messages m
        JOIN utilisateurs u ON m.expediteur_id=u.id
        WHERE m.destinataire_id=%s OR m.expediteur_id=%s
        ORDER BY m.created_at DESC LIMIT 50""", (uid, uid))
    rows = cur.fetchall()
    cur.execute("UPDATE messages SET lu=1 WHERE destinataire_id=%s AND lu=0", (uid,))
    db.commit(); cur.close(); db.close()
    for r in rows: r["created_at"] = r["created_at"].isoformat()
    return {"messages": rows}

def count_messages(uid: int) -> dict:
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("SELECT COUNT(*) v FROM messages WHERE destinataire_id=%s AND lu=0", (uid,))
    c = cur.fetchone()["v"]; cur.close(); db.close()
    return {"count": c}
