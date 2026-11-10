import time
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select, and_, update, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.tax import room_tax_minor
from backend.app.core.errors import NotFoundException
from backend.app.models.room import Room, RoomType, RatePlan
from backend.app.models.operations import HousekeepingTask
from backend.app.schemas.room import PhysicalRoomResponse, RoomCategoryResponse, RatePlanResponse, RoomCreateRequest, RoomCreateResult, RoomStatusUpdateRequest


def _floor_of(number: str) -> int:
    """101 -> 1, 1203 -> 12; short or lettered numbers go on the ground floor."""
    return int(number[:-2]) if number.isdigit() and len(number) >= 3 else 0


def _room_response(r: Room, type_name: str) -> PhysicalRoomResponse:
    return PhysicalRoomResponse(
        id=r.room_id, roomNumber=r.room_number, roomTypeId=r.room_type_id, roomTypeName=type_name, floor=r.floor_number, wing=r.wing,
        occupancyStatus=r.occupancy_status, housekeepingStatus=r.clean_status, maintenanceStatus=r.maintenance_status,
        currentStayId=r.current_stay_id, currentGuestName=r.current_guest_name, assignedHousekeeper=r.assigned_housekeeper,
        activeMaintenanceTicketId=r.active_maintenance_ticket_id, notes=r.notes, lockStatus=r.lock_status,
    )


_CATEGORIES_CACHE_TTL_SECONDS = 5.0
_categories_cache: dict = {}


def clear_categories_cache() -> None:
    _categories_cache.clear()


