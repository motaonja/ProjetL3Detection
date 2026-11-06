import re
import unicodedata
from datetime import datetime
from dataclasses import dataclass, field

import textdistance

from app.core.config import get_settings


# ============================================================
# NORMALISATION
# ============================================================

_WS_RE = re.compile(r"\s+")
_NON_ALNUM_RE = re.compile(r"[^a-z0-9\s]")
_NON_DIGIT_RE = re.compile(r"\D")


def strip_accents(value: str) -> str:
    value = str(value or "")

    return "".join(
        char
        for char in unicodedata.normalize("NFD", value)
        if unicodedata.category(char) != "Mn"
    )


def normalize_text(value: str) -> str:
    value = strip_accents(value).lower()
    value = _NON_ALNUM_RE.sub(" ", value)
    value = _WS_RE.sub(" ", value).strip()

    return value


def normalize_phone(value: str) -> str:
    value = str(value or "").strip()

    digits = _NON_DIGIT_RE.sub("", value)

    # Madagascar :
    # +261 34 12 345 67
    # 261 34 12 345 67
    # 034 12 345 67
    #
    # deviennent :
    # 341234567

    if digits.startswith("261"):
        digits = digits[3:]

    if digits.startswith("0"):
        digits = digits[1:]

    return digits


def normalize_email(value: str) -> str:
    return str(value or "").strip().lower()


def normalize_identifier(value: str) -> str:
    """Normalize an identity number while preserving its letters and digits."""
    return "".join(char for char in str(value or "").upper() if char.isalnum())


def normalize_birth_date(value: str) -> str:
    """Normalize common birth date formats without guessing unknown values."""
    raw = str(value or "").strip()
    for date_format in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M:%S.%f", "%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%Y/%m/%d"):
        try:
            return datetime.strptime(raw, date_format).date().isoformat()
        except ValueError:
            pass
    return raw


# ============================================================
# SOUNDEX / CODAGE PHONÉTIQUE
# ============================================================

_SOUNDEX_CODES = {
    **{c: "1" for c in "bfpv"},
    **{c: "2" for c in "cgjkqsxz"},
    **{c: "3" for c in "dt"},
    "l": "4",
    **{c: "5" for c in "mn"},
    "r": "6",
}


def soundex(value: str) -> str:
    value = normalize_text(value).replace(" ", "")

    if not value:
        return ""

    first_letter = value[0].upper()

    result = first_letter

    previous_code = _SOUNDEX_CODES.get(
        value[0],
        "",
    )

    for char in value[1:]:

        code = _SOUNDEX_CODES.get(
            char,
            "",
        )

        if code and code != previous_code:

            result += code

            if len(result) == 4:
                break

        previous_code = code

    return result.ljust(4, "0")


def phonetic_match(
    value_a: str,
    value_b: str,
) -> bool:

    a = normalize_text(value_a)
    b = normalize_text(value_b)

    if not a or not b:
        return False

    return soundex(a) == soundex(b)


# ============================================================
# SIMILARITÉ GÉNÉRALE
# ============================================================

def string_similarity(
    value_a: str,
    value_b: str,
) -> float:

    a = normalize_text(value_a)
    b = normalize_text(value_b)

    if not a or not b:
        return 0.0

    if a == b:
        return 1.0

    levenshtein = (
        textdistance.levenshtein.normalized_similarity(
            a,
            b,
        )
    )

    jaro_winkler = (
        textdistance.jaro_winkler.normalized_similarity(
            a,
            b,
        )
    )

    return (
        levenshtein * 0.5
        + jaro_winkler * 0.5
    )


# ============================================================
# NOM COMPLET
# ============================================================

def name_similarity(
    value_a: str,
    value_b: str,
) -> float:

    a = normalize_text(value_a)
    b = normalize_text(value_b)

    if not a or not b:
        return 0.0

    # Cas exactement identique.
    if a == b:
        return 1.0

    # --------------------------------------------------------
    # Comparaison directe
    # --------------------------------------------------------

    direct_score = string_similarity(
        a,
        b,
    )

    # --------------------------------------------------------
    # Comparaison avec ordre des mots ignoré
    #
    # Jean Rakoto
    # Rakoto Jean
    #
    # deviennent :
    #
    # Jean Rakoto
    # Jean Rakoto
    # --------------------------------------------------------

    sorted_a = " ".join(
        sorted(a.split())
    )

    sorted_b = " ".join(
        sorted(b.split())
    )

    sorted_score = string_similarity(
        sorted_a,
        sorted_b,
    )

    score = max(
        direct_score,
        sorted_score,
    )

    # --------------------------------------------------------
    # Renforcement phonétique
    # --------------------------------------------------------

    if phonetic_match(a, b):

        score = min(
            1.0,
            score + 0.08,
        )

    return score


