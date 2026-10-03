import pytest

from tests.test_documents import store  # noqa: F401
from tests.test_lands import env  # noqa: F401
from tests.test_processing import jobs  # noqa: F401


@pytest.fixture(autouse=True)
def _no_login_throttle(request, monkeypatch):
    """Shared helpers log in on every call (10/min limit). Throttling itself is covered by
    test_security_a.py / test_rbac.py; here it would only make the sweeps flaky."""
    if "env" in request.fixturenames:
        monkeypatch.setattr("app.services.auth.check_login_rate", lambda *a, **k: None)
