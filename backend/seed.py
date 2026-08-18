import os
import logging
from datetime import datetime, timezone, timedelta

from db import db
from auth import hash_password, verify_password

logger = logging.getLogger(__name__)

BRANCHES = [
    "Smartphone Apotheke",
    "Phone Store",
    "Media Technik",
    "Schönenhause",
    "Hauptwerkstatt Berlin",
    "Smartphone Tegel",
]

SEED_PASSWORD = "Repair2026!"

STAFF = [
    ("Admin User", "admin@repair.de", "admin"),
    ("Mohini", "mohini@repair.de", "mitarbeiter"),
    ("Leen", "leen@repair.de", "mitarbeiter"),
    ("Abbas", "abbas@repair.de", "mitarbeiter"),
    ("Salem", "salem@repair.de", "mitarbeiter"),
    ("Ali", "ali@repair.de", "mitarbeiter"),
    ("Chris", "chris@repair.de", "techniker"),
    ("Nam", "nam@repair.de", "techniker"),
    ("Yasser", "yasser@repair.de", "techniker"),
    ("Basel", "basel@repair.de", "techniker"),
]


def _inventory_catalog(branch_map):
    hub = branch_map["Hauptwerkstatt Berlin"]
    items = []
    models = [
        ("iPhone 11", "Apple"), ("iPhone 12 Pro", "Apple"), ("iPhone 13", "Apple"),
        ("iPhone 14 Pro Max", "Apple"), ("iPhone 15 Pro Max", "Apple"),
        ("Samsung Galaxy S21 Ultra", "Samsung"), ("Samsung Galaxy S22 Ultra", "Samsung"),
        ("Samsung Galaxy S23 Ultra", "Samsung"), ("Samsung Galaxy S24 Ultra", "Samsung"),
        ("Google Pixel 7", "Google"), ("Google Pixel 8", "Google"),
    ]
    parts = [
        ("Display", "DISP", 89.90, 8, 3),
        ("Akku", "AKKU", 34.50, 12, 4),
        ("Ladebuchse", "LADE", 24.00, 10, 3),
        ("Rückseite / Backcover", "BACK", 29.90, 6, 2),
    ]
    for model, brand in models:
        code = "".join([c for c in model.upper() if c.isalnum()])[:8]
        for pname, pcode, price, qty, minst in parts:
            items.append({
                "sku": f"{pcode}-{code}",
                "part_type": pname,
                "brand": brand,
                "device_model": model,
                "price": price,
                "quantity": qty,
                "min_stock": minst,
                "branch_id": hub,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
    return items


async def seed_all():
    admin_password = os.environ.get("ADMIN_PASSWORD", SEED_PASSWORD)

    # Branches
    branch_map = {}
    for name in BRANCHES:
        existing = await db.branches.find_one({"name": name})
        if existing:
            branch_map[name] = str(existing["_id"])
        else:
            res = await db.branches.insert_one({
                "name": name,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            branch_map[name] = str(res.inserted_id)

    branch_ids = list(branch_map.values())
    hub_id = branch_map["Hauptwerkstatt Berlin"]

    # Users
    for i, (name, email, role) in enumerate(STAFF):
        pwd = admin_password if role == "admin" else SEED_PASSWORD
        if role == "admin":
            branch_id = None
        elif role == "techniker":
            branch_id = hub_id
        else:
            branch_id = branch_ids[i % len(branch_ids)]
        existing = await db.users.find_one({"email": email})
        if not existing:
            await db.users.insert_one({
                "name": name,
                "email": email,
                "role": role,
                "branch_id": branch_id,
                "password_hash": hash_password(pwd),
                "active": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        elif not verify_password(pwd, existing["password_hash"]):
            await db.users.update_one({"email": email},
                                      {"$set": {"password_hash": hash_password(pwd)}})

    # Inventory
    count = await db.inventory.count_documents({})
    if count == 0:
        await db.inventory.insert_many(_inventory_catalog(branch_map))

    await seed_demo_orders(branch_map)

    logger.info("Seeding complete: %d branches, %d users", len(BRANCHES), len(STAFF))


async def seed_demo_orders(branch_map):
    if await db.orders.count_documents({}) > 0:
        return
    chris = await db.users.find_one({"email": "chris@repair.de"})
    mohini = await db.users.find_one({"email": "mohini@repair.de"})
    chris_id = str(chris["_id"]) if chris else None
    creator = mohini["name"] if mohini else "Mohini"
    creator_id = str(mohini["_id"]) if mohini else None
    ids = list(branch_map.values())
    year = datetime.now(timezone.utc).year
    now = datetime.now(timezone.utc)

    demo = [
        # Abgeholt (Umsatz) über mehrere Filialen
        ("Apple", "iPhone 13", "Display gesprungen, Touch defekt", "Anna Weber", "0170 1112223", "ABGEHOLT", ids[0], 20, 89.9, 89.9, "BESTAETIGT", 6),
        ("Samsung", "Galaxy S22 Ultra", "Akku hält nicht mehr", "Bekir Yıldız", "0176 4445556", "ABGEHOLT", ids[1], 15, 45, 34.5, "BESTAETIGT", 8),
        ("Apple", "iPhone 14 Pro Max", "Ladebuchse locker", "Clara Fischer", "0151 7778889", "ABGEHOLT", ids[2], 20, 60, 24, "BESTAETIGT", 4),
        ("Google", "Pixel 8", "Rückseite gebrochen", "David Klein", "0160 9990001", "ABGEHOLT", ids[3], 15, 40, 29.9, "BESTAETIGT", 3),
        ("Samsung", "Galaxy S24 Ultra", "Display schwarz", "Elif Demir", "0157 2223334", "ABGEHOLT", ids[0], 25, 120, 89.9, "BESTAETIGT", 2),
        # Laufender Auftrag, chris zugewiesen (Techniker-Demo)
        ("Apple", "iPhone 15 Pro Max", "Wasserschaden, startet nicht", "Frank Bauer", "0172 5556667", "ZUGEWIESEN", ids[4], 30, 0, 0, "WARTET", 1),
        # Aktiver Auftrag ohne Techniker
        ("Samsung", "Galaxy S21 Ultra", "Kamera unscharf", "Greta Hofmann", "0163 8889990", "ANGENOMMEN", ids[1], 20, 0, 0, "WARTET", 1),
        # SLA-Verstoß: alt, nicht final
        ("Apple", "iPhone 11", "Akku tauschen", "Hasan Öztürk", "0178 1231234", "IN_BEARBEITUNG", ids[2], 15, 35, 34.5, "BESTAETIGT", 9),
    ]

    docs = []
    for i, (brand, model, issue, cname, cphone, status, branch_id, diag, labor, parts, cstatus, days_ago) in enumerate(demo, start=1):
        created = (now - timedelta(days=days_ago)).isoformat()
        assigned = chris_id if status in ("ZUGEWIESEN", "IN_BEARBEITUNG") else None
        docs.append({
            "auftragsnummer": f"RB-{year}-{i:05d}",
            "branch_id": branch_id,
            "device_brand": brand, 
            "device_model": model,
            "imei": f"3540{i:012d}"[:15],
            "device_passcode": f"12{i:02d}",  # <--- حقل كلمة سر الجهاز المضاف للـ Demo
            "issue_description": issue,
            "customer_name": cname, 
            "customer_phone": cphone,
            "customer_email": "", 
            "customer_address": "",
            "estimated_price": None,
            "diagnosis_fee": diag, 
            "labor_cost": labor, 
            "parts_cost": parts,
            "cost_status": cstatus,
            "used_parts": [],
            "assigned_techniker_id": assigned,
            "status": status, 
            "reject_reason": "", 
            "media": [],
            "status_history": [{"status": status, "at": created, "by": creator}],
            "created_by": creator_id, 
            "created_by_name": creator,
            "created_at": created, 
            "updated_at": created,
        })
    await db.orders.insert_many(docs)
    await db.counters.update_one({"_id": f"auftrag-{year}"},
                                 {"$set": {"seq": len(docs)}}, upsert=True)


async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.orders.create_index("auftragsnummer", unique=True)