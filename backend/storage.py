import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

APP_NAME = "repair-berlin"

LOCAL_UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR = LOCAL_UPLOAD_DIR if not Path("/app/uploads").exists() else Path("/app/uploads")

os.makedirs(UPLOAD_DIR, exist_ok=True)


def init_storage():
    return "local-storage-active"


def put_object(path: str, data: bytes, content_type: str) -> dict:
    try:
        clean_path = path.lstrip("/\\")
        file_path = Path(UPLOAD_DIR) / clean_path
        
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(file_path, "wb") as f:
            f.write(data)
            
        logger.info(f"Successfully saved file locally: {file_path}")
        return {"path": path, "status": "success"}
    except Exception as e:
        logger.error(f"Failed to save file locally: {e}")
        raise e


def get_object(path: str):
    if not path:
        raise FileNotFoundError("Empty path")
        
    clean_path = path.lstrip("/\\")
    search_root = Path(UPLOAD_DIR)
    
    # البحث المباشر بالمسار الكامل
    file_path = search_root / clean_path
    
    # إذا لم يوجد، نبحث بالاسم في كافة المجلدات الفرعية تلقائياً
    if not file_path.exists():
        filename = Path(path).name
        for root, dirs, files in os.walk(search_root):
            if filename in files:
                file_path = Path(root) / filename
                break

    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {path} (checked at {file_path})")
        
    content_type = "image/jpeg" if path.endswith((".jpg", ".jpeg")) else "application/octet-stream"
    if path.endswith(".png"):
        content_type = "image/png"
    elif path.endswith((".mp4", ".webm")):
        content_type = "video/webm" if path.endswith(".webm") else "video/mp4"
    elif path.endswith(".pdf"):
        content_type = "application/pdf"
    
    with open(file_path, "rb") as f:
        content = f.read()
        
    return content, content_type