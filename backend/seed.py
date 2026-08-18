import os
import logging
from datetime import datetime, timezone

from db import db
from auth import hash_password, verify_password

logger = logging.getLogger(__name__)

# فروعك الحقيقية المعتمدة
BRANCHES = [
    "Phone Store Mobile",
    "Praxis Smartphone",
    "Handy & Laptop Krankenhaus",
    "Technik Phone",
    "Smartphone Apotheke",
]

SEED_PASSWORD = "Repair2026!"

STAFF = [
    ("Admin User", "admin@repair.de", "admin"),
]


async def seed_all():
    admin_password = os.environ.get("ADMIN_PASSWORD", SEED_PASSWORD)

    # 1. تنظيف الفروع القديمة غير الموجودة في القائمة الحالية، أو مزامنتها
    current_branch_names = set(BRANCHES)
    
    # احذف أي فروع قديمة لم تعد موجودة في القائمه الجديدة
    await db.branches.delete_many({"name": {"$nin": BRANCHES}})

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

    # Users (admin only)
    for name, email, role in STAFF:
        pwd = admin_password if role == "admin" else SEED_PASSWORD
        branch_id = None
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

    logger.info("Seeding complete: %d branches, %d users", len(BRANCHES), len(STAFF))


async def ensure_indexes():
    await db.users.create_index("email", unique=True)
    await db.login_attempts.create_index("identifier")
    await db.orders.create_index("auftragsnummer", unique=True)