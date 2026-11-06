"""Record-level result categories with an exhaustive coverage check."""


def _value(item, *names, default=None):
    for name in names:
        if isinstance(item, dict) and name in item:
            return item[name]
        value = getattr(item, name, None)
        if value is not None:
            return value
    return default


def _record_ids(result):
    ids = set()
    for side, snake_side in (("recordA", "record_a"), ("recordB", "record_b")):
        nested = _value(result, side, default={}) or {}
        record_id = _value(nested, "id") or _value(result, f"{snake_side}_id")
        if record_id is not None:
            ids.add(str(record_id))
    return ids


def pending_arbitration_results(results):
    """Return one best pending candidate per unresolved record in this analysis."""
    duplicate_ids = set()
    resolved_ids = set()
    for result in results:
        status = _value(result, "status")
        decision = _value(result, "decision")
        ids = _record_ids(result)
        if decision:
            resolved_ids.update(ids)
        if status == "duplicate" or (status == "uncertain" and decision == "confirmed"):
            duplicate_ids.update(ids)

    candidates = [
        result
        for result in results
        if _value(result, "status") == "uncertain" and not _value(result, "decision")
    ]

    def score(result):
        try:
            return float(_value(result, "score", default=0) or 0)
        except (TypeError, ValueError):
            return 0.0

    candidates.sort(key=score, reverse=True)
    selected = []
    assigned_ids = set()
    for result in candidates:
        available_ids = _record_ids(result) - duplicate_ids - resolved_ids
        if not available_ids - assigned_ids:
            continue
        selected.append(result)
        assigned_ids.update(available_ids)
    return selected


def classify_record_ids(records, results):
    """Return disjoint duplicate, uncertain and different record ID sets."""
    all_ids = {str(_value(record, "id")) for record in records}
    duplicate_ids = set()
    pending_ids = set()
    resolved_ids = set()

    for result in results:
        status = _value(result, "status")
        decision = _value(result, "decision")
        ids = _record_ids(result) & all_ids
        if decision:
            resolved_ids.update(ids)
        if status == "duplicate" or (status == "uncertain" and decision == "confirmed"):
            duplicate_ids.update(ids)
        elif status == "uncertain" and not decision:
            pending_ids.update(ids)

    uncertain_ids = pending_ids - duplicate_ids - resolved_ids
    different_ids = all_ids - duplicate_ids - uncertain_ids
    categories = (duplicate_ids, uncertain_ids, different_ids)
    covered = set().union(*categories)
    if covered != all_ids or sum(map(len, categories)) != len(all_ids):
        raise ValueError("La classification des résultats ne couvre pas exactement les enregistrements analysés.")
    return duplicate_ids, uncertain_ids, different_ids


def classify_records(records, results):
    duplicate_ids, uncertain_ids, different_ids = classify_record_ids(records, results)
    return (
        [record for record in records if str(_value(record, "id")) in duplicate_ids],
        [record for record in records if str(_value(record, "id")) in uncertain_ids],
        [record for record in records if str(_value(record, "id")) in different_ids],
    )