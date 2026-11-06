from fastapi import APIRouter, Depends, HTTPException

from sqlalchemy import select, func

from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.security import get_current_user

from app.models.models import (
    UploadedFileModel,
    DataRecordModel,
    MatchPairModel,
    FieldComparisonModel,
    AnalysisHistoryModel,
    AnalysisSnapshotModel,
    UserModel,
)

from app.schemas import schemas
from app.services.result_classification import classify_record_ids, pending_arbitration_results


router = APIRouter(
    prefix="/api/stats",
    tags=["Statistiques"],
)


@router.get(
    "/dashboard",
    response_model=schemas.DashboardStats,
)
def dashboard_stats(
    analysis_id: str | None = None,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    if analysis_id:
        latest_analysis = db.query(AnalysisHistoryModel).filter(AnalysisHistoryModel.id == analysis_id, AnalysisHistoryModel.owner_id == user.id).first()
        if latest_analysis is None:
            raise HTTPException(status_code=404, detail="Analyse introuvable.")
    else:
        latest_analysis = (
            db.query(AnalysisHistoryModel)
            .filter(AnalysisHistoryModel.owner_id == user.id)
            .order_by(AnalysisHistoryModel.created_at.desc())
            .first()
        )
    snapshot_stats = None
    if latest_analysis is not None:
        snapshot = db.get(AnalysisSnapshotModel, latest_analysis.id)
        if snapshot is not None:
            snapshot_stats = dict(snapshot.payload["stats"])
            snapshot_stats["pendingArbitrationCount"] = len(
                pending_arbitration_results(snapshot.payload.get("results", []))
            )
    # -----------------------------------------------------------------------
    # NOMBRE TOTAL DE FICHIERS IMPORTÉS
    # -----------------------------------------------------------------------

    total_files = db.execute(select(func.count(UploadedFileModel.id)).where(UploadedFileModel.owner_id == user.id)).scalar_one()

    # -----------------------------------------------------------------------
    # NOMBRE TOTAL D'ENREGISTREMENTS
    # -----------------------------------------------------------------------

    total_records = db.execute(select(func.count(DataRecordModel.id)).join(UploadedFileModel, DataRecordModel.file_id == UploadedFileModel.id).where(DataRecordModel.owner_id == user.id, UploadedFileModel.owner_id == user.id)).scalar_one()

    if snapshot_stats is not None:
        snapshot_stats["totalFiles"] = total_files
        snapshot_stats["totalRecords"] = total_records
        return schemas.DashboardStats(**snapshot_stats)

    # -----------------------------------------------------------------------
    # NOMBRE TOTAL DE PAIRES COMPARÉES
    # -----------------------------------------------------------------------

    total_pairs_query = select(func.count(MatchPairModel.id)).join(AnalysisHistoryModel, MatchPairModel.analysis_id == AnalysisHistoryModel.id).where(AnalysisHistoryModel.owner_id == user.id)
    if latest_analysis is not None:
        total_pairs_query = total_pairs_query.where(MatchPairModel.analysis_id == latest_analysis.id)
    total_pairs = db.execute(total_pairs_query).scalar_one()

    # -----------------------------------------------------------------------
    # Categories exclusives par enregistrement (compatibilite sans snapshot)
    # -----------------------------------------------------------------------

    if latest_analysis is not None:
        analysis_records = (
            db.query(DataRecordModel)
            .filter(DataRecordModel.owner_id == user.id, DataRecordModel.source_file.in_(latest_analysis.files or []))
            .all()
        )
        analysis_pairs = (
            db.query(MatchPairModel)
            .filter(MatchPairModel.analysis_id == latest_analysis.id)
            .all()
        )
        pair_results = [
            {
                "status": pair.status,
                "decision": pair.decision,
                "record_a_id": pair.record_a_id,
                "record_b_id": pair.record_b_id,
            }
            for pair in analysis_pairs
        ]
        duplicate_ids, uncertain_ids, different_ids = classify_record_ids(analysis_records, pair_results)
        duplicates_found = len(duplicate_ids)
        uncertain_cases = len(uncertain_ids)
        different_count = len(different_ids)
    else:
        duplicates_found = 0
        uncertain_cases = 0
        different_count = 0

    # -----------------------------------------------------------------------
    # CAS EN ATTENTE D'ARBITRAGE
    # -----------------------------------------------------------------------

    if latest_analysis is not None:
        arbitration_rows = (
            db.query(MatchPairModel)
            .filter(MatchPairModel.analysis_id == latest_analysis.id)
            .all()
        )
        pending_arbitration = len(pending_arbitration_results(arbitration_rows))
    else:
        pending_arbitration = 0

    # -----------------------------------------------------------------------
    # TAUX DE CONCORDANCE PAR ATTRIBUT
    # -----------------------------------------------------------------------
    #
    # Les valeurs sont calculées directement à partir de la table
    # field_comparisons.
    #
    # AVG(similarity) permet d'obtenir la moyenne réelle de similarité
    # pour chaque attribut.
    #
    # Si aucune comparaison n'existe encore, la valeur retournée est 0.
    #

    attribute_query = (
        select(
            FieldComparisonModel.field,
            func.avg(FieldComparisonModel.similarity),
        )
        .join(
            MatchPairModel,
            MatchPairModel.id == FieldComparisonModel.match_id,
        )
        .join(AnalysisHistoryModel, MatchPairModel.analysis_id == AnalysisHistoryModel.id)
        .where(AnalysisHistoryModel.owner_id == user.id)
    )
    if latest_analysis is not None:
        attribute_query = attribute_query.where(MatchPairModel.analysis_id == latest_analysis.id)

    attribute_rows = db.execute(
        attribute_query.group_by(FieldComparisonModel.field)
    ).all()

    # -----------------------------------------------------------------------
    # CONVERSION DES MOYENNES EN DICTIONNAIRE
    # -----------------------------------------------------------------------

    attribute_rates = {}

    for row in attribute_rows:
        field_name = row[0]
        average_similarity = row[1]

        if average_similarity is None:
            attribute_rates[field_name] = 0
        else:
            attribute_rates[field_name] = round(
                float(average_similarity)
            )

    # -----------------------------------------------------------------------
    # LISTE DES ATTRIBUTS AFFICHÉS DANS LA PAGE STATISTIQUES
    # -----------------------------------------------------------------------

    attribute_concordance = [
        schemas.AttributeConcordance(
            field="nom",
            rate=attribute_rates.get("nom", 0),
        ),

        schemas.AttributeConcordance(
            field="telephone",
            rate=attribute_rates.get("telephone", 0),
        ),

        schemas.AttributeConcordance(
            field="ville",
            rate=attribute_rates.get("ville", 0),
        ),

        schemas.AttributeConcordance(
            field="adresse",
            rate=attribute_rates.get("adresse", 0),
        ),

        schemas.AttributeConcordance(
            field="email",
            rate=attribute_rates.get("email", 0),
        ),
    ]

    # -----------------------------------------------------------------------
    # RÉPONSE
    # -----------------------------------------------------------------------

    return schemas.DashboardStats(
        totalFiles=total_files,
        totalRecords=total_records,
        totalPairs=total_pairs,
        duplicatesFound=duplicates_found,
        uncertainCases=uncertain_cases,
        differentCount=different_count,
        pendingArbitrationCount=pending_arbitration,
        attributeConcordance=attribute_concordance,
    )