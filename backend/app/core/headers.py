"""Security headers for every API response (P51). Pure ASGI, no body buffering."""

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

# The API only returns JSON/bytes, never HTML: nothing may load or frame from it.
API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
# Swagger/ReDoc pull scripts from a CDN and run inline code, so the strict CSP would blank them.
DOC_PATHS = ("/docs", "/redoc", "/openapi.json")
HSTS = "max-age=31536000; includeSubDomains"

STATIC_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    # API responses are user specific (tokens, records): never cache unless a route says so.
    "Cache-Control": "no-store",
}


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp, hsts: bool = False) -> None:
        self.app = app
        self.hsts = hsts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        path = scope.get("path", "")
        is_doc = path.startswith(DOC_PATHS)

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for name, value in STATIC_HEADERS.items():
                    if name not in headers:  # a route's own value (e.g. file preview) wins
                        headers[name] = value
                if not is_doc and "content-security-policy" not in headers:
                    headers["Content-Security-Policy"] = API_CSP
                if self.hsts and "strict-transport-security" not in headers:
                    headers["Strict-Transport-Security"] = HSTS
            await send(message)

        await self.app(scope, receive, send_with_headers)
