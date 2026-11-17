import asyncio
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.config import settings
from backend.app.core.database import async_session_factory
from backend.app.core.security import hash_password
from backend.app.models.organization import Organization, Property, PropertySettings
from backend.app.models.user import User
from backend.app.models.room import Room, RoomType, RatePlan, DailyInventory
from backend.app.models.guest import GuestProfile, GuestDocument
from backend.app.models.reservation import Reservation, ReservationRoom, Stay
from backend.app.models.folio import MasterFolio, FolioLineItem, Payment
from backend.app.models.operations import HousekeepingTask, MaintenanceTicket
from backend.app.models.pos import POSTable, MenuItem, POSOrder
from backend.app.core.rbac import get_role_permissions
from backend.app.core.timezone import get_kolkata_calendar_date


async def seed_demo_data(db: AsyncSession):
    """Seed the core demo data once, then make sure the demo restaurant (tables + menu) is complete."""
    if settings.APP_ENV == "production":
        raise RuntimeError("Demo seed execution is strictly prohibited in production environment.")
    await _seed_core(db)
    from backend.app.seed.fnb_seed import ensure_fnb_demo
    await ensure_fnb_demo(db)


async def _seed_core(db: AsyncSession):
    # Check if data is already seeded
    existing_org = (await db.execute(select(Organization))).scalar_one_or_none()
    if existing_org:
        return

    print("Seeding initial TapMenu Open Hospitality demo data into database...")

    # 1. Organization & Properties
    org = Organization(
        org_id=settings.DEFAULT_ORG_ID,
        name="TapMenu Hospitality Group",
        legal_entity_name="TapMenu Hospitality Private Limited",
        is_active=True
    )
    db.add(org)

    prop1 = Property(
        property_id=settings.DEFAULT_PROPERTY_ID,
        org_id=org.org_id,
        code=settings.DEFAULT_PROPERTY_CODE,
        name="TapMenu Grand Palace & Spa, Jaipur",
        address_line1="Heritage Hilltop Road, Amber Fort Vicinity",
        city="Jaipur, Rajasthan",
        state_code="08",
        postal_code="302001",
        country_code="IN",
        gstin="08AAAAA0000A1Z5",
        currency="INR",
        timezone="Asia/Kolkata",
        phone="+91 (141) 489-0000",
        email="reservations@example.com"
    )
    prop2 = Property(
        property_id="prop-goa-02",
        org_id=org.org_id,
        code="TM-GOA",
        name="TapMenu Beach Resort & Villas, Goa",
        address_line1="Candolim Beach Road",
        city="Goa, Candolim",
        state_code="30",
        postal_code="403515",
        country_code="IN",
        currency="INR"
    )
    prop3 = Property(
        property_id="prop-udaipur-03",
        org_id=org.org_id,
        code="TM-UDR",
        name="TapMenu Lakeview Heritage Villa, Udaipur",
        address_line1="Lake Pichola Promenade",
        city="Udaipur, Rajasthan",
        state_code="08",
        postal_code="313001",
        country_code="IN",
        currency="INR"
    )
    db.add_all([prop1, prop2, prop3])

    # Property Settings
    settings_obj = PropertySettings(
        property_id=prop1.property_id,
        current_business_date=get_kolkata_calendar_date(),
        night_audit_status="IDLE",
        settings_json={
            "propertyIdentity": {
                "propertyName": "TapMenu Grand Palace & Spa",
                "legalEntityName": "TapMenu Hospitality Private Limited",
                "propertyCode": "TM-JPR",
                "hotelType": "HERITAGE_LUXURY",
                "starClassification": 5,
                "propertyStatus": "ACTIVE"
            },
            "hotelOperations": {
                "standardCheckIn": "14:00",
                "standardCheckOut": "11:00",
                "allowOverbooking": False,
                "maxOverbookingPct": 0
            }
        }
    )
    db.add(settings_obj)
    await db.flush()

    # 2. Staff Users with Centralized Role-Based Permissions
    superadmin_user = User(
        user_id="usr-dh-000",
        org_id=org.org_id,
        property_id=prop1.property_id,
        username="superadmin",
        email="superadmin@example.com",
        full_name="Amit Shah (SuperAdmin)",
        phone_number="+91 98765 00000",
        password_hash=hash_password("password123"),
        role_code="ROLE_SUPER_ADMIN",
        account_type="OWNER",
        job_role=None,
        permissions=list(get_role_permissions("ROLE_SUPER_ADMIN")),
        avatar_url="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
        is_active=True,
        token_version=1,
        management_scope=["RESTAURANT_POS", "ACCOUNTANT"]
    )
    admin_user = User(
        user_id="usr-dh-001",
        org_id=org.org_id,
        property_id=prop1.property_id,
        username="admin",
        email="arjun.singhania@example.com",
        full_name="Arjun Singhania",
        phone_number="+91 98765 11111",
        password_hash=hash_password("password123"),
        role_code="ROLE_GENERAL_MANAGER",
        account_type="MANAGER",
        job_role=None,
        permissions=list(get_role_permissions("ROLE_GENERAL_MANAGER")),
        avatar_url="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
        is_active=True,
        token_version=1,
        management_scope=["RESTAURANT_POS", "ACCOUNTANT"]
    )
    front_desk_user = User(
        user_id="usr-dh-002",
        org_id=org.org_id,
        property_id=prop1.property_id,
        username="priya",
        email="priya.verma@example.com",
        full_name="Priya Verma",
        phone_number="+91 98765 22222",
        password_hash=hash_password("password123"),
        role_code="ROLE_ACCOUNTANT",
        account_type="STAFF",
        job_role="ACCOUNTANT",
        permissions=list(get_role_permissions("ROLE_ACCOUNTANT")),
        is_active=True,
        token_version=1
    )
    housekeeper_user = User(
        user_id="usr-dh-003",
        org_id=org.org_id,
        property_id=prop1.property_id,
        username="rajesh",
        email="rajesh.kumar@example.com",
        full_name="Rajesh Kumar",
        phone_number="+91 98765 33333",
        password_hash=hash_password("password123"),
        role_code="ROLE_KITCHEN_STAFF",
        account_type="STAFF",
        job_role="KITCHEN_STAFF",
        permissions=list(get_role_permissions("ROLE_KITCHEN_STAFF")),
        is_active=True,
        token_version=1
    )
    maintenance_user = User(
        user_id="usr-dh-004",
        org_id=org.org_id,
        property_id=prop1.property_id,
        username="vikram",
        email="vikram.seth@example.com",
        full_name="Vikram Seth",
        phone_number="+91 98765 44444",
        password_hash=hash_password("password123"),
        role_code="ROLE_WAITER",
        account_type="STAFF",
        job_role="WAITER",
        permissions=list(get_role_permissions("ROLE_WAITER")),
        is_active=True,
        token_version=1
    )
    night_auditor_user = User(
        user_id="usr-dh-005",
        org_id=org.org_id,
        property_id=prop1.property_id,
        username="kavita",
        email="kavita.chawla@example.com",
        full_name="Kavita Chawla",
        phone_number="+91 98765 55555",
        password_hash=hash_password("password123"),
        role_code="ROLE_WAITER",
        account_type="STAFF",
        job_role="WAITER",
        permissions=list(get_role_permissions("ROLE_WAITER")),
        is_active=True,
        token_version=1
    )
    pos_user = User(
        user_id="usr-dh-006",
        org_id=org.org_id,
        property_id=prop1.property_id,
        username="rohan",
        email="rohan.mehta@example.com",
        full_name="Rohan Mehta",
        phone_number="+91 98765 66666",
        password_hash=hash_password("password123"),
        role_code="ROLE_CAPTAIN",
        account_type="STAFF",
        job_role="CAPTAIN",
        permissions=list(get_role_permissions("ROLE_CAPTAIN")),
        is_active=True,
        token_version=1
    )
    db.add_all([
        superadmin_user, admin_user, front_desk_user,
        housekeeper_user, maintenance_user, night_auditor_user, pos_user
    ])
    await db.flush()

    # 3. Room Types & Rate Plans
    cat1 = RoomType(
        room_type_id="cat-dlx-palace",
        property_id=prop1.property_id,
        code="DLX_PALACE",
        name="Deluxe Palace View Room",
        tagline="Traditional Rajasthani architecture with sweeping Aravali mountain & garden views",
        description="Generously proportioned at 480 sq.ft, featuring carved Jharokha alcoves, handcrafted Shekhawati teakwood furnishings, Italian marble bathroom with deep soaking tub, and a private balcony overlooking the palace fountains.",
        base_adults=2,
        max_adults=2,
        max_children=1,
        max_occupancy=3,
        bed_type="1 King Bed or 2 Twin Beds",
        room_size_sqft=480,
        view_type="Palace Gardens & Aravali Hills",
        hero_image="https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&auto=format&fit=crop&q=85",
        gallery_images=[
            "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&auto=format&fit=crop&q=85",
            "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=1200&auto=format&fit=crop&q=85"
        ],
        amenities=[
            {"id": "am-1", "name": "High-Speed Wi-Fi 6", "icon": "Wifi"},
            {"id": "am-2", "name": "55\" OLED Smart TV", "icon": "Tv"},
            {"id": "am-3", "name": "Rainfall Shower & Soaking Tub", "icon": "Bath"},
            {"id": "am-4", "name": "Nespresso Coffee Machine", "icon": "Coffee"}
        ],
        base_rate_minor=450000,
        featured=True
    )
    cat2 = RoomType(
        room_type_id="cat-roy-suite",
        property_id=prop1.property_id,
        code="ROYAL_SUITE",
        name="Royal Heritage Suite",
        tagline="Opulent dual-room royal suite with bespoke butler service & private plunge pool",
        description="Spanning 850 sq.ft, this stately suite offers an expansive living salon, hand-painted gold-leaf frescoes, antique brass chandeliers, a master king bedroom, a powder room, and an intimate open-air courtyard terrace with private plunge pool.",
        base_adults=2,
        max_adults=3,
        max_children=2,
        max_occupancy=4,
        bed_type="1 Emperor King Bed + Daybed",
        room_size_sqft=850,
        view_type="Panoramic Palace Courtyard & Sunset Terrace",
        hero_image="https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&auto=format&fit=crop&q=85",
        gallery_images=[
            "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=1200&auto=format&fit=crop&q=85"
        ],
        amenities=[
            {"id": "am-1", "name": "Dedicated Royal Butler", "icon": "UserCheck"},
            {"id": "am-2", "name": "Private Courtyard Plunge Pool", "icon": "Waves"},
            {"id": "am-3", "name": "65\" Curved 4K Entertainment", "icon": "Tv"}
        ],
        base_rate_minor=950000,
        featured=True
    )
    cat3 = RoomType(
        room_type_id="cat-mah-pres",
        property_id=prop1.property_id,
        code="MAHARAJA_PRESIDENTIAL",
        name="Maharaja Presidential Villa",
        tagline="The pinnacle of Rajasthani royalty: 1,500 sq.ft private palace with infinity plunge pool",
        description="An independent heritage pavilion featuring two master bedrooms, private dining room for 8 guests, kitchen prep pantry, gold-inlaid arches, personal security escort, private jacuzzi terrace, and curated royal ceremonial welcome.",
        base_adults=4,
        max_adults=4,
        max_children=2,
        max_occupancy=6,
        bed_type="2 King Emperor Beds",
        room_size_sqft=1500,
        view_type="Private Walled Garden & Sunken Courtyard",
        hero_image="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&auto=format&fit=crop&q=85",
        gallery_images=[
            "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1200&auto=format&fit=crop&q=85"
        ],
        amenities=[
            {"id": "am-1", "name": "Private Infinity Plunge Pool & Jacuzzi", "icon": "Waves"},
            {"id": "am-2", "name": "Personal Chef & 24/7 Butler Team", "icon": "ChefHat"}
        ],
        base_rate_minor=2500000,
        featured=False
    )
    db.add_all([cat1, cat2, cat3])
    await db.flush()

    # Rate Plans
    rp1 = RatePlan(
        rate_plan_id="rp-dlx-ep",
        property_id=prop1.property_id,
        room_type_id=cat1.room_type_id,
        code="EP",
        name="European Plan (Room Only)",
        description="Standard flexible room rate with complimentary high-speed Wi-Fi and access to the palace pool.",
        inclusions=["Luxury Accommodation", "High-Speed Wi-Fi", "Pool Access"],
        meal_plan="ROOM_ONLY",
        base_price_minor=450000,
        cancellation_policy={"type": "FREE_CANCELLATION", "freeCancellationHoursBefore": 48, "description": "Free cancellation up to 48 hours before check-in."}
    )
    rp2 = RatePlan(
        rate_plan_id="rp-dlx-cp",
        property_id=prop1.property_id,
        room_type_id=cat1.room_type_id,
        code="CP",
        name="Continental Plan (Bed & Royal Buffet Breakfast)",
        description="Includes decadent daily royal breakfast buffet at The Maharaja Court dining room.",
        inclusions=["Luxury Accommodation", "Daily Gourmet Breakfast Buffet"],
        meal_plan="BREAKFAST_INCLUDED",
        base_price_minor=550000,
        cancellation_policy={"type": "FREE_CANCELLATION", "freeCancellationHoursBefore": 24, "description": "Free cancellation up to 24 hours prior to arrival date."}
    )
    rp3 = RatePlan(
        rate_plan_id="rp-roy-cp",
        property_id=prop1.property_id,
        room_type_id=cat2.room_type_id,
        code="CP",
        name="Royal Heritage Experience (Breakfast & Butler)",
        description="Includes full royal breakfast, dedicated butler service, airport Mercedes transfer.",
        inclusions=["Imperial Suite Living", "Royal Buffet Breakfast", "Round-trip Airport Chauffeur"],
        meal_plan="BREAKFAST_INCLUDED",
        base_price_minor=950000,
        cancellation_policy={"type": "FREE_CANCELLATION", "freeCancellationHoursBefore": 72, "description": "Free cancellation up to 72 hours before arrival."}
    )
    db.add_all([rp1, rp2, rp3])
    await db.flush()

    # 4. Physical Rooms
    rooms_data = [
        # Floor 1
        ("rm-101", "101", cat1.room_type_id, 1, "OCCUPIED", "CLEAN", "Rahul Sharma", "stay-901"),
        ("rm-102", "102", cat1.room_type_id, 1, "OCCUPIED", "CLEAN", "Vikramaditya Rao", "stay-902"),
        ("rm-103", "103", cat1.room_type_id, 1, "OUT_OF_ORDER", "DIRTY", None, None),
        ("rm-104", "104", cat1.room_type_id, 1, "VACANT", "INSPECTED", None, None),
        ("rm-105", "105", cat1.room_type_id, 1, "VACANT", "CLEAN", None, None),
        ("rm-106", "106", cat1.room_type_id, 1, "OCCUPIED", "CLEAN", "Meera Patel", "stay-903"),
        ("rm-107", "107", cat1.room_type_id, 1, "VACANT", "CLEANING", None, None),
        ("rm-108", "108", cat1.room_type_id, 1, "VACANT", "DIRTY", None, None),
        ("rm-109", "109", cat1.room_type_id, 1, "OCCUPIED", "CLEAN", "Ananya Deshmukh", "stay-904"),
        ("rm-110", "110", cat1.room_type_id, 1, "VACANT", "INSPECTED", None, None),
        # Floor 2
        ("rm-201", "201", cat1.room_type_id, 2, "OCCUPIED", "CLEAN", "Pooja Hegde", "stay-905"),
        ("rm-202", "202", cat1.room_type_id, 2, "OCCUPIED", "CLEAN", "Karan Mehra", "stay-906"),
        ("rm-203", "203", cat1.room_type_id, 2, "VACANT", "INSPECTED", None, None),
        ("rm-204", "204", cat2.room_type_id, 2, "OCCUPIED", "CLEAN", "Rohit Khandelwal", "stay-907"),
        ("rm-205", "205", cat2.room_type_id, 2, "VACANT", "INSPECTED", None, None),
        ("rm-206", "206", cat2.room_type_id, 2, "OCCUPIED", "CLEAN", "Aarav Nambiar", "stay-908"),
        ("rm-207", "207", cat1.room_type_id, 2, "VACANT", "DIRTY", None, None),
        ("rm-208", "208", cat1.room_type_id, 2, "OCCUPIED", "CLEAN", "Sanjay Dutt", "stay-909"),
        # Floor 3
        ("rm-301", "301", cat2.room_type_id, 3, "OCCUPIED", "CLEAN", "Deepak Chopra", "stay-910"),
        ("rm-302", "302", cat2.room_type_id, 3, "VACANT", "CLEAN", None, None),
        ("rm-303", "303", cat2.room_type_id, 3, "OUT_OF_SERVICE", "DIRTY", None, None),
        ("rm-304", "304", cat2.room_type_id, 3, "VACANT", "INSPECTED", None, None),
        # Floor 4
        ("rm-401", "401", cat3.room_type_id, 4, "OCCUPIED", "CLEAN", "His Highness Yuvraj Singh", "stay-911")
    ]
    for r_id, r_num, rt_id, fl, occ, cln, g_name, s_id in rooms_data:
        room = Room(
            room_id=r_id,
            property_id=prop1.property_id,
            room_type_id=rt_id,
            room_number=r_num,
            floor_number=fl,
            occupancy_status=occ,
            clean_status=cln,
            maintenance_status="OUT_OF_ORDER" if r_id == "rm-103" else "OPERATIONAL",
            active_maintenance_ticket_id="MNT-2026-089" if r_id == "rm-103" else None,
            current_guest_name=g_name,
            current_stay_id=s_id
        )
        db.add(room)
    await db.flush()

    # 5. Guests
    guest1 = GuestProfile(
        guest_id="gst-001",
        org_id=org.org_id,
        first_name="Rahul",
        last_name="Sharma",
        full_name="Rahul Sharma",
        email="guest.sharma@example.com",
        phone="+91 98765 00001",
        nationality="Indian",
        vip_tier="GOLD",
        total_stays=4,
        total_spent_minor=8450000,
        preferences={"roomType": "Deluxe Palace View", "highFloor": True}
    )
    guest2 = GuestProfile(
        guest_id="gst-002",
        org_id=org.org_id,
        first_name="Kavita",
        last_name="Chawla",
        full_name="Kavita Chawla",
        email="guest.chawla@example.com",
        phone="+91 98765 00002",
        nationality="Indian",
        vip_tier="PLATINUM",
        total_stays=7,
        total_spent_minor=18200000,
        preferences={"roomType": "Royal Heritage Suite", "dietary": "Gluten-free"}
    )
    guest3 = GuestProfile(
        guest_id="gst-003",
        org_id=org.org_id,
        first_name="Rohit",
        last_name="Khandelwal",
        full_name="Rohit Khandelwal",
        email="guest.khandelwal@example.com",
        phone="+91 98765 00003",
        nationality="Indian",
        vip_tier="REGULAR",
        total_stays=2,
        total_spent_minor=4242000,
        preferences={"specialNotes": "Corporate billing"}
    )
    db.add_all([guest1, guest2, guest3])
    await db.flush()

    # 6. Reservations & Stays
    # Reservation 1: Rahul Sharma (Room 101, checked in)
    res1 = Reservation(
        reservation_id="res-101",
        booking_reference="DH-2026-1042",
        property_id=prop1.property_id,
        guest_id=guest1.guest_id,
        source="DIRECT_WEB",
        status="CONFIRMED",
        checkin_date="2026-10-14",
        checkout_date="2026-10-17",
        nights=3,
        rooms_count=1,
        total_amount_minor=1848000,
        paid_amount_minor=1848000,
        balance_amount_minor=0,
        payment_status="PAID",
        special_requests="High floor, feather pillows",
        master_folio_id="fol-5501"
    )
    rr1 = ReservationRoom(
        reservation_room_id="rrm-01",
        reservation_id=res1.reservation_id,
        room_type_id=cat1.room_type_id,
        assigned_room_id="rm-101",
        rate_plan_id=rp2.rate_plan_id,
        checkin_date="2026-10-14",
        checkout_date="2026-10-17",
        nights=3,
        adults=2,
        children=0,
        rate_per_night_minor=550000,
        total_gross_minor=1848000
    )
    stay1 = Stay(
        stay_id="stay-901",
        reservation_room_id=rr1.reservation_room_id,
        room_id="rm-101",
        status="CHECKED_IN"
    )
    db.add_all([res1, rr1, stay1])
    await db.flush()

    # Folio for Reservation 1
    folio1 = MasterFolio(
        folio_id="fol-5501",
        property_id=prop1.property_id,
        reservation_id=res1.reservation_id,
        stay_id=stay1.stay_id,
        guest_id=guest1.guest_id,
        room_number="101",
        folio_number="FOL-2026-5501",
        status="OPEN",
        credit_limit_minor=5000000,
        total_charges_minor=1947750,
        total_taxes_minor=202750,
        total_payments_minor=1848000,
        outstanding_balance_minor=99750
    )
    db.add(folio1)
    await db.flush()

    f_item1 = FolioLineItem(
        folio_id=folio1.folio_id,
        business_date="2026-10-14",
        transaction_type="ROOM_CHARGE",
        sac_hsn_code="996311",
        description="Room Charge - 14 Oct (Deluxe Palace View)",
        debit_minor=550000,
        credit_minor=0,
        net_minor=550000,
        tax_minor=66000,
        posted_by="SYSTEM (Night Audit)"
    )
    f_item1_b = FolioLineItem(
        folio_id=folio1.folio_id,
        business_date="2026-10-15",
        transaction_type="ROOM_CHARGE",
        sac_hsn_code="996311",
        description="Room Charge - 15 Oct (Deluxe Palace View)",
        debit_minor=550000,
        credit_minor=0,
        net_minor=550000,
        tax_minor=66000,
        posted_by="SYSTEM (Night Audit)"
    )
    f_item1_c = FolioLineItem(
        folio_id=folio1.folio_id,
        business_date="2026-10-16",
        transaction_type="ROOM_CHARGE",
        sac_hsn_code="996311",
        description="Room Charge - 16 Oct (Deluxe Palace View)",
        debit_minor=550000,
        credit_minor=0,
        net_minor=550000,
        tax_minor=66000,
        posted_by="SYSTEM (Night Audit)"
    )
    f_item2 = FolioLineItem(
        folio_id=folio1.folio_id,
        business_date="2026-10-14",
        transaction_type="PAYMENT",
        sac_hsn_code="996311",
        description="Advance Payment - Razorpay UPI",
        debit_minor=0,
        credit_minor=1848000,
        net_minor=-1848000,
        tax_minor=0,
        posted_by="PAYMENT_GATEWAY",
        reference_number="pay_Nz84129x"
    )
    f_item3 = FolioLineItem(
        folio_id=folio1.folio_id,
        business_date="2026-10-15",
        transaction_type="FNB_CHARGE",
        sac_hsn_code="996331",
        description="Room Service KOT #105 (Dahi Kebab + Lassi)",
        debit_minor=95000,
        credit_minor=0,
        net_minor=95000,
        tax_minor=4750,
        posted_by="POS_SYSTEM",
        reference_number="KOT-105"
    )
    p1 = Payment(
        property_id=prop1.property_id,
        folio_id=folio1.folio_id,
        transaction_ref="TXN-2026-9041",
        receipt_number="REC-2026-101",
        amount_minor=1848000,
        currency="INR",
        payment_method="UPI",
        provider="RAZORPAY",
        status="SUCCESS",
        upi_id="guest@examplebank"
    )
    db.add_all([f_item1, f_item1_b, f_item1_c, f_item2, f_item3, p1])

    # 7. Housekeeping Tasks
    hk1 = HousekeepingTask(
        task_id="hk-1",
        property_id=prop1.property_id,
        room_id="rm-108",
        task_type="FULL_TURNOVER",
        status="DIRTY",
        priority="HIGH",
        assigned_to_staff_name="Sunita Devi",
        notes="Expected arrival 14:00 PM"
    )
    hk2 = HousekeepingTask(
        task_id="hk-2",
        property_id=prop1.property_id,
        room_id="rm-107",
        task_type="FULL_TURNOVER",
        status="CLEANING",
        priority="MEDIUM",
        assigned_to_staff_name="Sunita Devi"
    )
    hk3 = HousekeepingTask(
        task_id="hk-3",
        property_id=prop1.property_id,
        room_id="rm-104",
        task_type="INSPECTION",
        status="INSPECTED",
        priority="MEDIUM",
        inspected_by="Meenakshi Iyer"
    )
    db.add_all([hk1, hk2, hk3])

    # 8. Maintenance Tickets
    mnt1 = MaintenanceTicket(
        ticket_id="mnt-01",
        property_id=prop1.property_id,
        ticket_number="MNT-2026-089",
        room_id="rm-103",
        category="HVAC",
        priority="CRITICAL",
        status="IN_PROGRESS",
        title="AC unit not cooling / compressor tripping breaker",
        description="Guest in 103 reported AC blowing warm air.",
        reported_by="Rahul Sharma (Guest via Front Desk)",
        assigned_technician="Dinesh Gurjar",
        blocks_room_from_sale=True
    )
    db.add(mnt1)

    await db.commit()
    print("Demo seed data committed successfully!")
