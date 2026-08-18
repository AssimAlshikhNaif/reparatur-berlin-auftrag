import os
import logging
from datetime import datetime, timezone

from db import db
from auth import hash_password, verify_password

logger = logging.getLogger(__name__)

# فروعك الحقيقية. لإضافة فرع جديد لاحقاً بالمستقبل، ضيفي اسمه هون وأعيدي تشغيل
# الباك اند مرة وحدة (docker compose up --build -d) — رح يتضاف تلقائياً بأول تشغيل.
BRANCHES = [
    "Phone Store Mobile",
    "Praxis Smartphone",
    "Handy & Laptop Krankenhaus",
    "Technik Phone",
    "Smartphone Apotheke",
]

SEED_PASSWORD = "Repair2026!"

# فقط حساب المدير يُنشأ تلقائياً. أي موظف/تقني حقيقي تضيفيه من داخل التطبيق
# (لوحة التحكم -> إدارة المستخدمين)، مو من هون.
STAFF = [
    ("Admin User", "admin@repair.de", "admin"),
]


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