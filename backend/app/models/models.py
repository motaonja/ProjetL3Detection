import uuid
from datetime import datetime

from sqlalchemy import (
    String,
    Integer,
    Boolean,
    ForeignKey,
    DateTime,
    JSON,
    Text,
)

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


def gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"



class UserModel(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: gen_id("user"))
    name: Mapped[str] = mapped_column(String, nullable=False, default="")
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class EmailVerificationModel(Base):
    __tablename__ = "email_verifications"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: gen_id("verify"))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AuthSessionModel(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: gen_id("auth"))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    mfa_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class LoginChallengeModel(Base):
    __tablename__ = "login_challenges"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class UploadedFileModel(Base):
    __tablename__ = "uploaded_files"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: gen_id("file"),
    )

    owner_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    session_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    session_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    name: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    size: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    format: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    row_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    source_columns: Mapped[list] = mapped_column(JSON, default=list)

    upload_date: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )

    records: Mapped[list["DataRecordModel"]] = relationship(
        back_populates="file",
        cascade="all, delete-orphan",
    )


class DataRecordModel(Base):
    __tablename__ = "data_records"

    owner_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: gen_id("rec"),
    )

    nom: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    prenom: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    date_naissance: Mapped[str | None] = mapped_column(String, nullable=True)

    cin: Mapped[str | None] = mapped_column(String, nullable=True)

    email: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default="",
    )

    telephone: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default="",
    )

    adresse: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default="",
    )

    ville: Mapped[str] = mapped_column(
        String,
        nullable=False,
        default="",
    )

    source_file: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    source_values: Mapped[dict] = mapped_column(JSON, default=dict)

    file_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey(
            "uploaded_files.id",
            ondelete="CASCADE",
        ),
        nullable=True,
    )

    file: Mapped["UploadedFileModel | None"] = relationship(
        back_populates="records",
    )


class AnalysisHistoryModel(Base):
    __tablename__ = "analysis_history"
    owner_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: gen_id("analysis"),
    )

    date: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    files: Mapped[list] = mapped_column(
        JSON,
        default=list,
    )

    total_records: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    duplicates_found: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    uncertain_cases: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    different_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

    status: Mapped[str] = mapped_column(
        String,
        default="Termin\u00e9",
    )

    execution_time: Mapped[str] = mapped_column(
        String,
        default="0s",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )

    matches: Mapped[list["MatchPairModel"]] = relationship(
        back_populates="analysis",
        cascade="all, delete-orphan",
    )


class MatchPairModel(Base):
    __tablename__ = "match_pairs"

    id: Mapped[str] = mapped_column(
        String,
        primary_key=True,
        default=lambda: gen_id("match"),
    )

    record_a_id: Mapped[str] = mapped_column(
        String,
        ForeignKey(
            "data_records.id",
            ondelete="CASCADE",
        ),
    )

    record_b_id: Mapped[str] = mapped_column(
        String,
        ForeignKey(
            "data_records.id",
            ondelete="CASCADE",
        ),
    )

    record_a: Mapped["DataRecordModel"] = relationship(
        foreign_keys=[record_a_id],
    )

    record_b: Mapped["DataRecordModel"] = relationship(
        foreign_keys=[record_b_id],
    )

    score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    status: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    status_label: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    decision: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    decision_date: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
    )

    analysis_id: Mapped[str | None] = mapped_column(
        String,
        ForeignKey(
            "analysis_history.id",
            ondelete="CASCADE",
        ),
        nullable=True,
    )

    analysis: Mapped["AnalysisHistoryModel | None"] = relationship(
        back_populates="matches",
    )

    field_comparisons: Mapped[list["FieldComparisonModel"]] = relationship(
        back_populates="match",
        cascade="all, delete-orphan",
        order_by="FieldComparisonModel.id",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )


class FieldComparisonModel(Base):
    __tablename__ = "field_comparisons"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    match_id: Mapped[str] = mapped_column(
        String,
        ForeignKey(
            "match_pairs.id",
            ondelete="CASCADE",
        ),
    )

    match: Mapped["MatchPairModel"] = relationship(
        back_populates="field_comparisons",
    )

    field: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    label: Mapped[str] = mapped_column(
        String,
        nullable=False,
    )

    val_a: Mapped[str] = mapped_column(
        Text,
        default="",
    )

    val_b: Mapped[str] = mapped_column(
        Text,
        default="",
    )

    is_match: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
    )

    similarity: Mapped[int] = mapped_column(
        Integer,
        default=0,
    )

class AnalysisSnapshotModel(Base):
    """Immutable input and output snapshot for one completed analysis."""

    __tablename__ = "analysis_snapshots"

    analysis_id: Mapped[str] = mapped_column(
        String,
        ForeignKey("analysis_history.id", ondelete="CASCADE"),
        primary_key=True,
    )

    payload: Mapped[dict] = mapped_column(
        JSON,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )
