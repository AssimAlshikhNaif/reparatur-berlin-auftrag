import os
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI
# 1. استيراد StaticFiles هنا لخدمة المجلدات مباشرة
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from db import client, db  
from routes import router as api_router, push_notification  
from seed import seed_all, ensure_indexes
from storage import init_storage
from auth import auth_router
from purchases import router as purchases_router

# 2. تعريف التطبيق أولاً
app = FastAPI(title="Reparatur-Verwaltung Berlin")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== 2. إضافة StaticFiles Mount هنا ====================
# التأكد من إنشاء مجلد uploads محلياً إن لم يكن موجوداً
os.makedirs("uploads", exist_ok=True)
# ربط مسار الـ /uploads بالقرص الصلب مباشرة ليعمل الرابط الثابت
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
# =========================================================================

# إعداد CORS للتعامل مع الطلبات الآتية من React
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8001",
    "http://127.0.0.1:8001",
    "http://167.235.234.46:3000",
    "http://167.235.234.46",
]  

frontend_env = os.environ.get("FRONTEND_URL")
if frontend_env and frontend_env != "*":
    origins.append(frontend_env)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(auth_router)
app.include_router(api_router)
app.include_router(purchases_router)


# ==================== SLA BACKGROUND WORKER ====================
async def check_sla_background_worker(db_instance):
    """مهمة تعمل في الخلفية لمراقبة الـ SLA وإرسال التنبيهات تلقائياً"""
    while True:
        try:
            threshold = datetime.now(timezone.utc) - timedelta(days=3)
            query = {
                "status": {"$nin": ["FERTIG", "ABGEHOLT", "STORNIERT"]},
                "$or": [
                    {"updated_at": {"$lt": threshold.isoformat()}},
                    # تم تصحيح الرموز وإزالة الأخطاء المطبعية هنا
                    {"created_at": {"\(lt": threshold.isoformat()}, "updated_at": {"\)exists": False}}
                ],
                "sla_notified": {"$ne": True}
            }
            
            stagnant_orders = await db_instance.orders.find(query).to_list(100)
            
            for order in stagnant_orders:
                order_id = str(order["_id"])
                auftragsnummer = order.get("auftragsnummer", "")
                
                # إرسال إشعار تلقائي عبر دالة الإشعارات
                try:
                    await push_notification(
                        kind="SLA_WARNING",
                        title="تنبيه تأخير SLA (3 أيام)",
                        message=f"الطلب رقم {auftragsnummer} لم يتغير حالته منذ أكثر من 3 أيام.",
                        by="System Worker",
                        by_role="system",
                        order_id=order_id,
                        auftragsnummer=auftragsnummer,
                    )
                except Exception as ex:
                    logger.error(f"Failed to push SLA notification: {ex}")
                
                # تعليم الطلب بأنه تم تنبيهه لتجنب التكرار
                await db_instance.orders.update_one(
                    {"_id": order["_id"]},
                    {"$set": {"sla_notified": True}}
                )
        except Exception as e:
            logger.error(f"Error in SLA worker: {e}")
            
        # فحص مرة كل ساعة (3600 ثانية)
        await asyncio.sleep(3600)


@app.on_event("startup")
async def startup():
    try:
        await ensure_indexes()
        await seed_all()
        
        # إضافة الفهرس الخاص بالـ branch_id والـ created_at هنا لضمان السرعة الخارقة
        await db.orders.create_index([("branch_id", 1), ("created_at", -1)])
        logger.info("Database indexes and seeding initialized successfully.")
        
    except Exception as e:
        logger.error(f"Seeding failed: {e}")
        logger.error("Please check if MongoDB is running and MONGO_DETAILS in .env is correct.")

    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

    # --- تشغيل مراقبة الـ SLA في الخلفية عند بدء التشغيل ---
    asyncio.create_task(check_sla_background_worker(db))
    logger.info("SLA background worker started.")


@app.on_event("shutdown")
async def shutdown():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)