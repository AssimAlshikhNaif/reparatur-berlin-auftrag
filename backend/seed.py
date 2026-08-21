import os
import logging
from datetime import datetime, timezone

from db import db
from auth import hash_password, verify_password

logger = logging.getLogger(__name__)

# الفروع الحقيقية مع تفاصيل الإيميل والواتساب الخاصة بكل فرع
BRANCHES = [
    {
        "name": "Phone Store Mobile",
        "email": "info@phone-store.de",
        "whatsapp": "+4915775111444"
    },
    {
        "name": "Praxis Smartphone",
        "email": "info@Praxis.de",
        "whatsapp": "+491631222227"
    },
    {
        "name": "Handy & Laptop Krankenhaus",
        "email": "info@handykrankenhaus.de",
        "whatsapp": "+491631222240"
    },
    {
        "name": "Technik Phone",
        "email": "info@technikphone.de",
        "whatsapp": "+4915751540257"
    },
    {
        "name": "Smartphone Apotheke",
        "email": "info@smartphone-apotheke.de",
        "whatsapp": "+491782931142"
    },
     {
        "name": "Smartphone Tegel ",
        "email": "info@smartphone-apotheke.de",
        "whatsapp": "+4915733555555"
    },
     {
        "name": "M.T Postplatz",
        "email": "",
        "whatsapp": "+"
    },
     {
        "name": "M.T Pragerst 12",
        "email": "",
        "whatsapp": "+"
    },
     {
        "name": "M.T Hauptbahnof 4",
        "email": "",
        "whatsapp": "+"
     },
     {
        "name": "M.T Wittenberg",
        "email": "",
        "whatsapp": "+"
    },

    {
        "name": "Kauf park Laden",
        "email": "info@phone-store.de",
        "whatsapp": "+491631222240"
    },


]

SEED_PASSWORD = "Repair2026!"

STAFF = [
    ("Admin User", "admin@repair.de", "admin"),
]


async def seed_all():
    admin_password = os.environ.get("ADMIN_PASSWORD", SEED_PASSWORD)

    # 1. استخراج أسماء الفروع فقط للمقارنة والحذف
    branch_names = [b["name"] for b in BRANCHES]
    
    # احذف أي فروع قديمة لم تعد موجودة في القائمة الجديدة
    await db.branches.delete_many({"name": {"$nin": branch_names}})

    branch_map = {}
    for branch_data in BRANCHES:
        name = branch_data["name"]
        existing = await db.branches.find_one({"name": name})
        
        if existing:
            # تحديث الإيميل والواتساب إذا تم تعديلهم
            await db.branches.update_one(
                {"name": name},
                {
                    "$set": {
                        "email": branch_data["email"],
                        "whatsapp": branch_data["whatsapp"]
                    }
                }
            )
            branch_map[name] = str(existing["_id"])
        else:
            res = await db.branches.insert_one({
                "name": name,
                "email": branch_data["email"],
                "whatsapp": branch_data["whatsapp"],
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