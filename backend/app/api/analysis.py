from collections import defaultdict
from copy import deepcopy
from datetime import datetime
from time import perf_counter

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.security import get_current_user
from app.core.privacy import restore_personal_fields
from app.models.models import (
    AnalysisHistoryModel,
    AnalysisSnapshotModel,
    UploadedFileModel,
    DataRecordModel,
    FieldComparisonModel,
    MatchPairModel,
    UserModel,
)
from app.schemas.schemas import (
    AnalysisHistoryItem,
    AnalysisRunRequest,
    AnalysisRunResponse,
    DataRecord,
    FieldComparison,
    MatchPair,
)
from app.services.result_classification import classify_records, classify_record_ids, pending_arbitration_results
from app.services.matching import (
    find_cross_file_matches,
    find_matches,
)

router = APIRouter(
    prefix="/api/analysis",
    tags=["Analyse"],
)


# ---------------------------------------------------------------------------
# Conversion des enregistrements
# ---------------------------------------------------------------------------

def record_to_schema(record: DataRecordModel) -> DataRecord:
    return DataRecord(
        id=record.id,
        nom=record.nom,
        prenom=record.prenom,
        date_naissance=getattr(record, "date_naissance", None),
        cin=getattr(record, "cin", None) or getattr(record, "numero_cin", None),
        email=record.email,
        telephone=record.telephone,
        adresse=record.adresse,
        ville=record.ville,
        sourceFile=record.source_file,
    )


def record_to_dict(record: DataRecordModel) -> dict:
    return {
        "id": record.id,
        "nom": record.nom,
        "prenom": record.prenom,
        "date_naissance": getattr(record, "date_naissance", None),
        "cin": getattr(record, "cin", None) or getattr(record, "numero_cin", None),
        "email": record.email,
        "telephone": record.telephone,
        "adresse": record.adresse,
        "ville": record.ville,
        "source_file": record.source_file,
        "file_id": record.file_id,
    }


def uploaded_file_to_dict(file: UploadedFileModel) -> dict:
    return {
        "id": file.id,
        "name": file.name,
        "size": file.size,
        "sizeBytes": file.size_bytes,
        "format": file.format,
        "rowCount": file.row_count,
        "uploadDate": file.upload_date,
    }


# ---------------------------------------------------------------------------
# Lecture compatible des résultats du moteur de rapprochement
# ---------------------------------------------------------------------------

def get_result_value(result, name: str, default=None):
    """
    Permet de lire un résultat sous forme de dictionnaire
    ou d'objet MatchResult.
    """
    if isinstance(result, dict):
        return result.get(name, default)

    return getattr(result, name, default)


def get_record_value(record, name: str, default=None):
    """
    Permet de lire un enregistrement sous forme de dictionnaire
    ou d'objet.
    """
    if isinstance(record, dict):
        return record.get(name, default)

    return getattr(record, name, default)


def get_comparison_value(comparison, name: str, default=None):
    """
    Permet de lire une comparaison sous forme de dictionnaire
    ou d'objet.
    """
    if isinstance(comparison, dict):
        return comparison.get(name, default)

    return getattr(comparison, name, default)


# ---------------------------------------------------------------------------
# Conversion des comparaisons
# ---------------------------------------------------------------------------

def field_comparison_to_schema(
    comparison: FieldComparisonModel,
    record_a: DataRecordModel | None = None,
    record_b: DataRecordModel | None = None,
) -> FieldComparison:
    is_cin = comparison.field in {"cin", "numero_cin"}
    val_a = (getattr(record_a, "cin", None) or getattr(record_a, "numero_cin", None)) if is_cin and record_a else comparison.val_a
    val_b = (getattr(record_b, "cin", None) or getattr(record_b, "numero_cin", None)) if is_cin and record_b else comparison.val_b
    return FieldComparison(
        field="cin" if comparison.field == "numero_cin" else comparison.field,
        label=comparison.label,
        valA="" if val_a is None else str(val_a),
        valB="" if val_b is None else str(val_b),
        isMatch=comparison.is_match,
        similarity=comparison.similarity,
    )


