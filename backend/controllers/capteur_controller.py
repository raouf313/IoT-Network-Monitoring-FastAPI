"""
controllers/capteur_controller.py — Version finale avec création automatique de missions
"""
import random, string
from fastapi import WebSocket, WebSocketDisconnect
from config.database import get_db
from models.schemas import DonneeCapteur

def gen_ticket():
    return "TT-" + ''.join(random.choices(string.digits, k=6))

class WebSocketManager:
    def __init__(self): self.active: list[WebSocket] = []
    async def connect(self, ws: WebSocket): await ws.accept(); self.active.append(ws)
    def disconnect(self, ws: WebSocket):
        if ws in self.active: self.active.remove(ws)
    async def broadcast(self, message: dict):
        dead = []
        for ws in self.active:
            try: await ws.send_json(message)
            except: dead.append(ws)
        for ws in dead: self.disconnect(ws)

ws_manager = WebSocketManager()
dashboard_ws_manager = WebSocketManager() # Manager dédié pour les clients dashboard

async def recevoir_donnees(data: DonneeCapteur) -> dict:
    db = get_db(); cur = db.cursor()
    
    # 0. Récupérer la localisation dynamique du capteur
    cur.execute("SELECT localisation FROM capteurs WHERE id = %s", (data.capteur_id,))
    row = cur.fetchone()
    localisation = row[0] if row else "Ghardimaou"
    
    # 1. Insertion de la donnée brute du capteur
    cur.execute("INSERT INTO donnees_capteurs (capteur_id,temperature,humidite) VALUES (%s,%s,%s)",
        (data.capteur_id, data.temperature, data.humidite))
    
    pannes = []
    
    # ── Température Critique (> 40°C) ──
    if data.temperature > 40:
        t = gen_ticket()
        
        # a. Insertion de la panne
        cur.execute("INSERT INTO pannes (capteur_id,description,type,valeur_detectee,numero_ticket,priorite,source) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (data.capteur_id, f"Température critique: {data.temperature}°C", "temperature_critique", data.temperature, t, "critique", "capteur"))
        pid = cur.lastrowid
        
        # b. Insertion de l'alerte admin
        cur.execute("INSERT INTO alertes (type,message,severite,panne_id) VALUES (%s,%s,%s,%s)",
            ("critique", f"🔴 Temp critique {data.temperature}°C — Capteur {data.capteur_id}", "critique", pid))
        
        # 🔥 Tصلّيح Mohem: Insertion de la MISSION correspondante pour le Scheduler
        cur.execute("INSERT INTO missions (panne_id, description, localisation, priorite, statut) VALUES (%s,%s,%s,%s,%s)",
            (pid, f"Intervention sur capteur #{data.capteur_id} (Température: {data.temperature}°C)", localisation, "critique", "en_attente"))
        
        pannes.append({
            "type": "temperature", 
            "ticket": t, 
            "panne_id": pid, 
            "val": data.temperature, 
            "valeur": data.temperature
        })
        
    # ── Humidité Critique (> 85%) ──
    if data.humidite > 85:
        t = gen_ticket()
        
        # a. Insertion de la panne
        cur.execute("INSERT INTO pannes (capteur_id,description,type,valeur_detectee,numero_ticket,priorite,source) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (data.capteur_id, f"Humidité critique: {data.humidite}%", "humidite_critique", data.humidite, t, "eleve", "capteur"))
        pid = cur.lastrowid
        
        # b. Insertion de l'alerte admin
        cur.execute("INSERT INTO alertes (type,message,severite,panne_id) VALUES (%s,%s,%s,%s)",
            ("warning", f"💧 Humidité {data.humidite}% — Capteur {data.capteur_id}", "warning", pid))
        
        # 🔥 Tصلّيح Mohem: Insertion de la MISSION correspondante pour le Scheduler
        cur.execute("INSERT INTO missions (panne_id, description, localisation, priorite, statut) VALUES (%s,%s,%s,%s,%s)",
            (pid, f"Intervention sur capteur #{data.capteur_id} (Humidité: {data.humidite}%)", localisation, "eleve", "en_attente"))
        
        pannes.append({
            "type": "humidite", 
            "ticket": t, 
            "panne_id": pid, 
            "val": data.humidite, 
            "valeur": data.humidite
        })
        
    db.commit(); cur.close(); db.close()
    return {"status":"ok","pannes_creees":pannes}

def get_historique(cid: int, limit: int = 50) -> dict:
    db = get_db(); cur = db.cursor(dictionary=True)
    cur.execute("SELECT * FROM donnees_capteurs WHERE capteur_id=%s ORDER BY created_at DESC LIMIT %s", (cid, limit))
    rows = cur.fetchall(); cur.close(); db.close()
    for r in rows: r["created_at"] = r["created_at"].isoformat()
    return {"data": rows}