"""
Schémas Pydantic — miroir des interfaces utilisées
par le frontend.
"""

from datetime import timezone
from typing import Literal, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# DataRecord
# ---------------------------------------------------------------------------

class DataRecordBase(BaseModel):
    nom: str
    prenom: Optional[str] = None
    date_naissance: Optional[str] = None
    cin: Optional[str] = Field(default=None, validation_alias=AliasChoices("cin", "numero_cin"))
    email: str = ""
    telephone: str = ""
    adresse: str = ""
    ville: str = ""
    sourceFile: str
    sourceValues: dict[str, str] = Field(default_factory=dict)


class DataRecordCreate(DataRecordBase):
    pass


class DataRecord(DataRecordBase):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )

    id: str

    @classmethod
    def from_orm_record(cls, record) -> "DataRecord":
        return cls(
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
            sourceValues=getattr(record, "source_values", None) or {},
        )


# ---------------------------------------------------------------------------
# UploadedFile
# ---------------------------------------------------------------------------

class UploadedFile(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )

    id: str
    sessionId: str | None = None
    name: str
    size: str
    sizeBytes: int
    format: Literal[
        "CSV",
        "XLSX",
        "XLS",
    ]
    rowCount: int
    uploadDate: str
    sourceColumns: list[str] = Field(default_factory=list)


class UploadResponse(BaseModel):
    files: list[UploadedFile]
    records: list[DataRecord]
    warnings: list[str] = []


# ---------------------------------------------------------------------------
# FieldComparison / MatchPair
# ---------------------------------------------------------------------------

class FieldComparison(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    field: str
    label: str
    valA: str
    valB: str
    isMatch: bool
    similarity: int


MatchStatus = Literal[
    "duplicate",
    "uncertain",
    "different",
]


ArbitrationDecision = Optional[
    Literal[
        "confirmed",
        "rejected",
    ]
]


class MatchPair(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: str
    recordA: DataRecord
    recordB: DataRecord
    score: int
    status: MatchStatus
    statusLabel: str
    fieldComparisons: list[FieldComparison]
    decision: ArbitrationDecision = None
    decisionDate: Optional[str] = None


class ArbitrationRequest(BaseModel):
    decision: Literal[
        "confirmed",
        "rejected",
    ]


# ---------------------------------------------------------------------------
# AnalysisHistoryItem
# ---------------------------------------------------------------------------

AnalysisStatus = Literal[
    "Termin\u00e9",
    "En cours",
    "Arbitr\u00e9",
]


class AnalysisHistoryItem(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
    )

    id: str
    date: str
    files: list[str]
    totalRecords: int
    duplicatesFound: int
    uncertainCases: int
    differentCount: int
    status: AnalysisStatus
    executionTime: str
    hasSnapshot: bool = False

    @classmethod
    def from_orm_history(
        cls,
        h,
    ) -> "AnalysisHistoryItem":
        raw_status = str(h.status or "")
        if raw_status.startswith("Termin"):
            status = "Termin\u00e9"
        elif raw_status.startswith("Arbitr"):
            status = "Arbitr\u00e9"
        else:
            status = raw_status

        return cls(
            id=h.id,
            date=(
                h.created_at.replace(tzinfo=timezone.utc)
                .astimezone()
                .strftime("%d/%m/%Y %H:%M")
                if getattr(h, "created_at", None) is not None
                else h.date
            ),
            files=h.files or [],
            totalRecords=h.total_records,
            duplicatesFound=h.duplicates_found,
            uncertainCases=h.uncertain_cases,
            differentCount=h.different_count,
            status=status,
            executionTime=h.execution_time,
        )


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

class AnalysisRunRequest(BaseModel):
    seuil_doublon: Optional[int] = None
    seuil_incertain: Optional[int] = None
    session_id: str


class AnalysisRunResponse(BaseModel):
    history: AnalysisHistoryItem

    # Vraies paires de correspondance :
    # doublons et cas incertains.
    matches: list[MatchPair]

    # Vrais enregistrements sans correspondance.
    differentRecords: list[DataRecord] = []


# ---------------------------------------------------------------------------
# Statistiques
# ---------------------------------------------------------------------------

class AttributeConcordance(BaseModel):
    field: str
    rate: int


class DashboardStats(BaseModel):
    totalFiles: int
    totalRecords: int
    totalPairs: int
    duplicatesFound: int
    uncertainCases: int
    differentCount: int
    pendingArbitrationCount: int
    attributeConcordance: list[AttributeConcordance]