"""routes/alerte_routes.py"""
from fastapi import APIRouter
from controllers.alerte_controller import get_alertes, lire_alerte

router = APIRouter()

@router.get("/alertes")
def list_alertes(): return get_alertes()

@router.patch("/alertes/{aid}/lire")
def lire(aid: int): return lire_alerte(aid)