# ---------------------------------------------------------------------------
# Conversion d'une paire enregistrée en base
# ---------------------------------------------------------------------------

def match_to_schema(match: MatchPairModel) -> MatchPair:
    return MatchPair(
        id=match.id,
        recordA=record_to_schema(match.record_a),
        recordB=record_to_schema(match.record_b),
        score=match.score,
        status=match.status,
        statusLabel=("Diff\u00e9rent" if match.status == "different" else match.status_label),
        decision=match.decision,
        decisionDate=match.decision_date,
        fieldComparisons=[
            field_comparison_to_schema(comparison, match.record_a, match.record_b)
            for comparison in match.field_comparisons
        ],
    )


# ---------------------------------------------------------------------------
# Chargement des correspondances
# ---------------------------------------------------------------------------

def _load_matches(
    db: Session,
    match_ids: list[str] | None = None,
    owner_id: str | None = None,
) -> list[MatchPair]:

    query = db.query(MatchPairModel)
    if owner_id is not None:
        query = query.join(AnalysisHistoryModel, MatchPairModel.analysis_id == AnalysisHistoryModel.id).filter(AnalysisHistoryModel.owner_id == owner_id)

    if match_ids is not None:
        if not match_ids:
            return []

        query = query.filter(
            MatchPairModel.id.in_(match_ids)
        )

    rows = (
        query
        .order_by(MatchPairModel.score.desc())
        .all()
    )

    return [
        match_to_schema(row)
        for row in rows
    ]


# ---------------------------------------------------------------------------
# Calcul des enregistrements différents
# ---------------------------------------------------------------------------

def calculate_different_records(records_db: list[DataRecordModel], all_results: list) -> list[DataRecord]:
    """Return records classified as different by the exhaustive record classifier."""
    _, _, different = classify_records(records_db, all_results)
    return [record_to_schema(record) for record in different]


# ---------------------------------------------------------------------------
# Lancer une analyse
# ---------------------------------------------------------------------------

