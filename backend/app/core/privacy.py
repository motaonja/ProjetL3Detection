from __future__ import annotations


def mask_cin(value: str | None) -> str | None:
    """Return a stable mask that never reveals a short CIN in full."""
    if not value:
        return None
    raw = str(value)
    if raw.startswith("****"):
        return raw
    return "****" + (raw[-4:] if len(raw) > 4 else "")


def sanitize_cin_payload(value):
    """Mask CIN values recursively in API payloads and legacy snapshots."""
    if isinstance(value, list):
        return [sanitize_cin_payload(item) for item in value]
    if not isinstance(value, dict):
        return value

    field_name = value.get("field")
    safe = {}
    for key, item in value.items():
        if key == "numero_cin":
            if item:
                safe["cin"] = mask_cin(item)
            continue
        if key == "cin":
            safe[key] = mask_cin(item) if item else item
        elif field_name in {"cin", "numero_cin"} and key in {"valA", "valB", "val_a", "val_b"}:
            safe[key] = mask_cin(item) if item else item
        else:
            safe[key] = sanitize_cin_payload(item)
    if safe.get("field") == "numero_cin":
        safe["field"] = "cin"
    return safe


def restore_personal_fields(payload, db, owner_id: str):
    """Restore CIN and birth-date fields in historical snapshots from owned records."""
    from app.models.models import DataRecordModel

    def collect_ids(value):
        found = set()
        if isinstance(value, list):
            for item in value:
                found.update(collect_ids(item))
        elif isinstance(value, dict):
            if value.get("id"):
                found.add(str(value["id"]))
            for item in value.values():
                found.update(collect_ids(item))
        return found

    ids = collect_ids(payload)
    if not ids:
        return payload
    rows = db.query(DataRecordModel).filter(
        DataRecordModel.owner_id == owner_id,
        DataRecordModel.id.in_(ids),
    ).all()
    by_id = {str(row.id): row for row in rows}

    def restore(value):
        if isinstance(value, list):
            for item in value:
                restore(item)
        elif isinstance(value, dict):
            row = by_id.get(str(value.get("id", "")))
            if row is not None:
                value["cin"] = getattr(row, "cin", None) or getattr(row, "numero_cin", None)
                value["date_naissance"] = getattr(row, "date_naissance", None)
            for item in value.values():
                restore(item)
            record_a = value.get("recordA") or {}
            record_b = value.get("recordB") or {}
            comparisons = value.get("fieldComparisons") or []
            for comparison in comparisons:
                if comparison.get("field") in {"cin", "numero_cin"}:
                    comparison["valA"] = record_a.get("cin") or ""
                    comparison["valB"] = record_b.get("cin") or ""

    restore(payload)
    return payload
