from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.database import Base, engine
from app.models import models  # noqa: F401
from app.models.models import UploadedFileModel
from app.services.file_parser import _map_columns, _normalize_birth_date
from app.api import files, records, analysis, arbitration, history, stats, auth
from app.core.security import get_current_user


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Initialise les ressources de l'application au démarrage.
    """
    # Crée les tables si elles n'existent pas encore.
    # Pratique en développement.
    Base.metadata.create_all(bind=engine)
    record_columns = {column["name"] for column in inspect(engine).get_columns("data_records")}
    for column_name in ("date_naissance", "cin"):
        if column_name not in record_columns:
            with engine.begin() as connection:
                connection.execute(text(f"ALTER TABLE data_records ADD COLUMN {column_name} VARCHAR"))
    if "source_values" not in record_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE data_records ADD COLUMN source_values JSON"))
    # Normalize decisions recorded by older versions so completed cases never remain uncertain.
    with engine.begin() as connection:
        connection.execute(text("""
            UPDATE match_pairs
            SET status = CASE decision WHEN 'confirmed' THEN 'duplicate' WHEN 'rejected' THEN 'different' END,
                status_label = CASE decision WHEN 'confirmed' THEN 'Doublon probable' WHEN 'rejected' THEN 'Différent' END
            WHERE status = 'uncertain' AND decision IN ('confirmed', 'rejected')
        """))

    file_columns = {column["name"] for column in inspect(engine).get_columns("uploaded_files")}
    if "source_columns" not in file_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE uploaded_files ADD COLUMN source_columns JSON"))
    if "numero_cin" in record_columns:
        with engine.begin() as connection:
            connection.execute(text("UPDATE data_records SET cin = numero_cin WHERE (cin IS NULL OR cin = '') AND numero_cin IS NOT NULL"))

    # Répare les dates non mappées lors d'anciens imports en relisant la valeur
    # brute conservée avec l'en-tête d'origine. Les dates déjà présentes restent intactes.
    with Session(engine) as db:
        files_with_headers = db.query(UploadedFileModel).filter(
            UploadedFileModel.source_columns.is_not(None)
        ).all()
        for uploaded_file in files_with_headers:
            source_column = _map_columns(uploaded_file.source_columns or []).get("date_naissance")
            if not source_column:
                continue
            for record in uploaded_file.records:
                if record.date_naissance:
                    continue
                raw_date = (record.source_values or {}).get(source_column)
                normalized_date = _normalize_birth_date(raw_date)
                if normalized_date:
                    record.date_naissance = normalized_date
        db.commit()

    if "session_id" not in {column["name"] for column in inspect(engine).get_columns("uploaded_files")}:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE uploaded_files ADD COLUMN session_id VARCHAR"))
    if "session_completed" not in {column["name"] for column in inspect(engine).get_columns("uploaded_files")}:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE uploaded_files ADD COLUMN session_completed BOOLEAN NOT NULL DEFAULT FALSE"))

    for table_name in ("uploaded_files", "data_records", "analysis_history"):
        columns = {column["name"] for column in inspect(engine).get_columns(table_name)}
        if "owner_id" not in columns:
            with engine.begin() as connection:
                connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN owner_id VARCHAR REFERENCES users(id) ON DELETE CASCADE"))

    user_columns = {column["name"] for column in inspect(engine).get_columns("users")}
    if "name" not in user_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN name VARCHAR NOT NULL DEFAULT ''"))
    if "email_verified" not in user_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT TRUE"))

    session_columns = {column["name"] for column in inspect(engine).get_columns("auth_sessions")}
    if "mfa_verified" not in session_columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE auth_sessions ADD COLUMN mfa_verified BOOLEAN NOT NULL DEFAULT FALSE"))

    yield


api_app = FastAPI(
    title="API de détection de doublons — Onja / ConnectiQ",
    description=(
        "Moteur de rapprochement et de détection de doublons "
        "(FastAPI + pandas + textdistance + PostgreSQL)."
    ),
    version="1.0.0",
    lifespan=lifespan,
)




# Public account endpoints; all data endpoints require an authenticated account.
api_app.include_router(auth.router)
protected = {"dependencies": [Depends(get_current_user)]}
api_app.include_router(files.router, **protected)
api_app.include_router(records.router, **protected)
api_app.include_router(analysis.router, **protected)
api_app.include_router(arbitration.router, **protected)
api_app.include_router(history.router, **protected)
api_app.include_router(stats.router, **protected)


@api_app.get("/api/health", tags=["Santé"])
def health_check():
    """
    Vérifie que l'API fonctionne.
    """
    return {"status": "ok"}

# Wrap the complete FastAPI app so CORS headers are also present
# on unhandled error responses.
app = CORSMiddleware(
    app=api_app,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
