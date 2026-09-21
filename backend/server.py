import os
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
# تم الاستغناء عن StaticFiles التقليدي واستبداله بمسار ذكي للبحث العميق
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

# ==================== 2. إدارة ملفات الوسائط والرفع (Smart File Serving) ====================
os.makedirs("uploads", exist_ok=True)

@app.get("/uploads/{file_path:path}")
async def serve_upload_file(file_path: str):
    """
    مسار ذكي يبحث عن الملف بالمسار المباشر أو داخل أي مجلد فرعي عميق 
    (يتوافق تماماً مع بنية المجلدات الفرعية مثل repair-berlin/orders وغيرها)
    """
    # 1. محاولة البحث المباشر
    target_path = os.path.join("uploads", file_path)
    if os.path.exists(target_path) and os.path.isfile(target_path):
        return FileResponse(target_path)
    
    # 2. محاولة البحث العميق (Recursive Search) عن اسم الملف في جميع المجلدات الفرعية
    filename = os.path.basename(file_path)
    for root, dirs, files in os.walk("uploads"):
        if filename in files:
            found_path = os.path.join(root, filename)
            return FileResponse(found_path)
            
    raise HTTPException(status_code=404, detail="File not found")
# =========================================================================================

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
                    {"created_at": {"$lt": threshold.isoformat()}, "updated_at": {"$exists": False}}
                ],
                "sla_notified": {"$ne": True}
            }
            
            stagnant_orders = await db_instance.orders.find(query).to_list(100)
            
            for order in stagnant_orders:
                order_id = str(order["_id"])
                auftragsnummer = order.get("auftragsnummer", "")
                
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
                
                await db_instance.orders.update_one(
                    {"_id": order["_id"]},
                    {"$set": {"sla_notified": True}}
                )
        except Exception as e:
            logger.error(f"Error in SLA worker: {e}")
            
        await asyncio.sleep(3600)


@app.on_event("startup")
async def startup():
    try:
        await ensure_indexes()
        await seed_all()
        await db.orders.create_index([("branch_id", 1), ("created_at", -1)])
        logger.info("Database indexes and seeding initialized successfully.")
    except Exception as e:
        logger.error(f"Seeding failed: {e}")

    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

    asyncio.create_task(check_sla_background_worker(db))
    logger.info("SLA background worker started.")


@app.on_event("shutdown")
async def shutdown():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)