@router.post(
    "/run",
    response_model=AnalysisRunResponse,
)
def run_analysis(
    payload: AnalysisRunRequest,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    start_time = perf_counter()

    # -----------------------------------------------------------------------
    # Vérification des fichiers sélectionnés
    # -----------------------------------------------------------------------

    if not payload.session_id:
        raise HTTPException(status_code=400, detail="An import session is required.")

    session_files = (
        db.query(UploadedFileModel)
        .filter(
            UploadedFileModel.owner_id == user.id,
            UploadedFileModel.session_id == payload.session_id,
            UploadedFileModel.session_completed.is_(False),
        )
        .with_for_update()
        .all()
    )
    if not session_files:
        raise HTTPException(status_code=409, detail="This session is completed or has no new files.")

    selected_file_ids = [file.id for file in session_files]
    selected_file_id_set = {str(file_id) for file_id in selected_file_ids}

    records_db = (
        db.query(DataRecordModel)
        .filter(
            DataRecordModel.owner_id == user.id,
            DataRecordModel.file_id.in_(selected_file_ids)
        )
        .all()
    )

    if not records_db:
        raise HTTPException(
            status_code=400,
            detail=(
                "Aucune donnée disponible dans les "
                "fichiers sélectionnés."
            ),
        )

    # -----------------------------------------------------------------------
    # Regroupement par fichier
    # -----------------------------------------------------------------------

    records_by_file: dict[str, list[dict]] = defaultdict(list)

    for record in records_db:

        file_key = (
            str(record.file_id)
            if record.file_id is not None
            else str(record.source_file)
        )

        records_by_file[file_key].append(
            record_to_dict(record)
        )

    file_groups = list(
        records_by_file.values()
    )

    # -----------------------------------------------------------------------
    # Recherche des correspondances
    # -----------------------------------------------------------------------

    all_results: list = []

    # Un seul fichier :
    # comparaison à l'intérieur du même fichier.

    if len(file_groups) == 1:

        all_results = find_matches(
            file_groups[0]
        )

    # Plusieurs fichiers :
    # comparaison entre fichiers différents.

    else:

        for index_a in range(
            len(file_groups)
        ):

            for index_b in range(
                index_a + 1,
                len(file_groups),
            ):

                results = find_cross_file_matches(
                    file_groups[index_a],
                    file_groups[index_b],
                )

                all_results.extend(results)

    # -----------------------------------------------------------------------
    # Séparation doublons / incertains
    # -----------------------------------------------------------------------

    duplicate_results = [
        result
        for result in all_results
        if get_result_value(
            result,
            "status",
        ) == "duplicate"
    ]

    uncertain_results = [
        result
        for result in all_results
        if get_result_value(
            result,
            "status",
        ) == "uncertain"
    ]

    # -----------------------------------------------------------------------
    # Calcul des différents
    # -----------------------------------------------------------------------

    duplicate_ids, uncertain_ids, different_ids = classify_record_ids(records_db, all_results)
    analyzed_ids = {str(record.id) for record in records_db}
    if duplicate_ids | uncertain_ids | different_ids != analyzed_ids or sum(map(len, (duplicate_ids, uncertain_ids, different_ids))) != len(records_db):
        raise HTTPException(status_code=500, detail="Les cat?gories ne couvrent pas exactement les enregistrements analys?s.")
    different_records = [record_to_schema(record) for record in records_db if str(record.id) in different_ids]

    # -----------------------------------------------------------------------
    # Création de l'historique
    # -----------------------------------------------------------------------

    execution_time = (
        perf_counter() - start_time
    )

    history = AnalysisHistoryModel(
        owner_id=user.id,
        date=datetime.now().astimezone().strftime(
            "%d/%m/%Y %H:%M"
        ),
        files=list(
            dict.fromkeys(
                record.source_file
                for record in records_db
                if record.source_file
            )
        ),
        total_records=len(records_db),
        duplicates_found=len(duplicate_ids),
        uncertain_cases=len(uncertain_ids),
        different_count=len(different_records),
        status="Termin\u00e9",
        execution_time=f"{execution_time:.2f}s",
    )

    db.add(history)
    db.flush()

    # -----------------------------------------------------------------------
    # Enregistrement des correspondances
    # -----------------------------------------------------------------------

    for result in all_results:

        status = get_result_value(
            result,
            "status",
        )

        # On enregistre uniquement les vraies correspondances.

        if status not in {
            "duplicate",
            "uncertain",
        }:
            continue

        # matching.py retourne record_a_id et record_b_id.

        record_a_id = get_result_value(
            result,
            "record_a_id",
        )

        record_b_id = get_result_value(
            result,
            "record_b_id",
        )

        if not record_a_id or not record_b_id:
            raise HTTPException(status_code=500, detail="Une correspondance produite par l?analyse ne r?f?rence pas ses deux enregistrements.")

        # Vérification que les deux enregistrements existent.

        record_a = (
            db.query(DataRecordModel)
            .filter(DataRecordModel.id == record_a_id, DataRecordModel.owner_id == user.id)
            .first()
        )

        record_b = (
            db.query(DataRecordModel)
            .filter(DataRecordModel.id == record_b_id, DataRecordModel.owner_id == user.id)
            .first()
        )

        if not record_a or not record_b or str(record_a.file_id) not in selected_file_id_set or str(record_b.file_id) not in selected_file_id_set:
            raise HTTPException(status_code=500, detail="Une correspondance r?f?rence un enregistrement absent des fichiers analys?s.")

        match_row = MatchPairModel(
            record_a_id=record_a.id,
            record_b_id=record_b.id,
            score=int(
                get_result_value(
                    result,
                    "score",
                    0,
                )
            ),
            status=status,
            status_label=get_result_value(
                result,
                "status_label",
                "Cas incertain",
            ),
            decision=None,
            decision_date=None,
            analysis_id=history.id,
        )

        db.add(match_row)
        db.flush()

        # -------------------------------------------------------------------
        # Enregistrement des comparaisons de champs
        # -------------------------------------------------------------------

        field_comparisons = get_result_value(
            result,
            "field_comparisons",
            [],
        )

        for comparison in field_comparisons:

            comparison_row = FieldComparisonModel(
                match_id=match_row.id,
                field=get_comparison_value(
                    comparison,
                    "field",
                    "",
                ),
                label=get_comparison_value(
                    comparison,
                    "label",
                    "",
                ),
                val_a=str(
                    get_comparison_value(
                        comparison,
                        "val_a",
                        "",
                    )
                ),
                val_b=str(
                    get_comparison_value(
                        comparison,
                        "val_b",
                        "",
                    )
                ),
                is_match=bool(
                    get_comparison_value(
                        comparison,
                        "is_match",
                        False,
                    )
                ),
                similarity=int(
                    get_comparison_value(
                        comparison,
                        "similarity",
                        0,
                    )
                ),
            )

            db.add(comparison_row)

    # -----------------------------------------------------------------------
    # Validation PostgreSQL
    # -----------------------------------------------------------------------

    for session_file in session_files:
        session_file.session_completed = True

    db.commit()

    # -----------------------------------------------------------------------
    # Rechargement des correspondances sauvegardées
    # -----------------------------------------------------------------------

    saved_rows = (
        db.query(MatchPairModel)
        .filter(
            MatchPairModel.analysis_id
            == history.id
        )
        .all()
    )

    saved_matches = _load_matches(
        db,
        [
            row.id
            for row in saved_rows
        ],
    )

    # -----------------------------------------------------------------------
    # Conversion de l'historique
    # -----------------------------------------------------------------------

    history_schema = AnalysisHistoryItem(
        id=history.id,
        date=history.date,
        files=history.files,
        totalRecords=history.total_records,
        duplicatesFound=history.duplicates_found,
        uncertainCases=history.uncertain_cases,
        differentCount=history.different_count,
        status=history.status,
        executionTime=history.execution_time,
        hasSnapshot=True,
    )

    uploaded_files = (
        db.query(UploadedFileModel)
        .filter(UploadedFileModel.id.in_(selected_file_ids), UploadedFileModel.owner_id == user.id)
        .all()
    )
    field_rates: dict[str, list[int]] = defaultdict(list)
    for saved_match in saved_matches:
        for comparison in saved_match.fieldComparisons:
            field_rates.setdefault(comparison.field, []).append(comparison.similarity)

    snapshot_stats = {
        "totalFiles": len(uploaded_files),
        "totalRecords": len(records_db),
        "totalPairs": len(saved_matches),
        "duplicatesFound": len(duplicate_ids),
        "uncertainCases": len(uncertain_ids),
        "differentCount": len(different_records),
        "categorizedTotal": len(duplicate_ids) + len(uncertain_ids) + len(different_records),
        "pendingArbitrationCount": len(pending_arbitration_results(all_results)),
        "attributeConcordance": [
            {"field": field, "rate": round(sum(values) / len(values)) if values else 0}
            for field, values in field_rates.items()
        ],
    }
    record_file_ids = {str(record.id): record.file_id for record in records_db}
    snapshot_results = []
    for match in saved_matches:
        match_data = match.model_dump(mode="json", by_alias=True)
        match_data["recordA"]["fileId"] = record_file_ids.get(str(match.recordA.id))
        match_data["recordB"]["fileId"] = record_file_ids.get(str(match.recordB.id))
        snapshot_results.append(match_data)

    snapshot_payload = {
        "analysis": history_schema.model_dump(mode="json", by_alias=True),
        "files": [uploaded_file_to_dict(file) for file in uploaded_files],
        "records": [
            {
                **record_to_schema(record).model_dump(mode="json", by_alias=True),
                "fileId": record.file_id,
            }
            for record in records_db
        ],
        "results": snapshot_results,
        "differentRecords": [
            {
                **record.model_dump(mode="json", by_alias=True),
                "fileId": record_file_ids.get(str(record.id)),
            }
            for record in different_records
        ],
        "stats": snapshot_stats,
    }
    db.add(AnalysisSnapshotModel(analysis_id=history.id, payload=snapshot_payload))
    db.commit()

    return AnalysisRunResponse(
        history=history_schema,
        matches=saved_matches,
        differentRecords=different_records,
    )


# ---------------------------------------------------------------------------
# Résultats
# ---------------------------------------------------------------------------

@router.get("/results")
def get_results(
    analysis_id: str | None = None,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
    if analysis_id:
        selected_analysis = db.query(AnalysisHistoryModel).filter(AnalysisHistoryModel.id == analysis_id, AnalysisHistoryModel.owner_id == user.id).first()
        if selected_analysis is None:
            raise HTTPException(status_code=404, detail="Analyse introuvable.")
    else:
        selected_analysis = (
            db.query(AnalysisHistoryModel)
            .filter(AnalysisHistoryModel.owner_id == user.id)
            .order_by(AnalysisHistoryModel.created_at.desc())
            .first()
        )

    if selected_analysis is None:
        return {
            "results": [],
            "differentRecords": [],
            "total": 0,
            "differentTotal": 0,
        }

    snapshot = db.get(AnalysisSnapshotModel, selected_analysis.id)
    if snapshot is not None:
        payload = restore_personal_fields(deepcopy(snapshot.payload), db, user.id)
        results = [dict(result) for result in payload.get("results", [])]
        current_pairs = db.query(MatchPairModel).filter(
            MatchPairModel.analysis_id == selected_analysis.id
        ).all()
        pairs_by_id = {pair.id: pair for pair in current_pairs}
        for result in results:
            pair = pairs_by_id.get(result.get("id"))
            if pair is not None:
                result["decision"] = pair.decision
                result["decisionDate"] = pair.decision_date
                result["status"] = pair.status
                result["statusLabel"] = "Diff\u00e9rent" if result.get("status") == "different" else pair.status_label
        records = payload.get("records", [])
        duplicate_ids, uncertain_ids, different_ids = classify_record_ids(records, results)
        different_records = [record for record in records if str(record.get("id")) in different_ids]
        total_records = len(records)
        if len(duplicate_ids) + len(uncertain_ids) + len(different_ids) != total_records:
            raise HTTPException(status_code=500, detail="Les cat?gories ne couvrent pas exactement les enregistrements analys?s.")
        return {
            "analysis_id": selected_analysis.id,
            "results": results,
            "differentRecords": different_records,
            "total": total_records,
            "differentTotal": len(different_records),
            "categoryCounts": {"duplicates": len(duplicate_ids), "uncertain": len(uncertain_ids), "different": len(different_ids), "total": total_records},
        }

    matches = _load_matches(db, [match.id for match in selected_analysis.matches], owner_id=user.id)
    analysis_file_names = selected_analysis.files or []
    analysis_records = (
        db.query(DataRecordModel)
        .filter(DataRecordModel.owner_id == user.id, DataRecordModel.source_file.in_(analysis_file_names))
        .all()
        if analysis_file_names
        else []
    )
    duplicate_ids, uncertain_ids, different_ids = classify_record_ids(analysis_records, matches)
    different_records = [record_to_schema(record) for record in analysis_records if str(record.id) in different_ids]
    total_records = len(analysis_records)
    if len(duplicate_ids) + len(uncertain_ids) + len(different_ids) != total_records:
        raise HTTPException(status_code=500, detail="Les cat?gories ne couvrent pas exactement les enregistrements analys?s.")
    return {
        "analysis_id": selected_analysis.id,
        "results": matches,
        "differentRecords": different_records,
        "total": total_records,
        "differentTotal": len(different_records),
        "categoryCounts": {"duplicates": len(duplicate_ids), "uncertain": len(uncertain_ids), "different": len(different_ids), "total": total_records},
    }


# ---------------------------------------------------------------------------
# Un résultat précis
# ---------------------------------------------------------------------------

@router.get(
    "/results/{match_id}",
    response_model=MatchPair,
)
def get_result(
    match_id: str,
    db: Session = Depends(get_db),
    user: UserModel = Depends(get_current_user),
):
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

