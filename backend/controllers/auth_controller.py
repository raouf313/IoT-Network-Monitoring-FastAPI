"""
controllers/auth_controller.py
"""
from fastapi import HTTPException
from config.database import get_db
from models.schemas import LoginData

def login(data: LoginData) -> dict:
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute(
        "SELECT id,nom,email,role,disponible,telephone,specialite FROM utilisateurs WHERE email=%s AND mot_de_passe=%s",
        (data.email, data.password)
    )
    user = cur.fetchone(); cur.close(); db.close()
    if not user: raise HTTPException(401, "Identifiants incorrects")
    return {"status": "ok", "user": user}