# ============================================================
# TÉLÉPHONE
# ============================================================

def phone_similarity(
    value_a: str,
    value_b: str,
) -> float:

    a = normalize_phone(value_a)
    b = normalize_phone(value_b)

    if not a or not b:
        return 0.0

    if a == b:
        return 1.0

    return (
        textdistance.levenshtein.normalized_similarity(
            a,
            b,
        )
    )


# ============================================================
# ADRESSE
# ============================================================

def address_similarity(
    value_a: str,
    value_b: str,
) -> float:
    """
    Compare deux adresses.

    Une adresse peut être incomplète.

    Exemple :

        Adresse A : Ivato
        Adresse B : Lot 25 Ivato

    Le système considère alors que "Ivato" est
    contenu dans "Lot 25 Ivato" et donne une
    similarité élevée.

    Même principe pour :

        Ivato
        Lot 25 Ivato Antananarivo

    """

    a = normalize_text(value_a)
    b = normalize_text(value_b)

    if not a or not b:
        return 0.0

    # Adresse exactement identique.
    if a == b:
        return 1.0

    tokens_a = set(a.split())
    tokens_b = set(b.split())

    if not tokens_a or not tokens_b:
        return string_similarity(
            a,
            b,
        )

    # --------------------------------------------------------
    # Une adresse est contenue dans l'autre.
    #
    # Ivato
    # Lot 25 Ivato
    # --------------------------------------------------------

    if tokens_a.issubset(tokens_b):
        return 0.85

    if tokens_b.issubset(tokens_a):
        return 0.85

    # --------------------------------------------------------
    # Jaccard
    # --------------------------------------------------------

    intersection = len(
        tokens_a.intersection(tokens_b)
    )

    union = len(
        tokens_a.union(tokens_b)
    )

    jaccard = (
        intersection / union
        if union
        else 0.0
    )

    # --------------------------------------------------------
    # Similarité classique
    # --------------------------------------------------------

    normal_score = string_similarity(
        a,
        b,
    )

    return max(
        normal_score,
        jaccard,
    )


# ============================================================
# CHAMPS ET POIDS
# ============================================================

FIELD_WEIGHTS = [
    ("nom", "Nom complet", 0.245),
    ("email", "Email", 0.175),
    ("telephone", "T\u00e9l\u00e9phone", 0.14),
    ("adresse", "Adresse", 0.084),
    ("ville", "Ville", 0.056),
    ("date_naissance", "Date de naissance", 0.10),
    ("cin", "Num\u00e9ro CIN", 0.20),
]

FIELD_MATCH_THRESHOLD = 0.70


# ============================================================
# RÉSULTATS
# ============================================================

@dataclass
class FieldComparisonResult:

    field: str

    label: str

    val_a: str

    val_b: str

    is_match: bool

    similarity: int


@dataclass
class MatchResult:

    record_a_id: str

    record_b_id: str

    score: int

    status: str

    status_label: str

    field_comparisons: list[
        FieldComparisonResult
    ] = field(
        default_factory=list
    )


# ============================================================
# UTILITAIRES
# ============================================================

def full_name(record: dict) -> str:

    nom = str(
        record.get("nom") or ""
    ).strip()

    prenom = str(
        record.get("prenom") or ""
    ).strip()

    if nom and prenom:
        return f"{nom} {prenom}"

    return nom or prenom


def is_present(value: str) -> bool:

    return bool(
        str(value or "").strip()
    )


# ============================================================
# RÈGLES MÉTIER
# ============================================================

