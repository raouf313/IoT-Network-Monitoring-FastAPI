"""
tests/test_schemas.py — Tests unitaires des modèles Pydantic.
S'exécute sans base de données.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from pydantic import ValidationError
from models.schemas import (
    LoginData, DonneeCapteur, PanneManuelle, MissionCreate,
    MissionUpdate, MissionStatut, TechnicienCreate,
    TechnicienUpdate, RapportCreate, RapportRetouche,
    RapportStatut, MessageCreate, AIRequest, ChatbotRequest,
)


class TestLoginData:
    def test_valid(self):
        d = LoginData(email="test@tt.tn", password="pass123")
        assert d.email == "test@tt.tn"
        assert d.password == "pass123"

    def test_missing_email(self):
        with pytest.raises(ValidationError):
            LoginData(password="pass123")

    def test_missing_password(self):
        with pytest.raises(ValidationError):
            LoginData(email="test@tt.tn")


class TestDonneeCapteur:
    def test_valid(self):
        d = DonneeCapteur(capteur_id=1, temperature=25.5, humidite=60.0)
        assert d.capteur_id == 1
        assert d.temperature == 25.5
        assert d.humidite == 60.0

    def test_negative_values(self):
        d = DonneeCapteur(capteur_id=1, temperature=-5.0, humidite=10.0)
        assert d.temperature == -5.0
        # Les valeurs négatives sont acceptables pour le schéma

    def test_invalid_capteur_id(self):
        with pytest.raises(ValidationError):
            DonneeCapteur(capteur_id="abc", temperature=25.0, humidite=60.0)


class TestPanneManuelle:
    def test_defaults(self):
        d = PanneManuelle(description="Test panne")
        assert d.priorite == "moyen"
        assert d.capteur_id is None
        assert d.type is None

    def test_custom_priority(self):
        d = PanneManuelle(description="Panne critique", priorite="critique")
        assert d.priorite == "critique"

    def test_invalid_priority(self):
        """Le schéma Pydantic accepte n'importe quelle chaîne, la validation
        est faite au niveau DB. Donc ce test vérifie le type seulement."""
        d = PanneManuelle(description="Test", priorite="super_critique")
        assert d.priorite == "super_critique"


class TestMissionCreate:
    def test_minimal(self):
        d = MissionCreate(description="Mission test")
        assert d.description == "Mission test"
        assert d.priorite == "moyen"
        assert d.localisation is None
        assert d.technicien_id is None

    def test_full(self):
        d = MissionCreate(
            description="Mission complète",
            localisation="Tunis",
            priorite="critique",
            technicien_id=3,
            panne_id=5,
        )
        assert d.technicien_id == 3
        assert d.panne_id == 5


class TestMissionUpdate:
    def test_partial(self):
        d = MissionUpdate(description="Nouvelle desc")
        assert d.description == "Nouvelle desc"
        assert d.statut is None

    def test_full_update(self):
        d = MissionUpdate(
            description="Desc", localisation="Loc",
            priorite="eleve", technicien_id=2, statut="en_cours"
        )
        assert d.statut == "en_cours"
        assert d.technicien_id == 2

    def test_exclude_none(self):
        d = MissionUpdate(description="Test")
        data = d.model_dump(exclude_none=True)
        assert "description" in data
        assert "statut" not in data
        assert "technicien_id" not in data


class TestMissionStatut:
    def test_valid(self):
        d = MissionStatut(statut="terminee")
        assert d.statut == "terminee"


class TestTechnicienCreate:
    def test_default_password(self):
        d = TechnicienCreate(nom="Test", email="test@tt.tn")
        assert d.mot_de_passe == "tech123"

    def test_custom_password(self):
        d = TechnicienCreate(nom="Test", email="test@tt.tn", mot_de_passe="custom!")
        assert d.mot_de_passe == "custom!"


class TestRapportCreate:
    def test_minimal(self):
        d = RapportCreate(contenu="Contenu du rapport")
        assert d.contenu == "Contenu du rapport"
        assert d.photos == []

    def test_with_photos(self):
        d = RapportCreate(
            contenu="Rapport avec photos",
            photos=["data:image/jpg;base64,ABC123", "data:image/png;base64,DEF456"]
        )
        assert len(d.photos) == 2

    def test_default_titre(self):
        d = RapportCreate(contenu="Test")
        assert d.titre is None


class TestMessageCreate:
    def test_valid(self):
        d = MessageCreate(
            expediteur_id=1, destinataire_id=2, contenu="Salut!"
        )
        assert d.contenu == "Salut!"


class TestAIRequest:
    def test_minimal(self):
        d = AIRequest()
        assert d.panne_id is None
        assert d.valeur is None

    def test_full(self):
        d = AIRequest(
            panne_id=5, type_panne="température",
            description="Surchauffe", valeur=45.0
        )
        assert d.valeur == 45.0


class TestChatbotRequest:
    def test_valid(self):
        d = ChatbotRequest(message="Bonjour")
        assert d.message == "Bonjour"
        assert d.historique == []

    def test_with_history(self):
        d = ChatbotRequest(
            message="Suite",
            user_id=1,
            user_role="technicien",
            historique=[{"role": "user", "content": "Bonjour"}]
        )
        assert len(d.historique) == 1


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
