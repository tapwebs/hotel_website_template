from typing import List, Optional
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.errors import NotFoundException
from backend.app.models.guest import GuestProfile, GuestDocument
from backend.app.models.reservation import Reservation, ReservationRoom
from backend.app.models.room import RoomType
from backend.app.schemas.guest import GuestCreateRequest, GuestProfileResponse, GuestKYCDocumentResponse, GuestUpdateRequest, PastReservationBrief


class GuestService:
    @staticmethod
    async def get_all_guests(
        db: AsyncSession,
        org_id: str,
        search: Optional[str] = None,
        limit: int = 500,
        offset: int = 0
    ) -> List[GuestProfileResponse]:
        query = select(GuestProfile).where(GuestProfile.org_id == org_id).options(selectinload(GuestProfile.documents))

        if search:
            s_lower = f"%{search.lower()}%"
            query = query.where(
                or_(
                    GuestProfile.full_name.ilike(s_lower),
                    GuestProfile.phone.ilike(s_lower),
                    GuestProfile.email.ilike(s_lower)
                )
            )

        query = query.order_by(GuestProfile.created_at.desc(), GuestProfile.guest_id.desc()).offset(offset).limit(limit)
        res = await db.execute(query)
        guests = res.scalars().all()
        if not guests:
            return []

        # 1. Batch load past reservations for all guests in ONE query (eliminates N+1)
        guest_ids = [g.guest_id for g in guests]
        res_stmt = (
            select(Reservation)
            .where(Reservation.guest_id.in_(guest_ids))
            .options(selectinload(Reservation.rooms))
            .order_by(Reservation.created_at.desc())
        )
        all_reservations = (await db.execute(res_stmt)).scalars().all()

        # Group reservations by guest_id (up to 5 per guest)
        guest_res_map: dict[str, list[Reservation]] = {}
        for r in all_reservations:
            r_list = guest_res_map.setdefault(r.guest_id, [])
            if len(r_list) < 5:
                r_list.append(r)

        # 2. Batch load room types for all referenced rooms in ONE query
        room_type_ids = {
            rr.room_type_id
            for r_list in guest_res_map.values()
            for r in r_list
            for rr in r.rooms
            if rr.room_type_id
        }
        if room_type_ids:
            cat_stmt = select(RoomType).where(RoomType.room_type_id.in_(room_type_ids))
            cat_map = {c.room_type_id: c.name for c in (await db.execute(cat_stmt)).scalars().all()}
        else:
            cat_map = {}

        responses = []
        for g in guests:
            reservations = guest_res_map.get(g.guest_id, [])
            past_res_dto = []
            for r in reservations:
                room_type_name = "Luxury Room"
                if r.rooms and r.rooms[0].room_type_id in cat_map:
                    room_type_name = cat_map[r.rooms[0].room_type_id]

                past_res_dto.append(PastReservationBrief(
                    id=r.reservation_id,
                    bookingReference=r.booking_reference,
                    dates=f"{r.checkin_date} to {r.checkout_date}",
                    roomType=room_type_name,
                    spentPaise=r.total_amount_minor
                ))

            kyc_dto = [
                GuestKYCDocumentResponse(
                    id=doc.document_id,
                    documentType=doc.document_type,
                    documentNumberMasked=doc.document_number_masked,
                    issuingCountry=doc.issuing_country,
                    verified=doc.is_verified,
                    verifiedAt=doc.verified_at.isoformat() if doc.verified_at else None,
                    verifiedBy=doc.verified_by,
                    presignedViewUrl=doc.presigned_view_url
                )
                for doc in g.documents
            ]

            responses.append(GuestProfileResponse(
                id=g.guest_id,
                organizationId=g.org_id,
                fullName=g.full_name,
                firstName=g.first_name,
                lastName=g.last_name,
                email=g.email or "",
                phone=g.phone,
                nationality=g.nationality,
                vipTier=g.vip_tier,
                totalStays=g.total_stays or len(reservations),
                totalSpentPaise=g.total_spent_minor or sum(r.spentPaise for r in past_res_dto),
                preferences=g.preferences or {},
                kycDocuments=kyc_dto,
                pastReservations=past_res_dto
            ))

        return responses

    @staticmethod
    async def get_guest_by_id(
        db: AsyncSession,
        org_id: str,
        guest_id: str
    ) -> Optional[GuestProfileResponse]:
        stmt = (
            select(GuestProfile)
            .where(GuestProfile.guest_id == guest_id, GuestProfile.org_id == org_id)
            .options(selectinload(GuestProfile.documents))
        )
        res = await db.execute(stmt)
        guest = res.scalar_one_or_none()
        if not guest:
            return None

        # Fetch past reservations for this specific guest
        res_stmt = (
            select(Reservation)
            .where(Reservation.guest_id == guest.guest_id)
            .options(selectinload(Reservation.rooms))
            .order_by(Reservation.created_at.desc())
            .limit(5)
        )
        reservations = (await db.execute(res_stmt)).scalars().all()

        room_type_ids = {rr.room_type_id for r in reservations for rr in r.rooms if rr.room_type_id}
        if room_type_ids:
            cat_stmt = select(RoomType).where(RoomType.room_type_id.in_(room_type_ids))
            cat_map = {c.room_type_id: c.name for c in (await db.execute(cat_stmt)).scalars().all()}
        else:
            cat_map = {}

        past_res_dto = [
            PastReservationBrief(
                id=r.reservation_id,
                bookingReference=r.booking_reference,
                dates=f"{r.checkin_date} to {r.checkout_date}",
                roomType=cat_map.get(r.rooms[0].room_type_id, "Luxury Room") if r.rooms else "Luxury Room",
                spentPaise=r.total_amount_minor
            )
            for r in reservations
        ]

        kyc_dto = [
            GuestKYCDocumentResponse(
                id=doc.document_id,
                documentType=doc.document_type,
                documentNumberMasked=doc.document_number_masked,
                issuingCountry=doc.issuing_country,
                verified=doc.is_verified,
                verifiedAt=doc.verified_at.isoformat() if doc.verified_at else None,
                verifiedBy=doc.verified_by,
                presignedViewUrl=doc.presigned_view_url
            )
            for doc in guest.documents
        ]

        return GuestProfileResponse(
            id=guest.guest_id,
            organizationId=guest.org_id,
            fullName=guest.full_name,
            firstName=guest.first_name,
            lastName=guest.last_name,
            email=guest.email or "",
            phone=guest.phone,
            nationality=guest.nationality,
            vipTier=guest.vip_tier,
            totalStays=guest.total_stays or len(reservations),
            totalSpentPaise=guest.total_spent_minor or sum(r.spentPaise for r in past_res_dto),
            preferences=guest.preferences or {},
            kycDocuments=kyc_dto,
            pastReservations=past_res_dto
        )

    @staticmethod
    async def create_guest(db: AsyncSession, org_id: str, request: GuestCreateRequest) -> GuestProfileResponse:
        full_name = f"{request.first_name} {request.last_name}".strip()
        guest = GuestProfile(
            org_id=org_id,
            first_name=request.first_name,
            last_name=request.last_name,
            full_name=full_name,
            email=request.email,
            phone=request.phone,
            nationality=request.nationality or "Indian",
            vip_tier=request.vip_tier or "REGULAR",
            preferences=request.preferences or {}
        )
        db.add(guest)
        await db.commit()
        await db.refresh(guest)
        created = await GuestService.get_guest_by_id(db, org_id, guest.guest_id)
        if not created:
            raise NotFoundException("Failed to retrieve created guest.")
        return created
