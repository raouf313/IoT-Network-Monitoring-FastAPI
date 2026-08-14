"""
config/settings.py — Chargement centralisé des variables d'environnement.
Toutes les constantes de configuration passent par ici.
"""
import os


def _load_env():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


_load_env()


class Settings:
    # ── LM Studio / Anthropic API ───────────────────────────────────────────
    ANTHROPIC_API_KEY: str = os.environ.get("ANTHROPIC_API_KEY", "")
    LM_STUDIO_BASE_URL: str = os.environ.get("LM_STUDIO_BASE_URL", "http://localhost:1234/v1")
    LM_STUDIO_MODEL: str = os.environ.get("LM_STUDIO_MODEL", "local-model")

    # ── Base de données MySQL ──────────────────────────────────────────────
    DB_HOST:     str = os.environ.get("DB_HOST",     "localhost")
    DB_PORT:     int = int(os.environ.get("DB_PORT", "3306"))
    DB_NAME:     str = os.environ.get("DB_NAME",     "tunisie_telecom_db222")
    DB_USER:     str = os.environ.get("DB_USER",     "root")
    DB_PASSWORD: str = os.environ.get("DB_PASSWORD", "12345678aA")


settings = Settings()