def apply_business_rules(
    record_a: dict,
    record_b: dict,
    scores: dict[str, float],
) -> str | None:

    # --------------------------------------------------------
    # Normalisation
    # --------------------------------------------------------

    name_a = full_name(record_a)
    name_b = full_name(record_b)

    email_a = normalize_email(
        record_a.get("email")
    )

    email_b = normalize_email(
        record_b.get("email")
    )

    phone_a = normalize_phone(
        record_a.get("telephone")
    )

    phone_b = normalize_phone(
        record_b.get("telephone")
    )

    address_a = normalize_text(
        record_a.get("adresse")
    )

    address_b = normalize_text(
        record_b.get("adresse")
    )

    city_a = normalize_text(
        record_a.get("ville")
    )

    city_b = normalize_text(
        record_b.get("ville")
    )

    cin_a = normalize_identifier(record_a.get("cin") or record_a.get("numero_cin"))
    cin_b = normalize_identifier(record_b.get("cin") or record_b.get("numero_cin"))
    birth_a = normalize_birth_date(record_a.get("date_naissance"))
    birth_b = normalize_birth_date(record_b.get("date_naissance"))

    # --------------------------------------------------------
    # Présence des champs
    # --------------------------------------------------------

    name_present = (
        is_present(name_a)
        and is_present(name_b)
    )

    email_present = bool(
        email_a and email_b
    )

    phone_present = bool(
        phone_a and phone_b
    )

    address_present = bool(
        address_a and address_b
    )

    city_present = bool(
        city_a and city_b
    )
    cin_present = bool(cin_a and cin_b)
    birth_present = bool(birth_a and birth_b)

    # --------------------------------------------------------
    # Égalités exactes
    # --------------------------------------------------------

    name_equal = (
        name_present
        and normalize_text(name_a)
        == normalize_text(name_b)
    )

    # Nom avec ordre inversé.
    #
    # Jean Rakoto
    # Rakoto Jean

    name_sorted_equal = False

    if name_present:

        sorted_a = " ".join(
            sorted(
                normalize_text(name_a).split()
            )
        )

        sorted_b = " ".join(
            sorted(
                normalize_text(name_b).split()
            )
        )

        name_sorted_equal = (
            sorted_a == sorted_b
        )

    email_equal = (
        email_present
        and email_a == email_b
    )

    phone_equal = (
        phone_present
        and phone_a == phone_b
    )

    address_equal = (
        address_present
        and address_a == address_b
    )

    city_equal = (
        city_present
        and city_a == city_b
    )
    cin_equal = cin_present and cin_a == cin_b
    birth_equal = birth_present and birth_a == birth_b

    # --------------------------------------------------------
    # Similarités fortes
    # --------------------------------------------------------

    name_close = (
        name_present
        and scores["nom"] >= 0.70
    )

    address_close = (
        address_present
        and scores["adresse"] >= 0.70
    )

    # A shared CIN is strong evidence; contradictions still go to review.
    if cin_present and cin_equal:
        contradiction = (
            (birth_present and not birth_equal)
            or (name_present and scores["nom"] < 0.40)
            or (email_present and not email_equal)
            or (phone_present and not phone_equal)
        )
        return "uncertain" if contradiction else "duplicate"

    # Conflicting CIN values are uncertain only when other fields suggest a
    # possible match; otherwise the pair is simply different.
    if cin_present and not cin_equal:
        return "uncertain" if (name_close or email_equal or phone_equal) else "different"

    if birth_present and not birth_equal and (name_close or email_equal or phone_equal):
        return "uncertain"

    # ========================================================
    # 1. DOUBLON PROBABLE
    # ========================================================

    # --------------------------------------------------------
    # Nom identique ou inversé + email identique
    #
    # Exemple :
    #
    # Jean Rakoto / Rakoto Jean
    # jean@gmail.com / jean@gmail.com
    #
    # => doublon
    # --------------------------------------------------------

    if (
        (name_equal or name_sorted_equal)
        and email_equal
    ):
        return "duplicate"

    # --------------------------------------------------------
    # Nom identique ou inversé + téléphone identique
    # --------------------------------------------------------

    if (
        (name_equal or name_sorted_equal)
        and phone_equal
    ):
        return "duplicate"

    # --------------------------------------------------------
    # Email + téléphone identiques
    # --------------------------------------------------------

    if (
        email_equal
        and phone_equal
    ):
        return "duplicate"

    # --------------------------------------------------------
    # Email + adresse identiques + nom proche
    # --------------------------------------------------------

    if (
        email_equal
        and address_equal
        and name_close
    ):
        return "duplicate"

    # --------------------------------------------------------
    # Téléphone + adresse proche + nom proche
    #
    # L'adresse peut être incomplète.
    # --------------------------------------------------------

    if (
        phone_equal
        and address_close
        and name_close
    ):
        return "duplicate"

    # --------------------------------------------------------
    # Tous les champs disponibles identiques
    # --------------------------------------------------------

    if (
        (not name_present or name_equal or name_sorted_equal)
        and (not email_present or email_equal)
        and (not phone_present or phone_equal)
        and (not address_present or address_equal)
        and (not city_present or city_equal)
        and (not cin_present or cin_equal)
        and (not birth_present or birth_equal)
    ):
        # Il faut quand même avoir au moins
        # deux informations réellement présentes.
        strong_equalities = sum(
            [
                name_equal or name_sorted_equal,
                email_equal,
                phone_equal,
                address_equal,
                city_equal,
                cin_equal,
                birth_equal,
            ]
        )

        if strong_equalities >= 2:
            return "duplicate"

    # ========================================================
    # 2. CAS INCERTAIN
    # ========================================================

    # Ici, l'incertain est utilisé uniquement lorsqu'il existe
    # une vraie contradiction entre des informations importantes
    # alors que plusieurs indices rapprochent les deux personnes.
    #
    # On ne crée PAS un incertain uniquement à partir du score.

    # --------------------------------------------------------
    # Même email + nom proche mais téléphone différent
    #
    # Exemple :
    #
    # Jean Rakoto
    # Jean Rakoto
    # même email
    # téléphone différent
    #
    # => incertain
    #
    # MAIS si le nom est exactement identique et l'email
    # identique, le cas a déjà été classé duplicate plus haut.
    # --------------------------------------------------------

    if email_equal and name_close:

        if (
            phone_present
            and not phone_equal
            and not name_equal
            and not name_sorted_equal
        ):
            return "uncertain"

        if (
            address_present
            and not address_close
            and not name_equal
            and not name_sorted_equal
        ):
            return "uncertain"

    # --------------------------------------------------------
    # Même téléphone + nom proche mais email différent
    # --------------------------------------------------------

    if phone_equal and name_close:

        if (
            email_present
            and not email_equal
            and not name_equal
            and not name_sorted_equal
        ):
            return "uncertain"

        if (
            address_present
            and not address_close
            and not name_equal
            and not name_sorted_equal
        ):
            return "uncertain"

    # --------------------------------------------------------
    # Même téléphone + adresse proche,
    # mais nom et email différents.
    # --------------------------------------------------------

    if (
        phone_equal
        and address_close
        and name_present
        and email_present
        and not name_close
        and not email_equal
    ):
        return "uncertain"

    # --------------------------------------------------------
    # Même email + adresse proche,
    # mais nom différent.
    # --------------------------------------------------------

    if (
        email_equal
        and address_close
        and name_present
        and not name_close
    ):
        return "uncertain"

    # ========================================================
    # 3. DIFFÉRENT
    # ========================================================

    strong_differences = 0

    # --------------------------------------------------------
    # Nom fortement différent
    # --------------------------------------------------------

    if (
        name_present
        and scores["nom"] < 0.40
    ):
        strong_differences += 1

    # --------------------------------------------------------
    # Email fortement différent
    # --------------------------------------------------------

    if (
        email_present
        and not email_equal
        and scores["email"] < 0.40
    ):
        strong_differences += 1

    # --------------------------------------------------------
    # Téléphone fortement différent
    # --------------------------------------------------------

    if (
        phone_present
        and not phone_equal
        and scores["telephone"] < 0.40
    ):
        strong_differences += 1

    # --------------------------------------------------------
    # Adresse fortement différente
    # --------------------------------------------------------

    if (
        address_present
        and scores["adresse"] < 0.40
    ):
        strong_differences += 1

    # --------------------------------------------------------
    # Ville fortement différente
    # --------------------------------------------------------

    if (
        city_present
        and scores["ville"] < 0.40
    ):
        strong_differences += 1

    if birth_present and not birth_equal:
        strong_differences += 1

    # Deux contradictions fortes suffisent.
    if strong_differences >= 2:
        return "different"

    # --------------------------------------------------------
    # Rien de suffisamment fiable
    #
    # On laisse compare_records() décider à partir du score
    # et de la présence d'une vraie preuve forte.
    # --------------------------------------------------------

    return None


