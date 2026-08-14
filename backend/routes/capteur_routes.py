"""routes/capteur_routes.py"""
from fastapi import APIRouter, BackgroundTasks, WebSocket, WebSocketDisconnect
from models.schemas import DonneeCapteur
from controllers.capteur_controller import (
    recevoir_donnees as _recevoir,
    get_historique,
    ws_manager,
    dashboard_ws_manager,
)
from services.tech_service import auto_assign_all_available

router = APIRouter()
ws_router = APIRouter()  # Router khass lil WebSockets (sans prefix /api fil app.py)

@router.post("/capteurs/donnees")
async def recevoir_donnees(data: DonneeCapteur, background_tasks: BackgroundTasks):
    result = await _recevoir(data)
    if result.get("pannes_creees"):
        background_tasks.add_task(auto_assign_all_available)
    return result


@router.get("/capteurs/historique/{cid}")
def historique(cid: int, limit: int = 50):
    return get_historique(cid, limit)


@ws_router.websocket("/ws/capteurs")  # Khallina we7ed barka hna
async def websocket_capteurs(websocket: WebSocket):
    # ws_manager.connect fiha déja await ws.accept() fil controller, donc n7ottouha direct
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_json()
            donnee = DonneeCapteur(**data)
            result = await _recevoir(donnee)
            # Diffuser aux capteurs ET au dashboard
            await ws_manager.broadcast({
                "capteur_id": donnee.capteur_id, 
                "temperature": donnee.temperature, 
                "humidite": donnee.humidite, 
                **result
            })
            await dashboard_ws_manager.broadcast({
                "capteur_id": donnee.capteur_id, 
                "temperature": donnee.temperature, 
                "humidite": donnee.humidite, 
                **result
            })
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


@ws_router.websocket("/ws/dashboard")  # Endpoint dédié pour le dashboard
async def websocket_dashboard(websocket: WebSocket):
    await dashboard_ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        dashboard_ws_manager.disconnect(websocket)