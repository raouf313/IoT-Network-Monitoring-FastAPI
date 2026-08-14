"""routes/rapport_routes.py"""
from fastapi import APIRouter
from models.schemas import RapportCreate, RapportRetouche, RapportStatut
from controllers.rapport_controller import (
    get_rapports, creer_rapport, retouche_rapport,
    update_rapport_statut, get_photos, get_photo_file,
    supprimer_photo, generer_rapport_pdf,
)

router = APIRouter()

@router.get("/rapports")
def list_rapports(): return get_rapports()

@router.post("/rapports")
def new_rapport(data: RapportCreate): return creer_rapport(data)

@router.patch("/rapports/{rid}/retouche")
def retouche(rid: int, data: RapportRetouche): return retouche_rapport(rid, data)

@router.patch("/rapports/{rid}/statut")
def statut(rid: int, data: RapportStatut): return update_rapport_statut(rid, data)

@router.get("/rapports/{rid}/photos")
def photos(rid: int): return get_photos(rid)

@router.get("/rapports/{rid}/photos/{photo_id}/file")
def photo_file(rid: int, photo_id: int): return get_photo_file(rid, photo_id)

@router.delete("/rapports/{rid}/photos/{photo_id}")
def delete_photo(rid: int, photo_id: int): return supprimer_photo(rid, photo_id)

@router.get("/rapports/{rid}/pdf")
def pdf(rid: int): return generer_rapport_pdf(rid)
