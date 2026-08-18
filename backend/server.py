import os
import logging
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from db import client
from routes import router as api_router
from seed import seed_all, ensure_indexes
from storage import init_storage
from auth import auth_router
from purchases import router as purchases_router

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Reparatur-Verwaltung Berlin")

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

@app.on_event("startup")
async def startup():
    try:
        await ensure_indexes()
        await seed_all()
        logger.info("Database initialized and seeded successfully.")
    except Exception as e:
        logger.error(f"Seeding failed: {e}")
        logger.error("Please check if MongoDB is running and MONGO_DETAILS in .env is correct.")

    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

@app.on_event("shutdown")
async def shutdown():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=True)