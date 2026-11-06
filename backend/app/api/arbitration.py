from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.core.utils import format_time_fr
from app.db.database import get_db
from app.core.security import get_current_user
from app.models.models import MatchPairModel, AnalysisSnapshotModel, AnalysisHistoryModel, UserModel
from app.schemas import schemas
from app.services.result_classification import classify_record_ids, pending_arbitration_results
from app.api.analysis import _load_matches, match_to_schema


router = APIRouter(
    prefix="/api/arbitration",
    tags=["Arbitrage"],
)


def _update_snapshot_counts(snapshot: AnalysisSnapshotModel) -> None:
    payload = snapshot.payload
    results = payload.get("results", [])
    records = payload.get("records", [])
    duplicate_ids, uncertain_ids, different_ids = classify_record_ids(records, results)
    total = len(records)
    if len(duplicate_ids) + len(uncertain_ids) + len(different_ids) != total:
        raise HTTPException(status_code=500, detail="Les cat?gories ne couvrent pas exactement les enregistrements analys?s.")
    payload["differentRecords"] = [record for record in records if str(record.get("id")) in different_ids]
    stats = payload.setdefault("stats", {})
    stats.update({"duplicatesFound": len(duplicate_ids), "uncertainCases": len(uncertain_ids), "differentCount": len(different_ids), "categorizedTotal": total})
    stats["pendingArbitrationCount"] = len(pending_arbitration_results(results))
    analysis = payload.get("analysis", {})
    analysis.update({"duplicatesFound": len(duplicate_ids), "uncertainCases": len(uncertain_ids), "differentCount": len(different_ids)})
    payload["analysis"] = analysis
    snapshot.payload = payload
    flag_modified(snapshot, "payload")


def _sync_snapshot_match(db: Session, row: MatchPairModel) -> None:
    if not row.analysis_id:
        return
    snapshot = db.get(AnalysisSnapshotModel, row.analysis_id)
    if snapshot is None:
        return
    for match in snapshot.payload.get("results", []):
        if match.get("id") == row.id:
            match["decision"] = row.decision
            match["decisionDate"] = row.decision_date
            match["status"] = row.status
            match["statusLabel"] = row.status_label
            break
    _update_snapshot_counts(snapshot)
    history = db.get(AnalysisHistoryModel, row.analysis_id)
    if history is not None:
        history.duplicates_found = snapshot.payload["stats"]["duplicatesFound"]
        history.uncertain_cases = snapshot.payload["stats"]["uncertainCases"]
        history.different_count = snapshot.payload["stats"]["differentCount"]


STATUS_LABELS = {
    "confirmed": "Doublon probable",
    "rejected": "Diff\u00e9rent",
}

@router.post(
    "/reset",
    response_model=list[schemas.MatchPair],
)
def reset_arbitration(
    analysis_id: str | None = None,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    """
    Réinitialise l'arbitrage de toutes
    les correspondances incertaines.
    """

    if not analysis_id:
        latest_analysis = db.execute(
            select(AnalysisHistoryModel)
            .where(AnalysisHistoryModel.owner_id == user.id)
            .order_by(AnalysisHistoryModel.created_at.desc())
            .limit(1)
        ).scalar_one_or_none()
        if latest_analysis is None:
            return []
        analysis_id = latest_analysis.id

    query = select(MatchPairModel).join(AnalysisHistoryModel, MatchPairModel.analysis_id == AnalysisHistoryModel.id).where(
        MatchPairModel.decision.is_not(None), AnalysisHistoryModel.owner_id == user.id
    )
    query = query.where(MatchPairModel.analysis_id == analysis_id)
    rows = db.execute(query).scalars().all()

    for row in rows:
        row.decision = None
        row.decision_date = None
        row.status = "uncertain"
        row.status_label = "Cas incertain"
        _sync_snapshot_match(db, row)

    db.commit()

    return _load_matches(
        db,
        [row.id for row in rows],
        owner_id=user.id,
    )


@router.post(
    "/{match_id}",
    response_model=schemas.MatchPair,
)
def arbitrate(
    match_id: str,
    payload: schemas.ArbitrationRequest,
    analysis_id: str | None = None,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    match_row = db.query(MatchPairModel).join(AnalysisHistoryModel, MatchPairModel.analysis_id == AnalysisHistoryModel.id).filter(MatchPairModel.id == match_id, AnalysisHistoryModel.owner_id == user.id).first()

    if not match_row or (analysis_id and match_row.analysis_id != analysis_id):
        raise HTTPException(
            status_code=404,
            detail="Correspondance introuvable dans cette analyse.",
        )

    if match_row.status != "uncertain" or match_row.decision is not None:
        if match_row.decision == payload.decision:
            return match_to_schema(match_row)
        raise HTTPException(status_code=409, detail="Cette correspondance a déjà été traitée.")
    match_row.decision = payload.decision
    match_row.decision_date = format_time_fr()
    match_row.status = "duplicate" if payload.decision == "confirmed" else "different"
    match_row.status_label = STATUS_LABELS[
        payload.decision
    ]
    _sync_snapshot_match(db, match_row)

    db.commit()

    matches = _load_matches(
        db,
        [match_id],
        owner_id=user.id,
    )

    if not matches:
        raise HTTPException(
            status_code=404,
            detail="Correspondance introuvable.",
        )

    return matches[0]