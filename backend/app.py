"""
app.py — Point d'entrée unique de l'application FastAPI
Responsabilité : initialisation, CORS, chargement des routes, startup hooks.
Aucune logique métier ici.
"""
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config.settings import settings
from config.database import run_migrations
from services.tech_service import fix_disponible_state, auto_assign_all_available

# ── Import des routers ──────────────────────────────────────────────────────
from routes.auth_routes      import router as auth_router
from routes.dashboard_routes import router as dashboard_router
from routes.capteur_routes   import router as capteur_router
from routes.panne_routes     import router as panne_router
from routes.mission_routes   import router as mission_router
from routes.technicien_routes import router as technicien_router
from routes.rapport_routes   import router as rapport_router
from routes.alerte_routes    import router as alerte_router
from routes.message_routes   import router as message_router

# ── Création de l'application ───────────────────────────────────────────────
app = FastAPI(
    title="Tunisie Telecom — Workflow API v3",
    description="API de gestion des pannes, missions et techniciens TT",
    version="3.0.0"
)

# ── Middleware CORS ─────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Enregistrement des routes ───────────────────────────────────────────────
app.include_router(auth_router,        prefix="/api")
app.include_router(dashboard_router,   prefix="/api")
app.include_router(capteur_router,     prefix="/api")
app.include_router(panne_router,       prefix="/api")
app.include_router(mission_router,     prefix="/api")
app.include_router(technicien_router,  prefix="/api")
app.include_router(rapport_router,     prefix="/api")
app.include_router(alerte_router,      prefix="/api")
app.include_router(message_router,     prefix="/api")
# Include IA / chatbot route (with /api prefix for consistency)
from routes.ia_routes import router as ia_router
app.include_router(ia_router, prefix="/api")
# WebSocket router (no /api prefix)
from routes.capteur_routes import ws_router
app.include_router(ws_router)

# ── Startup hook ────────────────────────────────────────────────────────────
@app.on_event("startup")
async def _startup():
    run_migrations()
    fix_disponible_state()
    asyncio.create_task(_scheduler_loop())
    await asyncio.to_thread(auto_assign_all_available)
    print("[STARTUP] ✅ Application prête")


async def _scheduler_loop():
    """Boucle background : auto-assign toutes les 30s, détection blocages toutes les 60s."""
    from services.tech_service import  check_missions_bloquees, fix_disponible_state
    
    ASSIGN_INTERVAL  = 30
    BLOCKED_INTERVAL = 60
    last_assign  = 0.0
    last_blocked = 0.0
    while True:
        await asyncio.sleep(10)
        now = asyncio.get_event_loop().time()
        
        if now - last_assign >= ASSIGN_INTERVAL:
            last_assign = now
            try:
              
               
                # 2. Synchro des états
                fix_disponible_state()
                
                # 3. Auto-assignation intelligente
                total = await asyncio.to_thread(auto_assign_all_available)
                if total > 0:
                    print(f"[SCHEDULER] 🤖 {total} mission(s) auto-assignée(s)")
            except Exception as e:
                print(f"[SCHEDULER] ⚠️ Erreur auto-assign : {e}")

# ── Health check ────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "Tunisie Telecom Workflow API v3 ✅", "docs": "/docs"}
