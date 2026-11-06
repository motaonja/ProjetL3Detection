from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
import uuid

from app.core.config import get_settings
from app.core.utils import format_size, format_datetime_fr
from app.db.database import get_db
from app.core.security import get_current_user
from app.models.models import UserModel
from app.models.models import UploadedFileModel, DataRecordModel
from app.schemas import schemas
from app.services.file_parser import parse_records, _map_columns

router = APIRouter(prefix="/api/files", tags=["Fichiers"])
settings = get_settings()

VALID_FORMATS = {"CSV", "XLSX", "XLS"}


@router.get("", response_model=list[schemas.UploadedFile])
def list_files(db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    files = db.execute(select(UploadedFileModel).where(UploadedFileModel.owner_id == user.id).order_by(UploadedFileModel.created_at)).scalars().all()
    return [_to_schema(f) for f in files]


@router.post("/upload", response_model=schemas.UploadResponse)
async def upload_files(
    files: list[UploadFile] = File(...),
    session_id: str | None = Form(default=None),
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    if not files:
        raise HTTPException(status_code=400, detail="Aucun fichier fourni.")

    upload_session_id = session_id or f"session-{uuid.uuid4().hex}"

    max_bytes = settings.MAX_UPLOAD_SIZE_MO * 1024 * 1024
    created_files: list[UploadedFileModel] = []
    created_records: list[DataRecordModel] = []
    warnings: list[str] = []

    for upload in files:
        extension = (upload.filename or "").rsplit(".", 1)[-1].upper()
        if extension not in VALID_FORMATS:
            warnings.append(f"Format non supporté pour « {upload.filename} » (CSV, XLSX ou XLS attendu).")
            continue

        content = await upload.read()
        if len(content) > max_bytes:
            warnings.append(f"« {upload.filename} » dépasse la taille maximale de {settings.MAX_UPLOAD_SIZE_MO} Mo.")
            continue

        try:
            parsed_records, row_count, source_columns = parse_records(upload.filename, content)
        except Exception as exc:  # noqa: BLE001
            warnings.append(f"Impossible de lire « {upload.filename} » : {exc}")
            continue

        file_row = UploadedFileModel(
            owner_id=user.id,
            session_id=upload_session_id,
            name=upload.filename,
            size=format_size(len(content)),
            size_bytes=len(content),
            format=extension,
            row_count=row_count,
            source_columns=source_columns,
            upload_date=format_datetime_fr(),
        )
        db.add(file_row)
        db.flush()  # récupère file_row.id

        for rec in parsed_records:
            record_row = DataRecordModel(
                owner_id=user.id,
                nom=rec["nom"],
                prenom=rec.get("prenom"),
                date_naissance=rec.get("date_naissance"),
                cin=rec.get("cin"),
                email=rec["email"],
                telephone=rec["telephone"],
                adresse=rec["adresse"],
                ville=rec["ville"],
                source_file=rec["sourceFile"],
                source_values=rec.get("sourceValues", {}),
                file_id=file_row.id,
            )
            db.add(record_row)
            created_records.append(record_row)

        created_files.append(file_row)

    db.commit()

    for f in created_files:
        db.refresh(f)
    for r in created_records:
        db.refresh(r)

    return schemas.UploadResponse(
        files=[_to_schema(f) for f in created_files],
        records=[schemas.DataRecord.from_orm_record(r) for r in created_records],
        warnings=warnings,
    )


@router.get("/{file_id}/preview")
def get_file_preview(
    file_id: str,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    file_row = db.query(UploadedFileModel).filter(
        UploadedFileModel.id == file_id,
        UploadedFileModel.owner_id == user.id,
    ).first()
    if not file_row:
        raise HTTPException(status_code=404, detail="Fichier introuvable.")

    records = db.execute(
        select(DataRecordModel)
        .where(DataRecordModel.file_id == file_row.id, DataRecordModel.owner_id == user.id)
        .order_by(DataRecordModel.id)
    ).scalars().all()
    source_columns = getattr(file_row, "source_columns", None) or []
    mapped_columns = _map_columns(source_columns)
    cin_column = mapped_columns.get("cin")
    date_column = mapped_columns.get("date_naissance")
    preview_records = []
    for record in records:
        source_values = dict(getattr(record, "source_values", None) or {})
        if cin_column and record.cin:
            source_values[cin_column] = record.cin
        if date_column and record.date_naissance and not source_values.get(date_column):
            source_values[date_column] = record.date_naissance
        preview_records.append({"id": record.id, "sourceValues": source_values})

    return {"sourceColumns": source_columns, "records": preview_records}


@router.delete("/{file_id}", status_code=204)
def delete_file(file_id: str, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    file_row = db.query(UploadedFileModel).filter(UploadedFileModel.id == file_id, UploadedFileModel.owner_id == user.id).first()
    if not file_row:
        raise HTTPException(status_code=404, detail="Fichier introuvable.")
    db.delete(file_row)  # cascade -> supprime aussi les DataRecord liés
    db.commit()
    return None


def _to_schema(file_row: UploadedFileModel) -> schemas.UploadedFile:
    return schemas.UploadedFile(
        id=file_row.id,
        sessionId=file_row.session_id or f"legacy-{file_row.id}",
        name=file_row.name,
        size=file_row.size,
        sizeBytes=file_row.size_bytes,
        format=file_row.format,
        rowCount=file_row.row_count,
        uploadDate=file_row.upload_date,
        sourceColumns=getattr(file_row, "source_columns", None) or [],
    )
