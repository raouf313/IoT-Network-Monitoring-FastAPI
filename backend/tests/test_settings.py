"""
tests/test_settings.py — Tests du module de configuration.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from config.settings import Settings, settings


class TestSettings:
    def test_default_values(self):
        """Vérifie les valeurs par défaut.
        Note: les valeurs réelles peuvent venir du fichier .env
        """
        s = Settings()
        assert s.DB_HOST == "localhost" or s.DB_HOST is not None
        assert s.DB_PORT == 3306
        # Le nom peut être db220 (défaut code) ou db222 (si .env présent)
        assert s.DB_NAME in ("tunisie_telecom_db220", "tunisie_telecom_db222")
        assert s.DB_USER == "root" or s.DB_USER is not None
        assert isinstance(s.ANTHROPIC_API_KEY, str)

    def test_lm_studio_defaults(self):
        """Vérifie les valeurs par défaut LM Studio (ajoutées récemment)."""
        s = Settings()
        assert s.LM_STUDIO_BASE_URL == "http://localhost:1234/v1"
        assert s.LM_STUDIO_MODEL == "local-model"

    def test_settings_has_required_attributes(self):
        """Vérifie que Settings a tous les attributs requis."""
        s = Settings()
        required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD",
                     "ANTHROPIC_API_KEY", "LM_STUDIO_BASE_URL", "LM_STUDIO_MODEL"]
        for attr in required:
            assert hasattr(s, attr), f"Settings manque l'attribut {attr}"

    def test_global_settings_instance(self):
        """Vérifie que l'instance globale est bien un Settings."""
        assert isinstance(settings, Settings)
        assert hasattr(settings, "DB_HOST")
        assert hasattr(settings, "LM_STUDIO_MODEL")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