# ============================================================
# CLASSIFICATION PAR SCORE
# ============================================================

def classify_score(
    score: int,
    seuil_incertain: int | None = None,
    seuil_doublon: int | None = None,
) -> str:

    settings = get_settings()

    if seuil_incertain is None:
        seuil_incertain = settings.SEUIL_INCERTAIN

    if seuil_doublon is None:
        seuil_doublon = settings.SEUIL_DOUBLON

    if score >= seuil_doublon:
        return "duplicate"

    if score >= seuil_incertain:
        return "uncertain"

    return "different"


def status_label(status: str) -> str:

    return {
        "duplicate": "Doublon probable",
        "uncertain": "Cas incertain",
        "different": "Diff\u00e9rent",
    }.get(
        status,
        status,
    )


# ============================================================
# COMPARER DEUX ENREGISTREMENTS
# ============================================================

def compare_records(
    record_a: dict,
    record_b: dict,
    seuil_incertain: int | None = None,
    seuil_doublon: int | None = None,
) -> MatchResult:

    weighted_total = 0.0
    total_weight = 0.0

    scores: dict[str, float] = {}

    comparisons: list[
        FieldComparisonResult
    ] = []

    # --------------------------------------------------------
    # Comparaison champ par champ
    # --------------------------------------------------------

    for field_name, label, weight in FIELD_WEIGHTS:

        if field_name == "nom":

            value_a = full_name(record_a)
            value_b = full_name(record_b)

        else:

            value_a = str(
                (record_a.get("cin") or record_a.get("numero_cin"))
                if field_name == "cin"
                else record_a.get(field_name) or ""
            )

            value_b = str(
                (record_b.get("cin") or record_b.get("numero_cin"))
                if field_name == "cin"
                else record_b.get(field_name) or ""
            )

        # ----------------------------------------------------
        # Normalisation
        # ----------------------------------------------------

        if field_name == "telephone":

            normalized_a = normalize_phone(
                value_a
            )

            normalized_b = normalize_phone(
                value_b
            )

        elif field_name == "email":

            normalized_a = normalize_email(value_a)
            normalized_b = normalize_email(value_b)

        elif field_name == "cin":

            normalized_a = normalize_identifier(value_a)
            normalized_b = normalize_identifier(value_b)

        elif field_name == "date_naissance":

            normalized_a = normalize_birth_date(value_a)
            normalized_b = normalize_birth_date(value_b)

        else:

            normalized_a = normalize_text(
                value_a
            )

            normalized_b = normalize_text(
                value_b
            )

        # ----------------------------------------------------
        # Champ absent
        # ----------------------------------------------------

        if not normalized_a or not normalized_b:

            similarity = 0.0

            is_match = False

        else:

            # -----------------------------------------------
            # Nom
            # -----------------------------------------------

            if field_name == "nom":

                similarity = name_similarity(
                    value_a,
                    value_b,
                )

            # -----------------------------------------------
            # Téléphone
            # -----------------------------------------------

            elif field_name == "telephone":

                similarity = phone_similarity(
                    value_a,
                    value_b,
                )

            # -----------------------------------------------
            # Adresse
            # -----------------------------------------------

            elif field_name == "adresse":

                similarity = address_similarity(value_a, value_b)

            elif field_name in {"cin", "date_naissance"}:

                similarity = 1.0 if normalized_a == normalized_b else 0.0

            # -----------------------------------------------
            # Email / ville
            # -----------------------------------------------

            else:

                similarity = string_similarity(
                    value_a,
                    value_b,
                )

            is_match = (
                similarity
                >= FIELD_MATCH_THRESHOLD
            )

            weighted_total += (
                similarity * weight
            )

            total_weight += weight

        scores[field_name] = similarity

        display_value_a = value_a
        display_value_b = value_b

        comparisons.append(
            FieldComparisonResult(
                field=field_name,
                label=label,
                val_a=display_value_a,
                val_b=display_value_b,
                is_match=is_match,
                similarity=round(
                    similarity * 100
                ),
            )
        )

    # ========================================================
    # SCORE GLOBAL
    # ========================================================

    if total_weight:

        score = round(
            (
                weighted_total
                / total_weight
            )
            * 100
        )

    else:

        score = 0

    # ========================================================
    # RÈGLES MÉTIER
    # ========================================================

    status = apply_business_rules(
        record_a,
        record_b,
        scores,
    )

    # ========================================================
    # CLASSIFICATION PAR SCORE
    # ========================================================

    if status is None:

        settings = get_settings()

        final_uncertain_threshold = (
            seuil_incertain
            if seuil_incertain is not None
            else settings.SEUIL_INCERTAIN
        )

        final_duplicate_threshold = (
            seuil_doublon
            if seuil_doublon is not None
            else settings.SEUIL_DOUBLON
        )

        # -----------------------------------------------
        # Score très élevé
        # -----------------------------------------------

        if score >= final_duplicate_threshold:

            status = "duplicate"

        else:

            # -------------------------------------------
            # Pour obtenir "incertain", il faut :
            #
            # 1. atteindre le seuil d'incertitude
            # 2. avoir au moins une vraie information forte
            #
            # On évite ainsi de fabriquer des cas
            # incertains simplement parce que le score
            # global est moyen.
            # -------------------------------------------

            strong_evidence = (
                scores["nom"] >= 0.85
                or scores["email"] >= 0.90
                or scores["telephone"] >= 0.90
                or scores["adresse"] >= 0.85
            )

            if (
                score >= final_uncertain_threshold
                and strong_evidence
            ):
                status = "uncertain"

            else:

                status = "different"

    # ========================================================
    # RÉSULTAT
    # ========================================================

    return MatchResult(
        record_a_id=str(
            record_a["id"]
        ),
        record_b_id=str(
            record_b["id"]
        ),
        score=score,
        status=status,
        status_label=status_label(status),
        field_comparisons=comparisons,
    )


