"""routes/auth_routes.py"""
from fastapi import APIRouter
from models.schemas import LoginData
from controllers.auth_controller import login as _login

router = APIRouter()

@router.post("/login")
def login(data: LoginData):
    return _login(data)
