import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os

# ضع رابط الاتصال بقاعدة البيانات الخاصة بك هنا أو استورده من إعداداتك
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "repair_berlin" # اسم القاعدة لديك

async def migrate_old_media():
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    cursor = db.orders.find({"media": {"$exists": True, "$not": {"$size": 0}}})
    async for order in cursor:
        updated_media = []
        modified = False
        
        for m in order.get("media", []):
            if isinstance(m, dict):
                path = m.get("storage_path") or m.get("file_path") or m.get("url", "")
                # إذا لم يكن الرابط يبدأ بـ http، نقوم بتصحيحه وإكماله
                if path and not path.startswith("http"):
                    clean_path = path.lstrip("/\\")
                    # إذا كان المسار لا يحتوي على repair-berlin مسبقاً، نضيفه أو نعتمد المسار الحالي
                    full_url = f"https://handysync.de/uploads/{clean_path}"
                    
                    m["storage_path"] = full_url
                    m["file_path"] = full_url
                    m["url"] = full_url
                    modified = True
            updated_media.append(m)
            
        if modified:
            await db.orders.update_one(
                {"_id": order["_id"]},
                {"$set": {"media": updated_media}}
            )
            print(f"Updated order: {order.get('auftragsnummer', order['_id'])}")
            
    print("Migration completed successfully!")

if __name__ == "__main__":
    asyncio.run(migrate_old_media())