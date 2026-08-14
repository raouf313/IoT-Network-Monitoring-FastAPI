"""routes/panne_routes.py"""
from fastapi import APIRouter, BackgroundTasks
from models.schemas import PanneManuelle
from controllers.panne_controller import get_pannes, creer_panne, update_panne_statut
from services.tech_service import auto_assign_all_available

router = APIRouter()

@router.get("/pannes")
def list_pannes(): return get_pannes()

@router.post("/pannes")
async def new_panne(data: PanneManuelle, background_tasks: BackgroundTasks):
    result = creer_panne(data)
    background_tasks.add_task(auto_assign_all_available)
    return result

@router.patch("/pannes/{pid}/statut")
def patch_panne(pid: int, data: dict): return update_panne_statut(pid, data)
