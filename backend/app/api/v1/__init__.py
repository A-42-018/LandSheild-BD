from fastapi import APIRouter

from app.api.v1 import (
    admin,
    admin_audit,
    archive,
    auth,
    documents,
    feedback,
    gis,
    health,
    lands,
    map,
    me,
    mutations,
    officer,
    offices,
    public,
    rbac_stub,
    risk,
    verification,
)

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(admin_audit.router)
api_router.include_router(admin.router)
api_router.include_router(auth.router)
api_router.include_router(offices.router)
api_router.include_router(offices.admin_router)
api_router.include_router(gis.router)
api_router.include_router(map.router)  # before lands: /lands/map vs /lands/{land_id}
api_router.include_router(lands.router)
api_router.include_router(documents.router)
api_router.include_router(archive.router)
api_router.include_router(mutations.router)
api_router.include_router(officer.router)
api_router.include_router(feedback.router)
api_router.include_router(risk.router)
api_router.include_router(verification.router)
api_router.include_router(me.router)
api_router.include_router(public.router)
api_router.include_router(rbac_stub.router)
