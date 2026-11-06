"""
Configuration centralisée de l'application, lue depuis les variables
d'environnement / fichier .env.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=True,
    )

    # Base de données
    DATABASE_URL: str = (
        "postgresql+psycopg://onja:onja_password@localhost:5433/doublons_db"
    )

    # CORS
    CORS_ORIGINS: str = (
        "http://localhost:3000,"
        "http://127.0.0.1:3000,"
        "http://localhost:3001,"
        "http://127.0.0.1:3001,"
        "http://localhost:3002,"
        "http://127.0.0.1:3002"
    )

    # Moteur de rapprochement
    SEUIL_DOUBLON: int = 85
    SEUIL_INCERTAIN: int = 60

    AUTH_COOKIE_SECURE: bool = False

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_STARTTLS: bool = True
    FRONTEND_BASE_URL: str = "http://localhost:3000"

    # Upload
    MAX_UPLOAD_SIZE_MO: int = 50

    @property
    def cors_origins_list(self) -> list[str]:
        """
        Transforme la chaîne CORS_ORIGINS en liste d'origines.
        """
        return [
            origin.strip()
            for origin in self.CORS_ORIGINS.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    """
    Retourne une instance unique de la configuration.
    """
    return Settings()