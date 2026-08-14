"""routes/dashboard_routes.py"""
from fastapi import APIRouter
from controllers.dashboard_controller import get_dashboard

router = APIRouter()

@router.get("/dashboard")
def dashboard():
    return get_dashboard()
