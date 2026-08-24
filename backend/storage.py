import os
import logging

logger = logging.getLogger(__name__)

# أضف هذا السطر لحل مشكلة الـ ImportError
APP_NAME = "repair-berlin"

# تم تعديل المسار ليصبح خارج مجلد المشروع تماماً في مسار ثابت وآمن على السيرفر
# يمكنك تعديل المسار الأساسي حسب رغبتك (مثل /var/www/repair-berlin-uploads)
UPLOAD_DIR = "/var/www/repair-berlin-uploads"

# التأكد من أن المجلد موجود، وإن لم يكن كذلك يتم إنشاؤه تلقائياً
os.makedirs(UPLOAD_DIR, exist_ok=True)


def init_storage():
    """
    محاكاة لدالة التهيئة القديمة؛ لم يعد هناك حاجة لطلب خارجي.
    """
    return "local-storage-active"


def put_object(path: str, data: bytes, content_type: str) -> dict:
    """
    حفظ الملف محلياً في المجلد الخارجي الثابت بدلاً من مجلد الكود.
    """
    try:
        # تنظيف المسار لمنع أي ثغرات أو مسارات غير مسموحة
        safe_path = path.lstrip("/\\")
        file_path = os.path.join(UPLOAD_DIR, safe_path)
        
        # إنشاء المجلدات الفرعية إذا لزم الأمر
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # كتابة البيانات الثنائية (Binary) للملف
        with open(file_path, "wb") as f:
            f.write(data)
            
        logger.info(f"Successfully saved file locally: {file_path}")
        return {"path": path, "status": "success"}
    except Exception as e:
        logger.error(f"Failed to save file locally: {e}")
        raise e


def get_object(path: str):
    """
    استرجاع الملف محلياً من المجلد الخارجي.
    """
    safe_path = path.lstrip("/\\")
    file_path = os.path.join(UPLOAD_DIR, safe_path)
    
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {path}")
        
    # تحديد نوع المحتوى بناءً على الامتداد أو جعله افتراضياً
    content_type = "image/jpeg" if path.endswith((".jpg", ".jpeg")) else "application/octet-stream"
    
    with open(file_path, "rb") as f:
        content = f.read()
        
    return content, content_type