"""
Lecture et normalisation des fichiers CSV / XLSX / XLS importés,
à l'aide de pandas.

Les colonnes du fichier source sont mises en correspondance
avec le modèle DataRecord :

nom, prenom, email, telephone, adresse, ville.

Les téléphones sont normalisés afin de conserver un format
malgache cohérent.
"""

from __future__ import annotations

import io
import re
import unicodedata
import zipfile
from datetime import datetime

import pandas as pd


COLUMN_ALIASES: dict[str, list[str]] = {
    "nom": [
        "nom",
        "name",
        "nom complet",
        "fullname",
        "full name",
        "nom prenom",
        "client",
    ],
    "prenom": [
        "prenom",
        "firstname",
        "first name",
    ],
    "date_naissance": [
        "date naissance",
        "date de naissance",
        "naissance",
        "birth date",
        "date of birth",
        "dob",
    ],
    "cin": [
        "cin",
        "numero cin",
        "numero de cin",
        "n cin",
        "no cin",
        "cin n",
        "numero carte identite",
        "carte nationale identite",
        "numero identite",
        "numero d identite",
        "n identite",
        "numero identification",
        "numero d identification",
        "identity card number",
        "identity number",
        "national id",
        "national id number",
        "national identity number",
        "id card number",
        "id number",
    ],
    "email": [
        "email",
        "mail",
        "e mail",
        "courriel",
        "adresse email",
        "adresse mail",
    ],
    "telephone": [
        "telephone",
        "tel",
        "phone",
        "numero",
        "contact",
        "mobile",
    ],
    "adresse": [
        "adresse",
        "address",
        "adress",
    ],
    "ville": [
        "ville",
        "city",
        "commune",
        "localite",
    ],
}


def _strip_accents(text: str) -> str:
    """Supprime les accents d'un texte."""
    normalized = unicodedata.normalize("NFKD", text)

    return "".join(
        char
        for char in normalized
        if not unicodedata.combining(char)
    )


def _normalize_col(col: str) -> str:
    """Normalise le nom d'une colonne, y compris sa ponctuation."""
    normalized = _strip_accents(str(col)).strip().lower()
    return re.sub(r"[^a-z0-9]+", " ", normalized).strip()


def _map_columns(columns: list[str]) -> dict[str, str]:
    """Associe les champs du système aux colonnes du fichier."""

    normalized_cols = {
        original: _normalize_col(original)
        for original in columns
    }

    mapping: dict[str, str] = {}

    for field, aliases in COLUMN_ALIASES.items():

        normalized_aliases = {
            _normalize_col(alias)
            for alias in aliases
        }

        compact_aliases = {
            alias.replace(" ", "")
            for alias in normalized_aliases
        }

        for original, normalized in normalized_cols.items():

            matches = normalized in normalized_aliases
            if field == "date_naissance":
                # Accepte aussi les variantes camelCase et les unités ajoutées
                # dans les en-têtes (ex. dateNaissance, Date de naissance (JJ/MM/AAAA)).
                compact_normalized = normalized.replace(" ", "")
                matches = (
                    matches
                    or compact_normalized in compact_aliases
                    or any(normalized.startswith(alias + " ") for alias in normalized_aliases)
                )

            if matches:
                mapping[field] = original
                break

    return mapping


def _normalize_birth_date(value: str | None) -> str | None:
    """Return common date formats as ISO text while keeping unknown values."""
    raw = str(value or "").strip()
    if not raw:
        return None
    formats = (
        "%Y-%m-%d",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y%m%d",
        "%d/%m/%Y",
        "%d/%m/%y",
        "%d-%m-%Y",
        "%d-%m-%y",
        "%d.%m.%Y",
        "%Y/%m/%d",
    )
    for date_format in formats:
        try:
            return datetime.strptime(raw, date_format).date().isoformat()
        except ValueError:
            continue
    return raw


def _normalize_phone(value: str | None) -> str:
    """
    Normalise un numéro de téléphone malgache.

    Exemples :

    0341234567      -> 0341234567
    341234567       -> 0341234567
    +261341234567   -> 0341234567
    261341234567    -> 0341234567
    034 12 34 567   -> 0341234567
    034-12-34-567   -> 0341234567

    Si la valeur ne correspond pas à un numéro malgache
    identifiable, elle est simplement nettoyée sans
    inventer de chiffres.
    """

    if value is None:
        return ""

    text = str(value).strip()

    if not text:
        return ""

    # Supprime les espaces, tirets, parenthèses, etc.
    digits = re.sub(r"\D", "", text)

    if not digits:
        return ""

    # Format international malgache :
    # +261 34 xxx xx xx
    if digits.startswith("261"):
        local_number = digits[3:]

        if len(local_number) == 9 and local_number.startswith(
            ("32", "33", "34")
        ):
            return "0" + local_number

    # Format local sans le 0 :
    # 34 xxx xx xx
    if len(digits) == 9 and digits.startswith(
        ("32", "33", "34")
    ):
        return "0" + digits

    # Format local normal :
    # 032..., 033..., 034...
    if len(digits) == 10 and digits.startswith(
        ("032", "033", "034")
    ):
        return digits

    # Si le numéro ne correspond pas aux formats
    # malgaches attendus, on conserve seulement les chiffres.
    return digits


