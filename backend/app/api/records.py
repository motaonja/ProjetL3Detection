from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.security import get_current_user
from app.models.models import UserModel, UploadedFileModel
from app.models.models import DataRecordModel
from app.schemas import schemas

router = APIRouter(prefix="/api/records", tags=["Enregistrements"])


@router.get("", response_model=list[schemas.DataRecord])
def list_records(source_file: str | None = None, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    query = select(DataRecordModel).where(DataRecordModel.owner_id == user.id)
    if source_file:
        query = query.where(DataRecordModel.source_file == source_file)
    records = db.execute(query).scalars().all()
    return [schemas.DataRecord.from_orm_record(r) for r in records]


@router.post("", response_model=schemas.DataRecord, status_code=201)
def create_record(payload: schemas.DataRecordCreate, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    record = DataRecordModel(
        owner_id=user.id,
        nom=payload.nom,
        prenom=payload.prenom,
        date_naissance=payload.date_naissance,
        cin=payload.cin,
        email=payload.email,
        telephone=payload.telephone,
        adresse=payload.adresse,
        ville=payload.ville,
        source_file=payload.sourceFile,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return schemas.DataRecord.from_orm_record(record)


@router.delete("/{record_id}", status_code=204)
def delete_record(record_id: str, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    record = db.query(DataRecordModel).filter(DataRecordModel.id == record_id, DataRecordModel.owner_id == user.id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Enregistrement introuvable.")
    db.delete(record)
    db.commit()
    return None
