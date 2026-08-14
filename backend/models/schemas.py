"""
models/schemas.py — Tous les modèles Pydantic (validation des données entrantes).
"""
from pydantic import BaseModel
from typing import Optional, List


# ── Auth ────────────────────────────────────────────────────────────────────
class LoginData(BaseModel):
    email: str
    password: str  # Le frontend envoie 'password', pas 'mot_de_passe'


# ── Capteurs ────────────────────────────────────────────────────────────────
class DonneeCapteur(BaseModel):
    capteur_id:  int
    temperature: float
    humidite:    float


# ── Pannes ──────────────────────────────────────────────────────────────────
class PanneManuelle(BaseModel):
    capteur_id:  Optional[int] = None
    description: str
    type:        Optional[str] = None
    priorite:    str = "moyen"


# ── Missions ────────────────────────────────────────────────────────────────
class MissionCreate(BaseModel):
    description:   str
    localisation:  Optional[str] = None
    priorite:      str = "moyen"
    technicien_id: Optional[int] = None
    panne_id:      Optional[int] = None


class MissionUpdate(BaseModel):
    description:   Optional[str] = None
    localisation:  Optional[str] = None
    priorite:      Optional[str] = None
    technicien_id: Optional[int] = None
    statut:        Optional[str] = None


class MissionStatut(BaseModel):
    statut: str


# ── Techniciens ─────────────────────────────────────────────────────────────
class TechnicienCreate(BaseModel):
    nom:          str
    email:        str
    mot_de_passe: str = "tech123"
    telephone:    Optional[str] = None
    specialite:   Optional[str] = None


class TechnicienUpdate(BaseModel):
    disponible:          Optional[bool] = None
    telephone:           Optional[str]  = None
    specialite:          Optional[str]  = None
    retour_disponible:   Optional[str]  = None
    duree_retour_minutes: Optional[int] = None
    role_appelant:       Optional[str]  = None


# ── Rapports ────────────────────────────────────────────────────────────────
class RapportCreate(BaseModel):
    titre:        Optional[str] = None
    contenu:      str
    technicien_id: Optional[int] = None
    mission_id:   Optional[int] = None
    photos:       Optional[List[str]] = []


class RapportRetouche(BaseModel):
    contenu: str


class RapportStatut(BaseModel):
    statut: str


# ── Messages ─────────────────────────────────────────────────────────────────
class MessageCreate(BaseModel):
    expediteur_id:   int
    destinataire_id: int
    contenu:         str


# ── IA ──────────────────────────────────────────────────────────────────────
class AIRequest(BaseModel):
    panne_id:    Optional[int] = None
    type_panne:  Optional[str] = None
    description: Optional[str] = None
    valeur:      Optional[float] = None


class ChatbotRequest(BaseModel):
    message:    str
    user_id:    Optional[int] = None
    user_role:  Optional[str] = None
    historique: Optional[List[dict]] = []
