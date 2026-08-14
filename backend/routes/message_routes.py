"""routes/message_routes.py"""
from fastapi import APIRouter
from models.schemas import MessageCreate
from controllers.message_controller import envoyer_message, get_messages, count_messages

router = APIRouter()

@router.post("/messages")
def send(data: MessageCreate): return envoyer_message(data)

@router.get("/messages/{uid}")
def messages(uid: int): return get_messages(uid)

@router.get("/messages/{uid}/count")
def count(uid: int): return count_messages(uid)
