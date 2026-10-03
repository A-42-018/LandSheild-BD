import sys
from pathlib import Path

# `ai/` lives at the repo root (outside backend/); make it importable under uvicorn too.
_REPO_ROOT = str(Path(__file__).resolve().parents[2])
if _REPO_ROOT not in sys.path:
    sys.path.append(_REPO_ROOT)
