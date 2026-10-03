"""Single source of truth for rule weights/severity (R3). Scoring itself lands in P19."""

RULE_POINTS: dict[str, int] = {
    "POSSIBLE_DUPLICATE_TRANSACTION": 40,
    "SELLER_MISMATCH": 30,
    "DUPLICATE_DEED": 30,
    "INCONSISTENT_OWNERSHIP": 20,
    "AREA_MISMATCH": 15,
    "REPEATED_SUSPICIOUS_TRANSACTIONS": 20,
    "UNIT_MISMATCH": 0,
    "POSSIBLE_NAME_VARIANT": 0,
    "LOW_EXTRACTION_CONFIDENCE": 0,  # review flag only (R3)
    "ML_ANOMALY": 0,  # ML points are dynamic (see ml_points_for); never alerts
}

RULE_SEVERITY: dict[str, str] = {
    "POSSIBLE_DUPLICATE_TRANSACTION": "HIGH",
    "SELLER_MISMATCH": "HIGH",
    "DUPLICATE_DEED": "HIGH",
    "INCONSISTENT_OWNERSHIP": "MEDIUM",
    "AREA_MISMATCH": "MEDIUM",
    "REPEATED_SUSPICIOUS_TRANSACTIONS": "MEDIUM",
    "UNIT_MISMATCH": "INFO",
    "POSSIBLE_NAME_VARIANT": "INFO",
    "LOW_EXTRACTION_CONFIDENCE": "INFO",
    "ML_ANOMALY": "INFO",
}

# Float tolerance when comparing areas.
AREA_EPS = 1e-6

# REPEATED_SUSPICIOUS_TRANSACTIONS: >= MIN_COUNT dated non-rejected transfers inside WINDOW_DAYS.
REPEATED_TX_WINDOW_DAYS = 90
REPEATED_TX_MIN_COUNT = 3

# Aggregation (R3): sum of points, capped; level thresholds are inclusive lower bounds.
SCORE_CAP = 100
LEVEL_THRESHOLDS: tuple[tuple[int, str], ...] = ((60, "HIGH"), (30, "MEDIUM"), (0, "LOW"))
# Evidence only becomes a fraud_alert when it carries points (INFO / 0-point codes never alert).
ALERT_MIN_POINTS = 1

# ML contribution (P49, R3): 0..ML_MAX_POINTS, linear from ML_MIN_SCORE (0 pts) to score 1.0 (max).
# The raw score is NOT a probability (P48: training median -> 0, max -> 1). ML can never lift a
# parcel into HIGH on its own (see scoring.score_evidence).
ML_MAX_POINTS = 15
ML_MIN_SCORE = 0.25
# Used for ownership_duration when the seller's holding period cannot be determined (neutral value
# inside the synthetic "normal" range of 300-9000 days, so unknown never reads as a rapid flip).
ML_NEUTRAL_DURATION_DAYS = 3000
