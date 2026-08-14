"""
controllers/dashboard_controller.py
"""
from config.database import get_db

def get_dashboard() -> dict:
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("SELECT COUNT(*) v FROM pannes WHERE statut='ouverte'");               po = cur.fetchone()["v"]
    cur.execute("SELECT COUNT(*) v FROM missions WHERE statut IN ('en_cours','acceptee')"); mc = cur.fetchone()["v"]
    cur.execute("SELECT COUNT(*) v FROM missions WHERE statut='terminee'");             mt = cur.fetchone()["v"]
    cur.execute("SELECT COUNT(*) v FROM missions WHERE statut='en_attente'");          ma = cur.fetchone()["v"]
    cur.execute("SELECT COUNT(*) v FROM alertes WHERE lue=0");                         an = cur.fetchone()["v"]
    cur.execute("SELECT COUNT(*) v FROM utilisateurs WHERE role='technicien' AND disponible=1"); td = cur.fetchone()["v"]
    cur.execute("SELECT COUNT(*) v FROM rapports");                                    tr = cur.fetchone()["v"]
    cur.execute("""
        SELECT u.id,u.nom,u.disponible,u.specialite,
               COUNT(CASE WHEN m.statut IN ('en_cours','acceptee') THEN 1 END) en_cours,
               COUNT(CASE WHEN m.statut='terminee' THEN 1 END) terminees,
               COUNT(CASE WHEN m.statut='en_attente' THEN 1 END) en_attente
        FROM utilisateurs u LEFT JOIN missions m ON m.technicien_id=u.id
        WHERE u.role='technicien' GROUP BY u.id
    """); stats = cur.fetchall()
    cur.execute("""
        SELECT d.capteur_id,c.nom capteur_nom,d.temperature,d.humidite,d.created_at
        FROM donnees_capteurs d JOIN capteurs c ON d.capteur_id=c.id
        ORDER BY d.created_at DESC LIMIT 90
    """); donnees = cur.fetchall()
    for r in donnees: r["created_at"] = r["created_at"].isoformat()
    cur.close(); db.close()
    return {
        "pannes_ouvertes": po, "missions_en_cours": mc, "missions_terminees": mt,
        "missions_en_attente": ma, "alertes_non_lues": an, "techniciens_disponibles": td,
        "total_rapports": tr, "stats_techniciens": stats, "donnees_capteurs": donnees
    }
