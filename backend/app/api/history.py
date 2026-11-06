from datetime import datetime
from copy import deepcopy

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.db.database import get_db
from app.core.security import get_current_user
from app.core.privacy import restore_personal_fields
from app.models.models import UserModel
from app.models.models import AnalysisHistoryModel, AnalysisSnapshotModel, MatchPairModel
from app.schemas import schemas
from app.services.result_classification import classify_record_ids, pending_arbitration_results

router = APIRouter(prefix="/api/history", tags=["Historique"])


def _classified_record_counts(records, results):
    duplicate_ids, uncertain_ids, different_ids = classify_record_ids(records, results)
    return len(duplicate_ids), len(uncertain_ids), len(different_ids)


@router.get("", response_model=list[schemas.AnalysisHistoryItem])
def list_history(db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    rows = db.execute(
        select(AnalysisHistoryModel).where(AnalysisHistoryModel.owner_id == user.id).order_by(AnalysisHistoryModel.created_at.desc())
    ).scalars().all()
    analysis_ids = [row.id for row in rows]
    snapshots = db.execute(
        select(AnalysisSnapshotModel).where(
            AnalysisSnapshotModel.analysis_id.in_(analysis_ids)
        )
    ).scalars().all() if analysis_ids else []
    snapshot_by_id = {snapshot.analysis_id: snapshot for snapshot in snapshots}
    pairs = db.execute(
        select(MatchPairModel).where(MatchPairModel.analysis_id.in_(analysis_ids))
    ).scalars().all() if analysis_ids else []
    pairs_by_analysis = {}
    for pair in pairs:
        pairs_by_analysis.setdefault(pair.analysis_id, []).append(pair)

    items = []
    for row in rows:
        item = schemas.AnalysisHistoryItem.from_orm_history(row)
        snapshot = snapshot_by_id.get(row.id)
        if snapshot is not None:
            pairs_by_id = {
                pair.id: pair
                for pair in pairs_by_analysis.get(row.id, [])
            }
            results = []
            for archived_result in snapshot.payload.get("results", []):
                result = dict(archived_result)
                pair = pairs_by_id.get(result.get("id"))
                if pair is not None:
                    result["decision"] = pair.decision
                    result["status"] = pair.status
                results.append(result)
            records = snapshot.payload.get("records", [])
            duplicates, uncertain, different = _classified_record_counts(records, results)
            item.duplicatesFound = duplicates
            item.uncertainCases = uncertain
            item.differentCount = different
            item.hasSnapshot = True
        else:
            pair_results = [
                {
                    "status": pair.status,
                    "decision": pair.decision,
                    "record_a_id": pair.record_a_id,
                    "record_b_id": pair.record_b_id,
                }
                for pair in pairs_by_analysis.get(row.id, [])
            ]
            record_ids = {str(value) for pair in pairs_by_analysis.get(row.id, []) for value in (pair.record_a_id, pair.record_b_id) if value}
            duplicate_ids = set()
            uncertain_ids = set()
            for pair in pairs_by_analysis.get(row.id, []):
                ids = {str(value) for value in (pair.record_a_id, pair.record_b_id) if value}
                if pair.status == "duplicate" or (pair.status == "uncertain" and pair.decision == "confirmed"):
                    duplicate_ids.update(ids)
                elif pair.status == "uncertain" and not pair.decision:
                    uncertain_ids.update(ids)
            duplicate_ids &= record_ids
            uncertain_ids = (uncertain_ids - duplicate_ids) & record_ids
            item.duplicatesFound = len(duplicate_ids)
            item.uncertainCases = len(uncertain_ids)
            item.differentCount = max(0, row.total_records - len(duplicate_ids) - len(uncertain_ids))
            item.hasSnapshot = False
        items.append(item)
    return items


@router.get("/{history_id}")
def get_history_analysis(history_id: str, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    history = db.query(AnalysisHistoryModel).filter(AnalysisHistoryModel.id == history_id, AnalysisHistoryModel.owner_id == user.id).first()
    snapshot = db.get(AnalysisSnapshotModel, history_id) if history is not None else None
    if snapshot is None:
        raise HTTPException(
            status_code=404,
            detail="Cette analyse ne possede pas d'archive detaillee.",
        )

    payload = restore_personal_fields(deepcopy(snapshot.payload), db, user.id)
    results = [dict(result) for result in payload.get("results", [])]
    current_pairs = db.execute(
        select(MatchPairModel).where(MatchPairModel.analysis_id == history_id)
    ).scalars().all()
    pairs_by_id = {pair.id: pair for pair in current_pairs}
    for result in results:
        pair = pairs_by_id.get(result.get("id"))
        if pair is not None:
            result["decision"] = pair.decision
            result["decisionDate"] = pair.decision_date
            result["status"] = pair.status
            result["statusLabel"] = "Diff\u00e9rent" if result.get("status") == "different" else pair.status_label
    payload["results"] = results
    duplicate_ids, uncertain_ids, different_ids = classify_record_ids(payload.get("records", []), results)
    payload["differentRecords"] = [record for record in payload.get("records", []) if str(record.get("id")) in different_ids]
    stats = dict(payload.get("stats", {}))
    stats.update({"duplicatesFound": len(duplicate_ids), "uncertainCases": len(uncertain_ids), "differentCount": len(different_ids), "categorizedTotal": len(payload.get("records", []))})
    payload["stats"] = stats
    analysis = dict(payload.get("analysis", {}))
    analysis.update({"duplicatesFound": len(duplicate_ids), "uncertainCases": len(uncertain_ids), "differentCount": len(different_ids)})
    payload["analysis"] = analysis
    return payload


def _refresh_snapshot_counts(snapshot: AnalysisSnapshotModel) -> None:
    payload = snapshot.payload
    results = payload.get("results", [])
    records = payload.get("records", [])
    duplicate_ids, uncertain_ids, different_ids = classify_record_ids(records, results)
    total = len(records)
    if len(duplicate_ids) + len(uncertain_ids) + len(different_ids) != total:
        raise HTTPException(status_code=500, detail="Les cat?gories ne couvrent pas exactement les enregistrements analys?s.")
    payload["differentRecords"] = [record for record in records if str(record.get("id")) in different_ids]
    stats = payload.setdefault("stats", {})
    stats["duplicatesFound"] = len(duplicate_ids)
    stats["uncertainCases"] = len(uncertain_ids)
    stats["differentCount"] = len(different_ids)
    stats["categorizedTotal"] = total
    stats["pendingArbitrationCount"] = len(pending_arbitration_results(results))
    analysis = payload.get("analysis", {})
    analysis["duplicatesFound"] = len(duplicate_ids)
    analysis["uncertainCases"] = len(uncertain_ids)
    analysis["differentCount"] = len(different_ids)
    payload["analysis"] = analysis
    snapshot.payload = payload
    flag_modified(snapshot, "payload")


@router.post("/{history_id}/arbitration/{match_id}")
def arbitrate_history_match(
    history_id: str,
    match_id: str,
    payload: schemas.ArbitrationRequest,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    owned_history = db.query(AnalysisHistoryModel).filter(AnalysisHistoryModel.id == history_id, AnalysisHistoryModel.owner_id == user.id).first()
    snapshot = db.get(AnalysisSnapshotModel, history_id) if owned_history is not None else None
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Archive d'analyse introuvable.")

    results = snapshot.payload.get("results", [])
    match = next((row for row in results if row.get("id") == match_id), None)
    if match is None:
        raise HTTPException(status_code=404, detail="Correspondance introuvable dans cette analyse.")

    decision_date = datetime.now().astimezone().strftime("%d/%m/%Y %H:%M")
    status_labels = {
        "confirmed": "Doublon probable",
        "rejected": "Diff\u00e9rent",
    }
    if match.get("status") != "uncertain" or match.get("decision") is not None:
        if match.get("decision") == payload.decision:
            return restore_personal_fields({"results": [deepcopy(match)]}, db, user.id)["results"][0]
        raise HTTPException(status_code=409, detail="Cette correspondance a déjà été traitée.")
    match["decision"] = payload.decision
    match["decisionDate"] = decision_date
    match["status"] = "duplicate" if payload.decision == "confirmed" else "different"
    match["statusLabel"] = status_labels[payload.decision]

    pair = db.get(MatchPairModel, match_id)
    if pair is not None and pair.analysis_id == history_id:
        pair.decision = payload.decision
        pair.decision_date = decision_date
        pair.status = "duplicate" if payload.decision == "confirmed" else "different"
        pair.status_label = status_labels[payload.decision]

    _refresh_snapshot_counts(snapshot)
    history = db.get(AnalysisHistoryModel, history_id)
    if history is not None:
        history.duplicates_found = snapshot.payload["stats"]["duplicatesFound"]
        history.uncertain_cases = snapshot.payload["stats"]["uncertainCases"]
        history.different_count = snapshot.payload["stats"]["differentCount"]
    db.commit()
    return restore_personal_fields({"results": [deepcopy(match)]}, db, user.id)["results"][0]


@router.post("/{history_id}/arbitration/reset")
def reset_history_arbitration(history_id: str, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    owned_history = db.query(AnalysisHistoryModel).filter(AnalysisHistoryModel.id == history_id, AnalysisHistoryModel.owner_id == user.id).first()
    snapshot = db.get(AnalysisSnapshotModel, history_id) if owned_history is not None else None
    if snapshot is None:
        raise HTTPException(status_code=404, detail="Archive d'analyse introuvable.")

    changed_ids = []
    for match in snapshot.payload.get("results", []):
        if match.get("status") in {"uncertain", "duplicate", "different"} and match.get("decision"):
            match["decision"] = None
            match["decisionDate"] = None
            match["status"] = "uncertain"
            match["statusLabel"] = "Cas incertain"
            changed_ids.append(match.get("id"))

    for match_id in changed_ids:
        pair = db.get(MatchPairModel, match_id)
        if pair is not None and pair.analysis_id == history_id:
            pair.decision = None
            pair.decision_date = None
            pair.status = "uncertain"
            pair.status_label = "Cas incertain"

    _refresh_snapshot_counts(snapshot)
    history = db.get(AnalysisHistoryModel, history_id)
    if history is not None:
        history.duplicates_found = snapshot.payload["stats"]["duplicatesFound"]
        history.uncertain_cases = snapshot.payload["stats"]["uncertainCases"]
        history.different_count = snapshot.payload["stats"]["differentCount"]
    db.commit()
    return restore_personal_fields({"results": deepcopy(snapshot.payload.get("results", []))}, db, user.id)["results"]


@router.delete("/{history_id}")
def delete_history(history_id: str, db: Session = Depends(get_db), user: UserModel = Depends(get_current_user)):
    history = db.query(AnalysisHistoryModel).filter(AnalysisHistoryModel.id == history_id, AnalysisHistoryModel.owner_id == user.id).first()
    if history is None:
        raise HTTPException(status_code=404, detail="Session introuvable.")

    snapshot = db.get(AnalysisSnapshotModel, history_id)
    if snapshot is not None:
        db.delete(snapshot)
    db.delete(history)
    db.commit()
    return {"deleted": True, "id": history_id}