class RoomService:
    @staticmethod
    async def create_rooms(db: AsyncSession, property_id: str, req: RoomCreateRequest) -> RoomCreateResult:
        """Add physical rooms. Existing room numbers are skipped, never changed. New rooms are vacant, clean and bookable at once
        (availability counts room rows) and each gets its own permanent in-room ordering QR."""
        rt = (await db.execute(select(RoomType).where(
            RoomType.property_id == property_id, RoomType.room_type_id == req.room_type_id, RoomType.is_active == True  # noqa: E712
        ))).scalar_one_or_none()
        if not rt:
            raise NotFoundException("Room type not found.")
        have = set((await db.execute(select(Room.room_number).where(
            Room.property_id == property_id, Room.room_number.in_(req.room_numbers)
        ))).scalars().all())
        created, skipped = [], []
        for number in req.room_numbers:
            if number in have:
                skipped.append(number)
                continue
            room = Room(
                property_id=property_id, room_type_id=rt.room_type_id, room_number=number,
                floor_number=req.floor_number if req.floor_number is not None else _floor_of(number),
                wing=(req.wing or "").strip() or None, clean_status="CLEAN", occupancy_status="VACANT", maintenance_status="OPERATIONAL",
            )
            db.add(room)
            created.append(room)
        await db.commit()
        if created:
            from backend.app.services.report_service import clear_reports_cache
            clear_reports_cache()  # dashboards count rooms
            clear_categories_cache()  # availability counts rooms too
        return RoomCreateResult(created=[_room_response(r, rt.name) for r in created], skipped=skipped)

    @staticmethod
    async def get_categories_cached(db: AsyncSession, property_id: str) -> List[RoomCategoryResponse]:
        """Short per-worker cache for repeat availability searches. Holding a room re-checks the database, so this cannot oversell."""
        hit = _categories_cache.get(property_id)
        if hit and time.monotonic() - hit[0] < _CATEGORIES_CACHE_TTL_SECONDS:
            return hit[1]
        data = await RoomService.get_categories(db, property_id)
        _categories_cache[property_id] = (time.monotonic(), data)
        return data

    @staticmethod
    async def get_categories(db: AsyncSession, property_id: str) -> List[RoomCategoryResponse]:
        stmt = (
            select(RoomType)
            .where(RoomType.property_id == property_id, RoomType.is_active == True)
            .options(selectinload(RoomType.rate_plans))
            .order_by(RoomType.base_rate_minor.asc())
        )
        result = await db.execute(stmt)
        categories = result.scalars().all()

        # Batch count available physical rooms across all categories in ONE query (eliminates N+1)
        avail_stmt = (
            select(Room.room_type_id, func.count(Room.room_id).label("cnt"))
            .where(
                Room.property_id == property_id,
                Room.occupancy_status == "VACANT",
                Room.maintenance_status == "OPERATIONAL"
            )
            .group_by(Room.room_type_id)
        )
        avail_rows = (await db.execute(avail_stmt)).all()
        avail_map = {row[0]: row[1] for row in avail_rows}

        responses = []
        for cat in categories:
            avail_count = avail_map.get(cat.room_type_id, 0)

            rate_plans_dto = [
                RatePlanResponse(
                    id=rp.rate_plan_id,
                    code=rp.code,
                    name=rp.name,
                    description=rp.description or "",
                    inclusions=rp.inclusions or [],
                    basePricePerNightPaise=rp.base_price_minor,
                    totalNetPaise=rp.base_price_minor * 2,
                    taxPaise=room_tax_minor(rp.base_price_minor, rp.base_price_minor * 2),
                    totalGrossPaise=rp.base_price_minor * 2 + room_tax_minor(rp.base_price_minor, rp.base_price_minor * 2),
                    mealPlan=rp.meal_plan,
                    cancellationPolicy=rp.cancellation_policy or {}
                )
                for rp in cat.rate_plans if rp.is_active
            ]

            responses.append(RoomCategoryResponse(
                id=cat.room_type_id,
                code=cat.code,
                name=cat.name,
                tagline=cat.tagline or "",
                description=cat.description or "",
                maxAdults=cat.max_adults,
                maxChildren=cat.max_children,
                maxTotalOccupancy=cat.max_occupancy,
                bedType=cat.bed_type,
                roomSizeSqFt=cat.room_size_sqft,
                viewType=cat.view_type,
                heroImage=cat.hero_image,
                galleryImages=cat.gallery_images or [],
                amenities=cat.amenities or [],
                availableUnits=avail_count,
                startingPricePerNightPaise=cat.base_rate_minor,
                ratePlans=rate_plans_dto,
                featured=cat.featured
            ))

        return responses

    @staticmethod
    async def get_category_by_id(db: AsyncSession, property_id: str, category_id: str) -> Optional[RoomCategoryResponse]:
        stmt = (
            select(RoomType)
            .where(RoomType.property_id == property_id, RoomType.room_type_id == category_id, RoomType.is_active == True)
            .options(selectinload(RoomType.rate_plans))
        )
        cat = (await db.execute(stmt)).scalar_one_or_none()
        if not cat:
            return None

        avail_stmt = select(func.count(Room.room_id)).where(
            Room.room_type_id == cat.room_type_id,
            Room.occupancy_status == "VACANT",
            Room.maintenance_status == "OPERATIONAL"
        )
        avail_count = (await db.execute(avail_stmt)).scalar() or 0

        rate_plans_dto = [
            RatePlanResponse(
                id=rp.rate_plan_id,
                code=rp.code,
                name=rp.name,
                description=rp.description or "",
                inclusions=rp.inclusions or [],
                basePricePerNightPaise=rp.base_price_minor,
                totalNetPaise=rp.base_price_minor * 2,
                taxPaise=room_tax_minor(rp.base_price_minor, rp.base_price_minor * 2),
                totalGrossPaise=rp.base_price_minor * 2 + room_tax_minor(rp.base_price_minor, rp.base_price_minor * 2),
                mealPlan=rp.meal_plan,
                cancellationPolicy=rp.cancellation_policy or {}
            )
            for rp in cat.rate_plans if rp.is_active
        ]

        return RoomCategoryResponse(
            id=cat.room_type_id,
            code=cat.code,
            name=cat.name,
            tagline=cat.tagline or "",
            description=cat.description or "",
            maxAdults=cat.max_adults,
            maxChildren=cat.max_children,
            maxTotalOccupancy=cat.max_occupancy,
            bedType=cat.bed_type,
            roomSizeSqFt=cat.room_size_sqft,
            viewType=cat.view_type,
            heroImage=cat.hero_image,
            galleryImages=cat.gallery_images or [],
            amenities=cat.amenities or [],
            availableUnits=avail_count,
            startingPricePerNightPaise=cat.base_rate_minor,
            ratePlans=rate_plans_dto,
            featured=cat.featured
        )

    @staticmethod
    async def get_physical_rooms(
        db: AsyncSession,
        property_id: str,
        floor: Optional[int] = None,
        clean_status: Optional[str] = None,
        occupancy_status: Optional[str] = None
    ) -> List[PhysicalRoomResponse]:
        query = select(Room).where(Room.property_id == property_id).options(selectinload(Room.room_type))

        if floor is not None:
            query = query.where(Room.floor_number == floor)
        if clean_status:
            query = query.where(Room.clean_status == clean_status)
        if occupancy_status:
            query = query.where(Room.occupancy_status == occupancy_status)

        query = query.order_by(Room.floor_number.asc(), Room.room_number.asc())
        result = await db.execute(query)
        rooms = result.scalars().all()

        return [
            PhysicalRoomResponse(
                id=r.room_id,
                roomNumber=r.room_number,
                roomTypeId=r.room_type_id,
                roomTypeName=r.room_type.name if r.room_type else "Standard Room",
                floor=r.floor_number,
                wing=r.wing,
                occupancyStatus=r.occupancy_status,
                housekeepingStatus=r.clean_status,
                maintenanceStatus=r.maintenance_status,
                currentStayId=r.current_stay_id,
                currentGuestName=r.current_guest_name,
                assignedHousekeeper=r.assigned_housekeeper,
                activeMaintenanceTicketId=r.active_maintenance_ticket_id,
                notes=r.notes,
                lockStatus=r.lock_status
            )
            for r in rooms
        ]

    @staticmethod
    async def update_room_status(
        db: AsyncSession,
        property_id: str,
        room_id: str,
        update_data: RoomStatusUpdateRequest
    ) -> PhysicalRoomResponse:
        stmt = select(Room).where(Room.property_id == property_id, Room.room_id == room_id).options(selectinload(Room.room_type))
        res = await db.execute(stmt)
        room = res.scalar_one_or_none()
        if not room:
            raise NotFoundException("Physical room not found.")

        if update_data.clean_status is not None:
            room.clean_status = update_data.clean_status

            # Synchronize authoritative state with HousekeepingTask
            now = datetime.now(timezone.utc)
            target_hk_status = "CLEANED" if update_data.clean_status == "CLEAN" else update_data.clean_status
            if target_hk_status not in ["DIRTY", "CLEANING", "CLEANED", "INSPECTED"]:
                target_hk_status = "DIRTY"

            hk_stmt = (
                select(HousekeepingTask)
                .where(
                    HousekeepingTask.property_id == property_id,
                    HousekeepingTask.room_id == room.room_id,
                    HousekeepingTask.status.in_(["DIRTY", "CLEANING", "CLEANED"])
                )
                .order_by(HousekeepingTask.created_at.desc())
            )
            active_task = (await db.execute(hk_stmt)).scalars().first()

            if active_task:
                active_task.status = target_hk_status
                if update_data.clean_status == "DIRTY":
                    active_task.completed_at = None
                    active_task.inspected_at = None
                elif target_hk_status == "CLEANING" and not active_task.started_at:
                    active_task.started_at = now
                elif target_hk_status == "CLEANED" and not active_task.completed_at:
                    active_task.completed_at = now
                elif target_hk_status == "INSPECTED":
                    active_task.inspected_at = now

                if update_data.notes:
                    active_task.notes = update_data.notes
                if update_data.assigned_housekeeper:
                    active_task.assigned_to_staff_name = update_data.assigned_housekeeper
            elif target_hk_status in ["DIRTY", "CLEANING", "CLEANED"]:
                new_task = HousekeepingTask(
                    property_id=property_id,
                    room_id=room.room_id,
                    task_type="TOUCH_UP" if update_data.clean_status == "TOUCH_UP" else "FULL_TURNOVER",
                    status=target_hk_status,
                    priority="MEDIUM",
                    notes=update_data.notes or f"Turnover task created from Rooms & Rates ({update_data.clean_status})",
                    assigned_to_staff_name=update_data.assigned_housekeeper,
                    started_at=now if target_hk_status in ["CLEANING", "CLEANED"] else None,
                    completed_at=now if target_hk_status == "CLEANED" else None
                )
                db.add(new_task)

        if update_data.occupancy_status is not None:
            room.occupancy_status = update_data.occupancy_status
        if update_data.maintenance_status is not None:
            room.maintenance_status = update_data.maintenance_status
        if update_data.assigned_housekeeper is not None:
            room.assigned_housekeeper = update_data.assigned_housekeeper
        if update_data.notes is not None:
            room.notes = update_data.notes

        await db.commit()
        await db.refresh(room)
        clear_categories_cache()

        return PhysicalRoomResponse(
            id=room.room_id,
            roomNumber=room.room_number,
            roomTypeId=room.room_type_id,
            roomTypeName=room.room_type.name if room.room_type else "",
            floor=room.floor_number,
            wing=room.wing,
            occupancyStatus=room.occupancy_status,
            housekeepingStatus=room.clean_status,
            maintenanceStatus=room.maintenance_status,
            currentStayId=room.current_stay_id,
            currentGuestName=room.current_guest_name,
            assignedHousekeeper=room.assigned_housekeeper,
            activeMaintenanceTicketId=room.active_maintenance_ticket_id,
            notes=room.notes,
            lockStatus=room.lock_status
        )
