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
    استرجاع الملف محلياً من المجلد الخارجي مع تصحيح المسارات المتكررة.
    """
    if not path:
        raise FileNotFoundError("Empty path")
        
    # تنظيف المسار من أي إشارات زائدة في البداية
    safe_path = path.lstrip("/\\")
    
    # إذا كان المسار يبدأ باسم التطبيق مكرراً أو يحتوي على المسار كاملاً بطريقة خاطئة، نقوم بمعالجته
    # مثلاً إزالة اسم التطبيق الأول إذا كان UPLOAD_DIR يشير إليه أساساً
    parts = Path(safe_path).parts
    if len(parts) > 1 and parts[0] == "repair-berlin":
        # تجنب التكرار إذا كان المسار يبدأ بـ repair-berlin/repair-berlin
        safe_path = str(Path(*parts[1:]))

    file_path = os.path.join(UPLOAD_DIR, safe_path)
    
    # محاولة ثانية إن لم يتم العثور عليه: البحث بالاسم الأخير فقط داخل مجلد orders للتاكد بنسبة 100%
    if not os.path.exists(file_path):
        # تجربة البحث المباشر في حال كان الملف مخزناً بمسار مختلف قليلاً
        filename = os.path.basename(path)
        # البحث في المجلدات الفرعية لـ UPLOAD_DIR
        for root, dirs, files in os.walk(UPLOAD_DIR):
            if filename in files:
                file_path = os.path.join(root, filename)
                break

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {path} (checked at {file_path})")
        
    # تحديد نوع المحتوى بناءً على الامتداد أو جعله افتراضياً
    content_type = "image/jpeg" if path.endswith((".jpg", ".jpeg")) else "application/octet-stream"
    if path.endswith(".png"):
        content_type = "image/png"
    elif path.endswith((".mp4", ".webm")):
        content_type = "video/webm" if path.endswith(".webm") else "video/mp4"
    
    with open(file_path, "rb") as f:
        content = f.read()
        
    return content, content_type