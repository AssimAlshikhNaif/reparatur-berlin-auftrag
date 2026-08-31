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
        "address": " Boxhagener str.123 , 10245 Berlin",
        "phone": " 030 81302550 ",
        "email": "",
        "steuernummer": "",
        "tax_number": "",
        "logo_url": "/logos/phone store.png"
    },
    {
        "name": "Praxis Smartphone",
        "address": " Schönhauser Allee 89-90, 10439 Berlin",
        "phone": " 030 23299000 ",
        "email": "",
        "steuernummer": "",
        "tax_number": "",
        "logo_url": "/logos/handy_laptop_praxi-removebg-preview.png"
    },
    {
        "name": " Smartphone Tegel",
        "address": " Gorkistr.17 , 13507 Berlin",
        "phone": " 015733555555 ",
        "email": "",
        "steuernummer": "",
        "tax_number": "",
        "logo_url": ""
    },
    {
        "name": "Handy & Laptop Krankenhaus",
        "address": " Pablo-Neruda-Str.2-4, 12559 Berlin ",
        "phone": " +49 1792087786 ",
        "email": "",
        "steuernummer": "",
        "tax_number": "",
        "logo_url": ""
    },
    {
        "name": "Technik Kingdom Handy",
        "address": " Bülowstraße 11, 10783 Berlin ",
        "phone": " +49 1779766660 ",
        "email": "",
        "steuernummer": "",
        "tax_number": "",
        "logo_url": ""
    },
    {
        "name": "Technik Phone",
        "address": "Frankfurter Alle 53 , 10247 Berlin",
        "phone": " 030 89650662 ",
        "email": "",
        "steuernummer": "",
        "tax_number": "",
        "logo_url": "/logos/basic-file.png"
    },
     {
        "name": "Smartphone Apotheke",
        "address": "Frankfurter Alle 41, 10247 Berlin",
        "phone": "+49 177 9777771",
        "email": "info@smartphone-apotheke.de",
        "steuernummer": "30/123/45678",
        "tax_number": "DE355296654",
        "logo_url": "/logos/logo-icon.png"
    },
     {
        "name": "M.T Postplatz",
        "address": "",
        "phone": "+49 ",
        "email": "",
        "steuernummer": "",
        "tax_number": "",
        "logo_url": ""
    },
     {
        "name": "M.T Pragerst 12",
       "address": "",
        "phone": "+49 ",
        "email": "",
        "steuernummer": "",
        "tax_number": "",
        "logo_url": ""
    },
     {
        "name": "M.T Hauptbahnof 4",
        "address": "",
        "phone": "+49 ",
        "email": "",
        "steuernummer": "",
        "tax_number": "",
        "logo_url": ""
     },
     {
        "name": "M.T Wittenberg",
        "address": "",
        "phone": "+49 ",
        "email": "",
        "steuernummer": "",
        "tax_number": "",
        "logo_url": ""
    },

    {
        "name": "Kauf park Laden",
       "address": "Landsberger Ch 17, 16356 Ahrensfelde",
        "phone": "01631222240 ",
        "email": "",
        "steuernummer": "",
        "tax_number": "",
        "logo_url": ""
    },
         {
        "name": "A 10 center",
        "address": "",
        "phone": "+49 ",
        "email": "",
        "steuernummer": "",
        "tax_number": "",
        "logo_url": ""
    },
            {
        "name": "Linden Center",
        "address": "",
        "phone": "+49 ",
        "email": "",
        "steuernummer": "",
        "tax_number": "",
        "logo_url": ""
    },
            {
        "name": "Victoria Center",
        "address": " im Victoria-Center (Kaufland, Marktstraße 6, 10317 Berlin",
        "phone": "+49 1639489567 ",
        "email": "",
        "steuernummer": "",
        "tax_number": "",
        "logo_url": ""
    },
            {
        "name": "Fixphone Spandau",
        "address": " Neuendorfer Str. 90, 13585 Bezirk Spandau ",
        "phone": "+49 15788833883 ",
        "email": "",
        "steuernummer": " 19/204/01447 ",
        "tax_number": " DE453817232 ",
        "logo_url": "/logos/PoneFix.png"
    },
            {
        "name": "Media Technik Obai",
        "address": " Dörpfeldstraße 21, 12489 Berlin",
        "phone": "+49 15218432160 ",
        "email": " mediatechnik235@gmail.com",
        "steuernummer": "",
        "tax_number": "",
        "logo_url": "/logos/mediatecnikberlin.png"
    },
            {
        "name": "Tempelhof Hafen",
        "address": "",
        "phone": "+49 ",
        "email": "",
        "steuernummer": "",
        "tax_number": "",
        "logo_url": ""
    },
            {
        "name": "MediaPhone24",
        "address": " Greifswalder Str. 157, 10409 Berlin ",
        "phone": "+49 1787477747 ",
        "email": " Info@mediaphone24.de ",
        "steuernummer": "31/204/00736",
        "tax_number": " DE453817232 ",
        "logo_url": "/logos/Mediaphone24.png"
    }

]

SEED_PASSWORD = "Repair2026!"

STAFF = [
    ("Admin User", "admin@repair.de", "admin"),
    ("Chris", "chris@repair.de", "techniker"),
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
        
        # تجهيز بيانات الفرع الكاملة
        branch_doc = {
            "name": name,
            "address": branch_data.get("address", ""),
            "phone": branch_data.get("phone", "+49 "),
            "email": branch_data.get("email", ""),
            "whatsapp": branch_data.get("whatsapp", ""),
            "steuernummer": branch_data.get("steuernummer", ""),
            "tax_number": branch_data.get("tax_number", ""),
            "logo_url": branch_data.get("logo_url", "")
        }
        
        if existing:
            # تحديث جميع حقول الفرع بناءً على القائمة المحدثة
            await db.branches.update_one(
                {"name": name},
                {"$set": branch_doc}
            )
            branch_map[name] = str(existing["_id"])
        else:
            branch_doc["created_at"] = datetime.now(timezone.utc).isoformat()
            res = await db.branches.insert_one(branch_doc)
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