from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.core.config import get_settings


settings = get_settings()

database_url = settings.DATABASE_URL
connect_args = {"client_encoding": "UTF8"} if database_url.lower().startswith(("postgresql://", "postgresql+")) else {}

engine = create_engine(
    database_url,
    pool_pre_ping=True,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


class Base(DeclarativeBase):
    pass


def get_db():
    """Dépendance FastAPI fournissant une session DB par requête."""
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()