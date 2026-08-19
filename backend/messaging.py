"""Customer communication channels: WhatsApp + SMS (Twilio) and Email (Resend).

Every send function degrades gracefully: when the relevant credentials are not
configured, it logs the intended message and returns {"status": "not_configured"}
instead of raising, so the UI hooks stay fully functional before keys are added.
"""
import os
import asyncio
import logging
from db import db
from bson import ObjectId

logger = logging.getLogger(__name__)


def _env(key: str) -> str:
    return (os.environ.get(key) or "").strip()


def sms_configured() -> bool:
    return bool(_env("TWILIO_ACCOUNT_SID") and _env("TWILIO_AUTH_TOKEN") and _env("TWILIO_PHONE_NUMBER"))


def whatsapp_configured() -> bool:
    # يمكننا اعتماد تويليو كخدمة أساسية للإرسال، مع استخدام رقم الفرع كمرسل
    return bool(_env("TWILIO_ACCOUNT_SID") and _env("TWILIO_AUTH_TOKEN"))


def email_configured() -> bool:
    return bool(_env("RESEND_API_KEY"))


def channel_status() -> dict:
    return {
        "sms": sms_configured(),
        "whatsapp": whatsapp_configured(),
        "email": email_configured(),
    }


def to_e164(phone: str, default_cc: str = "49") -> str:
    """Best-effort normalization to E.164 (defaults to German country code)."""
    p = (phone or "").strip()
    if p.startswith("+"):
        return "+" + "".join(c for c in p[1:] if c.isdigit())
    digits = "".join(c for c in p if c.isdigit())
    if digits.startswith("00"):
        digits = digits[2:]
    elif digits.startswith("0"):
        digits = default_cc + digits[1:]
    elif not digits.startswith(default_cc):
        digits = default_cc + digits
    return "+" + digits


def _twilio_client():
    from twilio.rest import Client
    return Client(_env("TWILIO_ACCOUNT_SID"), _env("TWILIO_AUTH_TOKEN"))


async def _get_branch_info(branch_id):
    """جلب بيانات الفرع (الواتساب والإيميل) من قاعدة البيانات"""
    if not branch_id:
        return None
    try:
        # تحويل الـ ID لـ ObjectId إذا كان نصياً
        b_id = ObjectId(branch_id) if isinstance(branch_id, str) else branch_id
        return await db.branches.find_one({"_id": b_id})
    except Exception as e:
        logger.error("Error fetching branch info: %s", e)
        return None


def _send_sms_sync(to: str, body: str, sender_number: str = None) -> dict:
    client = _twilio_client()
    from_num = sender_number or _env("TWILIO_PHONE_NUMBER")
    msg = client.messages.create(from_=from_num, to=to, body=body)
    return {"status": "sent", "provider": "twilio", "sid": msg.sid, "to": to}


def _send_whatsapp_sync(to: str, body: str, branch_whatsapp: str = None) -> dict:
    client = _twilio_client()
    # استخدام رقم الواتساب الخاص بالفرع المخزن في قاعدة البيانات، وإذا لمطوّف نلجأ للافتراضي
    frm = branch_whatsapp or _env("TWILIO_WHATSAPP_FROM")
    if not frm:
        frm = _env("TWILIO_PHONE_NUMBER")
    
    if not frm.startswith("whatsapp:"):
        frm = f"whatsapp:{frm}"
        
    msg = client.messages.create(from_=frm, to=f"whatsapp:{to}", body=body)
    return {"status": "sent", "provider": "twilio", "sid": msg.sid, "to": to}


def _send_email_sync(to: str, subject: str, html: str, branch_email: str = None) -> dict:
    import resend
    resend.api_key = _env("RESEND_API_KEY")
    
    # استخدام إيميل الفرع الخاص، أو الإيميل الافتراضي العام
    sender_email = branch_email or _env("SENDER_EMAIL")
    
    res = resend.Emails.send({
        "from": sender_email,
        "to": [to],
        "subject": subject,
        "html": html,
    })
    return {"status": "sent", "provider": "resend", "email_id": res.get("id") if isinstance(res, dict) else None, "to": to}


async def send_sms(to: str, body: str, branch_id=None) -> dict:
    number = to_e164(to)
    if not sms_configured():
        logger.info("[SMS not configured] would send to %s: %s", number, body)
        return {"status": "not_configured", "channel": "sms", "to": number}
    
    branch = await _get_branch_info(branch_id)
    sender_phone = branch.get("whatsapp") if branch else None
    
    try:
        return await asyncio.to_thread(_send_sms_sync, number, body, sender_phone)
    except Exception as e:
        logger.error("SMS send failed: %s", e)
        return {"status": "error", "channel": "sms", "to": number, "error": str(e)}


async def send_whatsapp(to: str, body: str, branch_id=None) -> dict:
    number = to_e164(to)
    if not whatsapp_configured():
        logger.info("[WhatsApp not configured] would send to %s: %s", number, body)
        return {"status": "not_configured", "channel": "whatsapp", "to": number}
    
    # جلب بيانات الفرع المرتبط بالطلب لمعرفة رقمه المخصص
    branch = await _get_branch_info(branch_id)
    branch_whatsapp = branch.get("whatsapp") if branch else None
    
    try:
        return await asyncio.to_thread(_send_whatsapp_sync, number, body, branch_whatsapp)
    except Exception as e:
        logger.error("WhatsApp send failed: %s", e)
        return {"status": "error", "channel": "whatsapp", "to": number, "error": str(e)}


async def send_email(to: str, subject: str, html: str, branch_id=None) -> dict:
    if not email_configured():
        logger.info("[Email not configured] would send to %s: %s", to, subject)
        return {"status": "not_configured", "channel": "email", "to": to}
    
    # جلب بيانات الفرع لمعرفة إيميله المخصص
    branch = await _get_branch_info(branch_id)
    branch_email = branch.get("email") if branch else None
    
    try:
        return await asyncio.to_thread(_send_email_sync, to, subject, html, branch_email)
    except Exception as e:
        logger.error("Email send failed: %s", e)
        return {"status": "error", "channel": "email", "to": to, "error": str(e)}