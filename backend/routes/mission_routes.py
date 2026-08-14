"""routes/mission_routes.py"""
from fastapi import APIRouter, BackgroundTasks, UploadFile, File
from models.schemas import MissionCreate, MissionUpdate, MissionStatut
from controllers.mission_controller import (
    export_missions_pdf, get_missions, creer_mission, update_mission, update_mission_statut,
    terminer_mission, get_missions_technicien, assigner_mission,
    signaler_blocage, download_template_excel, import_missions_excel,
)

router = APIRouter()

@router.get("/missions")
def list_missions(): return get_missions()

@router.get("/missions/template-excel")
def template_excel(): return download_template_excel()

@router.post("/missions/import-excel")
async def import_excel(file: UploadFile = File(...)): return await import_missions_excel(file)

@router.get("/missions/technicien/{tid}")
def missions_tech(tid: int): return get_missions_technicien(tid)

@router.post("/missions")
def new_mission(data: MissionCreate): return creer_mission(data)

@router.patch("/missions/{mid}")
def patch_mission(mid: int, data: MissionUpdate): return update_mission(mid, data)

@router.patch("/missions/{mid}/statut")
async def patch_statut(mid: int, data: MissionStatut, background_tasks: BackgroundTasks):
    return update_mission_statut(mid, data, background_tasks.add_task)

@router.post("/missions/{mid}/terminer")
def terminer(mid: int): return terminer_mission(mid)

@router.patch("/missions/{mid}/assigner")
def assigner(mid: int, data: dict): return assigner_mission(mid, data)

@router.post("/missions/{mid}/signaler_blocage")
def blocage(mid: int, data: dict): return signaler_blocage(mid, data)
@router.get("/missions/rapport-pdf")
def get_all_missions_pdf():
    from controllers.mission_controller import export_missions_pdf
    return export_missions_pdf()