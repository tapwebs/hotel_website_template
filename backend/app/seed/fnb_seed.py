"""Demo restaurant for the Jaipur property: floor tables and a small menu. Idempotent (adds only what is missing)."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.models.organization import Property
from backend.app.models.pos import MenuItem, POSTable

PROPERTY_ID = "prop-jaipur-01"

# (id, number, section, capacity)
TABLES = [
    ("tbl-01", "T1", "MAIN_DINING", 4), ("tbl-02", "T2", "MAIN_DINING", 2), ("tbl-03", "T3", "ROOFTOP_TERRACE", 4),
    ("tbl-04", "T4", "MAIN_DINING", 6), ("tbl-05", "T5", "MAIN_DINING", 4), ("tbl-06", "T6", "ROOFTOP_TERRACE", 2),
    ("tbl-07", "T7", "POOL_BAR", 4), ("tbl-08", "T8", "POOL_BAR", 2),
]

# (id, category, name, description, price in paise, veg, station, prep minutes)
MENU = [
    ("menu-01", "STARTERS", "Dahi Ke Kebab", "Crisp hung yogurt patties with cardamom, mint chutney and pomegranate relish", 45000, True, "MAIN_KITCHEN", 15),
    ("menu-04", "STARTERS", "Paneer Tikka", "Char-grilled cottage cheese with peppers, onion and mint chutney", 38000, True, "TANDOOR_GRILL", 18),
    ("menu-05", "STARTERS", "Tandoori Chicken", "Half chicken in saffron yogurt marinade from the clay oven", 52000, False, "TANDOOR_GRILL", 22),
    ("menu-02", "MAINS", "Laal Maas Heritage", "Rajasthani slow-braised lamb curry with Mathania red chilies", 95000, False, "MAIN_KITCHEN", 30),
    ("menu-06", "MAINS", "Dal Baati Churma", "Baked wheat rolls, five-lentil dal and sweet churma, with ghee", 62000, True, "MAIN_KITCHEN", 20),
    ("menu-07", "MAINS", "Gatte Ki Sabzi", "Gram flour dumplings in a tangy yogurt gravy", 48000, True, "MAIN_KITCHEN", 20),
    ("menu-08", "MAINS", "Butter Chicken", "Tandoori chicken in a silky tomato and butter gravy", 68000, False, "MAIN_KITCHEN", 22),
    ("menu-09", "BREADS", "Butter Naan", "Leavened bread from the tandoor, brushed with butter", 9000, True, "TANDOOR_GRILL", 8),
    ("menu-03", "BEVERAGES", "Royal Saffron Lassi", "Chilled yogurt with Kashmiri saffron and crushed pistachios", 25000, True, "BAR", 5),
    ("menu-10", "BEVERAGES", "Masala Chai", "Slow-brewed spiced tea with milk", 12000, True, "BAR", 5),
    ("menu-11", "BEVERAGES", "Fresh Lime Soda", "Sweet, salted or mixed", 15000, True, "BAR", 4),
    ("menu-12", "DESSERTS", "Ghevar", "Honeycomb disc of milk and flour, topped with rabri and almonds", 34000, True, "MAIN_KITCHEN", 10),
    ("menu-13", "DESSERTS", "Kulfi Falooda", "Pistachio kulfi with rose syrup, vermicelli and basil seeds", 29000, True, "MAIN_KITCHEN", 6),
]


async def ensure_fnb_demo(db: AsyncSession) -> None:
    if not await db.scalar(select(Property).where(Property.property_id == PROPERTY_ID)):
        return
    have_t = set((await db.execute(select(POSTable.table_id).where(POSTable.property_id == PROPERTY_ID))).scalars())
    have_m = set((await db.execute(select(MenuItem.item_id).where(MenuItem.property_id == PROPERTY_ID))).scalars())
    db.add_all(POSTable(table_id=i, property_id=PROPERTY_ID, table_number=n, section=sec, capacity=cap, status="AVAILABLE")
               for i, n, sec, cap in TABLES if i not in have_t)
    db.add_all(MenuItem(item_id=i, property_id=PROPERTY_ID, category=c, name=n, description=d, price_minor=p, is_veg=v, is_available=True, station=st, preparation_time_minutes=t)
               for i, c, n, d, p, v, st, t in MENU if i not in have_m)
    await db.commit()
