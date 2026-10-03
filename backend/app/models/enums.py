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
