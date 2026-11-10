import random
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.errors import NotFoundException, ValidationException
from backend.app.models.operations import HousekeepingTask, MaintenanceTicket
from backend.app.models.room import Room, RoomType
from backend.app.schemas.operations import (
    HousekeepingStatusUpdateRequest,
    HousekeepingTaskResponse,
    MaintenanceStatusUpdateRequest,
    MaintenanceTicketCreateRequest,
    MaintenanceTicketResponse
)


class OperationsService:
    @staticmethod
    def _format_task_dto(t: HousekeepingTask, rm: Optional[Room]) -> HousekeepingTaskResponse:
        return HousekeepingTaskResponse(
            id=t.task_id,
            roomId=t.room_id,
            roomNumber=rm.room_number if rm else "",
            roomTypeName=rm.room_type.name if (rm and rm.room_type) else "Room",
            floor=rm.floor_number if rm else 1,
            taskType=t.task_type,
            status=t.status,
            priority=t.priority,
            assignedToStaffId=t.assigned_to_staff_id,
            assignedToStaffName=t.assigned_to_staff_name,
            startedAt=t.started_at.isoformat() if t.started_at else None,
            completedAt=t.completed_at.isoformat() if t.completed_at else None,
            inspectedAt=t.inspected_at.isoformat() if t.inspected_at else None,
            inspectedBy=t.inspected_by,
            notes=t.notes
        )

    @staticmethod
    async def get_housekeeping_tasks(
        db: AsyncSession,
        property_id: str,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[HousekeepingTaskResponse]:
        query = select(HousekeepingTask).where(HousekeepingTask.property_id == property_id)
        if status:
            query = query.where(HousekeepingTask.status == status)

        query = query.order_by(HousekeepingTask.created_at.desc()).limit(max(1, min(limit, 500))).offset(max(0, offset))
        res = await db.execute(query)
        tasks = res.scalars().all()
        if not tasks:
            return []

        # Batch fetch all referenced rooms in ONE query (eliminates N+1)
        room_ids = {t.room_id for t in tasks if t.room_id}
        if room_ids:
            rm_stmt = select(Room).where(Room.room_id.in_(room_ids)).options(selectinload(Room.room_type))
            room_map = {rm.room_id: rm for rm in (await db.execute(rm_stmt)).scalars().all()}
        else:
            room_map = {}

        return [
            OperationsService._format_task_dto(t, room_map.get(t.room_id))
            for t in tasks
        ]

    @staticmethod
    async def update_housekeeping_task(
        db: AsyncSession,
        property_id: str,
        task_id: str,
        update_data: HousekeepingStatusUpdateRequest
    ) -> HousekeepingTaskResponse:
        stmt = select(HousekeepingTask).where(HousekeepingTask.property_id == property_id, HousekeepingTask.task_id == task_id)
        task = (await db.execute(stmt)).scalar_one_or_none()
        if not task:
            raise NotFoundException("Housekeeping task not found.")

        now = datetime.now(timezone.utc)
        task.status = update_data.status
        if update_data.notes:
            task.notes = update_data.notes
        if update_data.assigned_to_staff_id:
            task.assigned_to_staff_id = update_data.assigned_to_staff_id
        if update_data.assigned_to_staff_name:
            task.assigned_to_staff_name = update_data.assigned_to_staff_name

        if update_data.status == "DIRTY":
            task.completed_at = None
            task.inspected_at = None
        elif update_data.status == "CLEANING" and not task.started_at:
            task.started_at = now
        elif update_data.status == "CLEANED" and not task.completed_at:
            task.completed_at = now
        elif update_data.status == "INSPECTED" and not task.inspected_at:
            task.inspected_at = now

        # Update physical room clean_status
        rm_stmt = select(Room).where(Room.room_id == task.room_id).options(selectinload(Room.room_type))
        room = (await db.execute(rm_stmt)).scalar_one_or_none()
        if room:
            room.clean_status = "CLEAN" if update_data.status == "CLEANED" else update_data.status
            if update_data.assigned_to_staff_name:
                room.assigned_housekeeper = update_data.assigned_to_staff_name

        await db.commit()

        return OperationsService._format_task_dto(task, room)

    @staticmethod
    async def get_maintenance_tickets(
        db: AsyncSession,
        property_id: str,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[MaintenanceTicketResponse]:
        query = select(MaintenanceTicket).where(MaintenanceTicket.property_id == property_id)
        if status:
            query = query.where(MaintenanceTicket.status == status)

        query = query.order_by(MaintenanceTicket.reported_at.desc()).limit(max(1, min(limit, 500))).offset(max(0, offset))
        res = await db.execute(query)
        tickets = res.scalars().all()
        if not tickets:
            return []

        # Batch fetch all referenced room numbers in ONE query (eliminates N+1)
        room_ids = {t.room_id for t in tickets if t.room_id}
        if room_ids:
            rm_stmt = select(Room.room_id, Room.room_number).where(Room.room_id.in_(room_ids))
            room_map = {row[0]: row[1] for row in (await db.execute(rm_stmt)).all()}
        else:
            room_map = {}

        return [
            MaintenanceTicketResponse(
                id=t.ticket_id,
                ticketNumber=t.ticket_number,
                roomId=t.room_id,
                roomNumber=room_map.get(t.room_id),
                locationArea=t.location_area,
                category=t.category,
                priority=t.priority,
                status=t.status,
                title=t.title,
                description=t.description,
                reportedBy=t.reported_by,
                reportedAt=t.reported_at.isoformat(),
                assignedTechnician=t.assigned_technician,
                photoUrl=t.photo_url,
                blocksRoomFromSale=t.blocks_room_from_sale,
                resolvedAt=t.resolved_at.isoformat() if t.resolved_at else None,
                resolutionNotes=t.resolution_notes
            )
            for t in tickets
        ]

    @staticmethod
    async def get_maintenance_ticket(
        db: AsyncSession,
        property_id: str,
        ticket_id: str
    ) -> MaintenanceTicketResponse:
        stmt = (
            select(MaintenanceTicket, Room.room_number)
            .outerjoin(Room, MaintenanceTicket.room_id == Room.room_id)
            .where(
                MaintenanceTicket.property_id == property_id,
                or_(
                    MaintenanceTicket.ticket_id == ticket_id,
                    MaintenanceTicket.ticket_number == ticket_id
                )
            )
        )
        row = (await db.execute(stmt)).first()
        if not row:
            raise NotFoundException("Maintenance ticket not found.")
        t, room_number = row
        return MaintenanceTicketResponse(
            id=t.ticket_id,
            ticketNumber=t.ticket_number,
            roomId=t.room_id,
            roomNumber=room_number,
            locationArea=t.location_area,
            category=t.category,
            priority=t.priority,
            status=t.status,
            title=t.title,
            description=t.description,
            reportedBy=t.reported_by,
            reportedAt=t.reported_at.isoformat(),
            assignedTechnician=t.assigned_technician,
            photoUrl=t.photo_url,
            blocksRoomFromSale=t.blocks_room_from_sale,
            resolvedAt=t.resolved_at.isoformat() if t.resolved_at else None,
            resolutionNotes=t.resolution_notes
        )

    @staticmethod
    async def create_maintenance_ticket(
        db: AsyncSession,
        property_id: str,
        request: MaintenanceTicketCreateRequest
    ) -> MaintenanceTicketResponse:
        if not request.title or not request.title.strip():
            raise ValidationException("Issue summary (title) is required.")

        target_room: Optional[Room] = None
        if request.room_id:
            rm_stmt = select(Room).where(Room.property_id == property_id, Room.room_id == request.room_id)
            target_room = (await db.execute(rm_stmt)).scalar_one_or_none()
            if not target_room:
                raise NotFoundException("Physical room not found.")
        elif request.room_number:
            rm_stmt = select(Room).where(Room.property_id == property_id, Room.room_number == str(request.room_number).strip())
            target_room = (await db.execute(rm_stmt)).scalar_one_or_none()
            if not target_room:
                raise NotFoundException(f"Physical room {request.room_number} not found.")

        if request.blocks_room_from_sale and not target_room:
            raise ValidationException("A valid physical room must be specified to block room from sale.")

        # Collision-proof ticket number generation
        ticket_number = f"MNT-2026-{random.randint(100, 999)}"
        for _ in range(5):
            existing_stmt = select(MaintenanceTicket.ticket_id).where(MaintenanceTicket.ticket_number == ticket_number)
            if not (await db.execute(existing_stmt)).scalar_one_or_none():
                break
            ticket_number = f"MNT-2026-{random.randint(1000, 9999)}"

        initial_status = "ASSIGNED" if request.assigned_technician else "OPEN"

        ticket = MaintenanceTicket(
            property_id=property_id,
            ticket_number=ticket_number,
            room_id=target_room.room_id if target_room else None,
            location_area=request.location_area or (f"Room {target_room.room_number}" if target_room else "General Area"),
            category=request.category.upper(),
            priority=request.priority.upper(),
            status=initial_status,
            title=request.title.strip(),
            description=request.description or "",
            reported_by=request.reported_by or "Engineering Staff",
            assigned_technician=request.assigned_technician,
            blocks_room_from_sale=request.blocks_room_from_sale
        )
        db.add(ticket)

        # When Block Room from Sale is enabled:
        # Mark maintenance_status = OUT_OF_ORDER, record active ticket.
        # CRITICAL: Strictly preserve occupancy_status (VACANT/OCCUPIED) and clean_status!
        if target_room and request.blocks_room_from_sale:
            target_room.maintenance_status = "OUT_OF_ORDER"
            target_room.active_maintenance_ticket_id = ticket_number

        await db.commit()
        await db.refresh(ticket)

        return MaintenanceTicketResponse(
            id=ticket.ticket_id,
            ticketNumber=ticket.ticket_number,
            roomId=ticket.room_id,
            roomNumber=target_room.room_number if target_room else None,
            locationArea=ticket.location_area,
            category=ticket.category,
            priority=ticket.priority,
            status=ticket.status,
            title=ticket.title,
            description=ticket.description,
            reportedBy=ticket.reported_by,
            reportedAt=ticket.reported_at.isoformat(),
            assignedTechnician=ticket.assigned_technician,
            photoUrl=ticket.photo_url,
            blocksRoomFromSale=ticket.blocks_room_from_sale,
            resolvedAt=ticket.resolved_at.isoformat() if ticket.resolved_at else None,
            resolutionNotes=ticket.resolution_notes
        )

    @staticmethod
    async def update_maintenance_ticket(
        db: AsyncSession,
        property_id: str,
        ticket_id: str,
        update_data: MaintenanceStatusUpdateRequest
    ) -> MaintenanceTicketResponse:
        stmt = select(MaintenanceTicket).where(
            MaintenanceTicket.property_id == property_id,
            MaintenanceTicket.ticket_id == ticket_id
        )
        ticket = (await db.execute(stmt)).scalar_one_or_none()
        if not ticket:
            raise NotFoundException("Maintenance ticket not found.")

        # Update technician
        if update_data.assigned_technician is not None:
            ticket.assigned_technician = update_data.assigned_technician
            if ticket.status == "OPEN" and update_data.assigned_technician:
                ticket.status = "ASSIGNED"

        # Update priority
        if update_data.priority is not None:
            ticket.priority = update_data.priority.upper()

        # Update resolution notes
        if update_data.resolution_notes is not None:
            ticket.resolution_notes = update_data.resolution_notes

        # Update blocks_room_from_sale
        if update_data.blocks_room_from_sale is not None:
            ticket.blocks_room_from_sale = update_data.blocks_room_from_sale

        # Update status
        if update_data.status is not None:
            normalized_status = update_data.status.upper()
            valid_statuses = ["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "WAITING_PARTS", "RESOLVED", "CLOSED", "CANCELLED"]
            if normalized_status not in valid_statuses:
                raise ValidationException(f"Invalid maintenance status: {update_data.status}. Must be one of {valid_statuses}")
            ticket.status = normalized_status

            if normalized_status in ["RESOLVED", "CLOSED"]:
                if not ticket.resolved_at:
                    ticket.resolved_at = datetime.now(timezone.utc)
            elif normalized_status in ["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "WAITING_PARTS"]:
                ticket.resolved_at = None

        # Flush pending ticket status / blocking changes to ensure SQL query sees current state
        await db.flush()

        # Synchronize room maintenance restriction
        # Only modify room restriction if this ticket blocks the room or if blocking flag was toggled
        if ticket.room_id and (ticket.blocks_room_from_sale or update_data.blocks_room_from_sale is not None):
            rm_stmt = select(Room).where(Room.room_id == ticket.room_id)
            room = (await db.execute(rm_stmt)).scalar_one_or_none()
            if room:
                # Query for any active blocking ticket on this room (excluding current if closed/cancelled)
                # Note: RESOLVED tickets still require verification before closure and remain blocking.
                active_blocking_stmt = (
                    select(MaintenanceTicket)
                    .where(
                        MaintenanceTicket.property_id == property_id,
                        MaintenanceTicket.room_id == room.room_id,
                        MaintenanceTicket.status.in_(["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "WAITING_PARTS", "RESOLVED"]),
                        MaintenanceTicket.blocks_room_from_sale == True
                    )
                    .order_by(MaintenanceTicket.reported_at.desc())
                )
                active_blocking_tickets = (await db.execute(active_blocking_stmt)).scalars().all()

                if active_blocking_tickets:
                    room.maintenance_status = "OUT_OF_ORDER"
                    room.active_maintenance_ticket_id = active_blocking_tickets[0].ticket_number
                else:
                    # Release maintenance restriction ONLY if no active blocking ticket remains
                    room.maintenance_status = "OPERATIONAL"
                    room.active_maintenance_ticket_id = None
                    # If room was marked OUT_OF_ORDER due to maintenance, restore to VACANT only if unoccupied
                    # (strictly preserving in-house guest stays, independent OUT_OF_SERVICE restrictions, and cleanliness)
                    if room.occupancy_status == "OUT_OF_ORDER" and not room.current_stay_id and not room.current_guest_name:
                        room.occupancy_status = "VACANT"
                # NOTE: Room clean_status, housekeeping tasks, and in-house guest stays are strictly preserved!

        await db.commit()
        await db.refresh(ticket)

        room_number = None
        if ticket.room_id:
            rm_num_stmt = select(Room.room_number).where(Room.room_id == ticket.room_id)
            room_number = (await db.execute(rm_num_stmt)).scalar_one_or_none()

        return MaintenanceTicketResponse(
            id=ticket.ticket_id,
            ticketNumber=ticket.ticket_number,
            roomId=ticket.room_id,
            roomNumber=room_number,
            locationArea=ticket.location_area,
            category=ticket.category,
            priority=ticket.priority,
            status=ticket.status,
            title=ticket.title,
            description=ticket.description,
            reportedBy=ticket.reported_by,
            reportedAt=ticket.reported_at.isoformat(),
            assignedTechnician=ticket.assigned_technician,
            photoUrl=ticket.photo_url,
            blocksRoomFromSale=ticket.blocks_room_from_sale,
            resolvedAt=ticket.resolved_at.isoformat() if ticket.resolved_at else None,
            resolutionNotes=ticket.resolution_notes
        )
