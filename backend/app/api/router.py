from fastapi import APIRouter
from backend.app.api.routes import (
    auth,
    availability,
    reservations,
    front_desk,
    rooms,
    guests,
    folios,
    payments,
    housekeeping,
    maintenance,
    pos,
    reports,
    staff,
    settings,
    integrations,
    website_admin,
    qr_admin,
    website_gateway,
    dining,
    pos_ext,
    guest_dining,
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(availability.router)
api_router.include_router(reservations.router)
api_router.include_router(front_desk.router)
api_router.include_router(rooms.router)
api_router.include_router(guests.router)
api_router.include_router(folios.router)
api_router.include_router(payments.router)
api_router.include_router(housekeeping.router)
api_router.include_router(maintenance.router)
api_router.include_router(pos.router)
api_router.include_router(pos_ext.router)
api_router.include_router(guest_dining.router)
api_router.include_router(guest_dining.images_router)
api_router.include_router(reports.router)
api_router.include_router(staff.router)
api_router.include_router(settings.router)
api_router.include_router(integrations.router)
api_router.include_router(website_admin.router)
api_router.include_router(qr_admin.router)
api_router.include_router(website_gateway.router)
api_router.include_router(dining.router)
