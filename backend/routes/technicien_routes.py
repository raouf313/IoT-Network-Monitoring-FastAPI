"""routes/technicien_routes.py"""
from fastapi import APIRouter, BackgroundTasks
from models.schemas import TechnicienCreate, TechnicienUpdate
from controllers.technicien_controller import (
    get_techniciens, get_technicien, ajouter_technicien,
    supprimer_technicien, update_technicien, technicien_set_indisponible,
)

router = APIRouter()

@router.get("/techniciens")
def list_techs(): return get_techniciens()

@router.post("/techniciens")
def add_tech(data: TechnicienCreate): return ajouter_technicien(data)

@router.delete("/techniciens/{tid}")
def del_tech(tid: int): return supprimer_technicien(tid)

@router.get("/techniciens/{tid}")
def get_tech(tid: int): return get_technicien(tid)

@router.patch("/techniciens/{tid}/indisponible")
async def set_indisponible(tid: int, background_tasks: BackgroundTasks):
    return technicien_set_indisponible(tid, background_tasks.add_task)

@router.patch("/techniciens/{tid}")
async def patch_tech(tid: int, data: TechnicienUpdate, background_tasks: BackgroundTasks):
    return update_technicien(tid, data, background_tasks.add_task)
