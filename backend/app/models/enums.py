"""Enums stored as plain strings in the DB (R2/R4). Values are language-neutral codes."""
from enum import StrEnum


class Role(StrEnum):
    CITIZEN = "CITIZEN"
    REVIEWER = "REVIEWER"
    OFFICER = "OFFICER"
    ADMIN = "ADMIN"


class LandStatus(StrEnum):
    ACTIVE = "ACTIVE"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"


class DocumentStatus(StrEnum):
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"
    EXTRACTED = "EXTRACTED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    FAILED = "FAILED"


class RecordStatus(StrEnum):  # H5 document_records.status
    MACHINE = "MACHINE"
    DRAFT = "DRAFT"
    APPROVED = "APPROVED"
    SUPERSEDED = "SUPERSEDED"


class OwnershipKind(StrEnum):  # H9a ownership_history.kind
    CURRENT = "CURRENT"  # ownership posted by a sale / mutation (end_date null = holds it now)
    HISTORICAL = "HISTORICAL"  # a past link of the chain of title, from an approved historical deed


class TransactionStatus(StrEnum):
    RECORDED = "RECORDED"
    FLAGGED = "FLAGGED"
    REJECTED = "REJECTED"


class AlertStatus(StrEnum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    DISMISSED = "DISMISSED"
    ESCALATED = "ESCALATED"


class VerificationStatus(StrEnum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class TransactionType(StrEnum):
    SALE = "SALE"
    GIFT = "GIFT"
    INHERITANCE = "INHERITANCE"
    OTHER = "OTHER"


class MutationStatus(StrEnum):
    APPLIED = "APPLIED"
    UNDER_REVIEW = "UNDER_REVIEW"
    HEARING = "HEARING"
    APPEALED = "APPEALED"  # a rejection was appealed; the office above decides
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"


class MutationSource(StrEnum):
    SEED = "SEED"
    WORKFLOW = "WORKFLOW"


class EncumbranceType(StrEnum):
    COURT_CASE = "COURT_CASE"
    KHAS = "KHAS"
    ACQUISITION = "ACQUISITION"
    MORTGAGE = "MORTGAGE"


class EncumbranceStatus(StrEnum):
    ACTIVE = "ACTIVE"
    RESOLVED = "RESOLVED"