def read_tabular_file(
    filename: str,
    content: bytes,
) -> pd.DataFrame:
    """
    Lit un fichier CSV, XLSX ou XLS.

    Toutes les colonnes sont lues comme texte afin de
    conserver les zéros situés au début des valeurs.
    """

    if "." not in filename:
        raise ValueError(
            "Le fichier ne possède pas d'extension."
        )

    ext = filename.rsplit(".", 1)[-1].lower()

    if ext == "csv":
        encodings = ("utf-8-sig", "cp1252", "latin1")

        for encoding in encodings:
            for sep in (",", ";", "\t"):
                try:
                    df = pd.read_csv(
                        io.BytesIO(content),
                        sep=sep,
                        encoding=encoding,
                        dtype=str,
                        keep_default_na=False,
                    )
                except UnicodeDecodeError:
                    break
                except (pd.errors.ParserError, ValueError):
                    continue

                if df.shape[1] > 1:
                    return df

        for encoding in encodings:
            try:
                return pd.read_csv(
                    io.BytesIO(content),
                    sep=None,
                    engine="python",
                    encoding=encoding,
                    dtype=str,
                    keep_default_na=False,
                )
            except UnicodeDecodeError:
                continue
            except (pd.errors.ParserError, ValueError):
                continue

        raise ValueError("Impossible de lire le fichier CSV avec les encodages pris en charge.")

    if ext in ("xlsx", "xls"):
        legacy_xls_signature = bytes.fromhex("D0 CF 11 E0 A1 B1 1A E1")
        is_ooxml = zipfile.is_zipfile(io.BytesIO(content))
        is_legacy_xls = content.startswith(legacy_xls_signature)
        if is_ooxml:
            engine = "openpyxl"
        elif is_legacy_xls:
            engine = "xlrd"
        elif ext == "xls":
            engine = "xlrd"
        else:
            raise ValueError(
                "Le contenu ne correspond ni a un classeur .xlsx valide "
                "ni a un ancien classeur .xls. Verifiez le fichier et son extension."
            )
        return pd.read_excel(
            io.BytesIO(content),
            dtype=str,
            engine=engine,
        )

    raise ValueError(
        f"Format de fichier non supporté : .{ext}"
    )


def parse_records(
    filename: str,
    content: bytes,
) -> tuple[list[dict], int, list[str]]:
    """
    Parse un fichier importé.

    Retourne :
    - la liste des enregistrements ;
    - le nombre de lignes réellement lues.
    """

    df = read_tabular_file(
        filename,
        content,
    )

    # Supprime les lignes complètement vides.
    df = df.dropna(how="all")

    source_columns = [str(column) for column in df.columns]
    mapping = _map_columns(source_columns)
    cin_column = mapping.get("cin")

    records: list[dict] = []

    for _, row in df.iterrows():

        telephone = _cell(
            row,
            mapping.get("telephone"),
        )

        record = {
            "nom": (
                _cell(
                    row,
                    mapping.get("nom"),
                )
                or "Contact inconnu"
            ),
            "prenom": _cell(
                row,
                mapping.get("prenom"),
            ),
            "date_naissance": _normalize_birth_date(_cell(row, mapping.get("date_naissance"))),
            "cin": _cell(row, mapping.get("cin")),
            "email": (
                _cell(
                    row,
                    mapping.get("email"),
                )
                or ""
            ),
            "telephone": _normalize_phone(
                telephone
            ),
            "adresse": (
                _cell(
                    row,
                    mapping.get("adresse"),
                )
                or ""
            ),
            "ville": (
                _cell(
                    row,
                    mapping.get("ville"),
                )
                or ""
            ),
            "sourceFile": filename,
            "sourceValues": {
                column: (
                    "****" + (str(_cell(row, column))[-4:] if len(str(_cell(row, column))) > 4 else "")
                    if column == cin_column and _cell(row, column)
                    else (_cell(row, column) or "")
                )
                for column in source_columns
            },
        }

        # Ignore les lignes complètement vides.
        if any(
            value
            for key, value in record.items()
            if key != "sourceFile"
        ):
            records.append(record)

    return records, len(df), source_columns


def _cell(
    row: pd.Series,
    column: str | None,
) -> str | None:
    """
    Récupère proprement la valeur d'une cellule.

    Retourne None si la colonne ou la valeur est absente.
    """

    if not column or column not in row:
        return None

    value = row[column]

    if pd.isna(value):
        return None

    text = str(value).strip()

    return text or None
