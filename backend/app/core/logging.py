import json
import logging
import re
import sys
from datetime import UTC, datetime

REDACTED = "[REDACTED]"
# Field names whose value must never reach a log line (matched as substrings, case-insensitive).
_SENSITIVE_KEYS = (
    "password", "passwd", "secret", "token", "authorization", "cookie", "api_key", "apikey",
    "nid", "contact", "phone", "email", "file_path", "hash", "father_name",
)  # fmt: skip
# Free-text patterns scrubbed from messages, extras and tracebacks.
_PATTERNS = (
    re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]+"),
    re.compile(r"\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*"),  # JWT
    re.compile(r"(?i)\b(password|passwd|secret|token|authorization|(?:set-)?cookie|api[_-]?key|ls_refresh)\b(\s*[=:]\s*)[\"']?[^\s,;&\"']+"),
    re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+"),  # e-mail address
)  # fmt: skip


def redact_text(text: str) -> str:
    out = _PATTERNS[0].sub(f"Bearer {REDACTED}", text)
    out = _PATTERNS[1].sub(REDACTED, out)
    out = _PATTERNS[2].sub(lambda m: f"{m.group(1)}{m.group(2)}{REDACTED}", out)
    return _PATTERNS[3].sub(REDACTED, out)


def redact_value(key: str, value: object) -> object:
    if any(k in key.lower() for k in _SENSITIVE_KEYS):
        return REDACTED
    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, dict):
        return {str(k): redact_value(str(k), v) for k, v in value.items()}
    if isinstance(value, list | tuple):
        return [redact_value(key, v) for v in value]
    return value


_RESERVED = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__) | {"message", "asctime"}


class JsonFormatter(logging.Formatter):
    """One JSON object per line. Never log secrets, NID, phone, or addresses."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": redact_text(record.getMessage()),
        }
        for key, value in record.__dict__.items():
            if key not in _RESERVED and not key.startswith("_"):
                payload[key] = redact_value(key, value)
        if record.exc_info:
            payload["exc"] = redact_text(self.formatException(record.exc_info))
        return json.dumps(payload, default=str, ensure_ascii=False)


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())
