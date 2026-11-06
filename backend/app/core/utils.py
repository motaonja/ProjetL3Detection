from datetime import datetime, timezone, timedelta


MADAGASCAR_TZ = timezone(timedelta(hours=3))


def format_size(size_bytes: int) -> str:
    ko = size_bytes / 1024

    if ko > 1024:
        return f"{ko / 1024:.1f} Mo"

    return f"{round(ko)} Ko"


def format_datetime_fr(dt: datetime | None = None) -> str:
    if dt is None:
        dt = datetime.now(MADAGASCAR_TZ)
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc).astimezone(MADAGASCAR_TZ)
    else:
        dt = dt.astimezone(MADAGASCAR_TZ)

    return dt.strftime("%d/%m/%Y %H:%M")


def format_time_fr(dt: datetime | None = None) -> str:
    if dt is None:
        dt = datetime.now(MADAGASCAR_TZ)
    elif dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc).astimezone(MADAGASCAR_TZ)
    else:
        dt = dt.astimezone(MADAGASCAR_TZ)

    return dt.strftime("%H:%M")