# ============================================================
# PAIRES D'UN MÊME FICHIER
# ============================================================

def build_candidate_pairs(
    records: list[dict],
) -> list[tuple[int, int]]:

    count = len(records)

    if count < 2:
        return []

    # Pour les fichiers de taille normale,
    # on compare toutes les paires.

    if count <= 400:

        return [
            (i, j)
            for i in range(count)
            for j in range(
                i + 1,
                count,
            )
        ]

    # ========================================================
    # BLOCAGE PHONÉTIQUE POUR LES GROS FICHIERS
    # ========================================================

    blocks: dict[
        str,
        list[int],
    ] = {}

    for index, record in enumerate(records):

        name = full_name(record)

        tokens = sorted(
            normalize_text(name).split()
        )

        if tokens:

            key = soundex(
                tokens[0]
            )

        else:

            key = f"empty_{index}"

        blocks.setdefault(
            key,
            [],
        ).append(index)

    pairs = []

    for indexes in blocks.values():

        for position, i in enumerate(indexes):

            for j in indexes[position + 1:]:

                pairs.append(
                    (i, j)
                )

    return pairs


# ============================================================
# ANALYSE D'UN FICHIER
# ============================================================

def find_matches(
    records: list[dict],
    seuil_incertain: int | None = None,
    seuil_doublon: int | None = None,
) -> list[MatchResult]:

    if len(records) < 2:
        return []

    results = []

    for i, j in build_candidate_pairs(records):

        result = compare_records(
            records[i],
            records[j],
            seuil_incertain,
            seuil_doublon,
        )

        # ----------------------------------------------------
        # On conserve uniquement les vraies correspondances.
        #
        # Les différents seront calculés dans analysis.py
        # à partir des enregistrements qui ne participent
        # à aucune correspondance.
        # ----------------------------------------------------

        if result.status in {
            "duplicate",
            "uncertain",
        }:

            results.append(result)

    results.sort(
        key=lambda result: result.score,
        reverse=True,
    )

    return results


# ============================================================
# ANALYSE ENTRE DEUX FICHIERS
# ============================================================

def find_cross_file_matches(
    records_a: list[dict],
    records_b: list[dict],
    seuil_incertain: int | None = None,
    seuil_doublon: int | None = None,
) -> list[MatchResult]:

    if not records_a or not records_b:
        return []

    results = []

    for record_a in records_a:

        for record_b in records_b:

            result = compare_records(
                record_a,
                record_b,
                seuil_incertain,
                seuil_doublon,
            )

            # ------------------------------------------------
            # Même logique pour plusieurs fichiers.
            # ------------------------------------------------

            if result.status in {
                "duplicate",
                "uncertain",
            }:

                results.append(result)

    results.sort(
        key=lambda result: result.score,
        reverse=True,
    )

    return results
