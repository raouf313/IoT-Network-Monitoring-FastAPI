"""routes/ia_routes.py"""
from fastapi import APIRouter
from models.schemas import AIRequest, ChatbotRequest
from controllers.ia_controller import analyser_panne, chatbot as _chatbot

router = APIRouter()

@router.post("/ia/analyser")
def analyse(req: AIRequest): return analyser_panne(req)

@router.post("/chatbot")
def chatbot(req: ChatbotRequest): return _chatbot(req)

