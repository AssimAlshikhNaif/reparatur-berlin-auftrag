"""Customer communication channels: WhatsApp + SMS (Twilio) and Email (Resend).

Every send function degrades gracefully: when the relevant credentials are not
configured, it logs the intended message and returns {"status": "not_configured"}
instead of raising, so the UI hooks stay fully functional before keys are added.
"""
import os
import asyncio
import logging

logger = logging.getLogger(__name__)


def _env(key: str) -> str:
    return (os.environ.get(key) or "").strip()


def sms_configured() -> bool:
    return bool(_env("TWILIO_ACCOUNT_SID") and _env("TWILIO_AUTH_TOKEN") and _env("TWILIO_PHONE_NUMBER"))


def whatsapp_configured() -> bool:
    return bool(_env("TWILIO_ACCOUNT_SID") and _env("TWILIO_AUTH_TOKEN") and _env("TWILIO_WHATSAPP_FROM"))


def email_configured() -> bool:
    return bool(_env("RESEND_API_KEY") and _env("SENDER_EMAIL"))


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


def _send_sms_sync(to: str, body: str) -> dict:
    client = _twilio_client()
    msg = client.messages.create(from_=_env("TWILIO_PHONE_NUMBER"), to=to, body=body)
    return {"status": "sent", "provider": "twilio", "sid": msg.sid, "to": to}


def _send_whatsapp_sync(to: str, body: str) -> dict:
    client = _twilio_client()
    frm = _env("TWILIO_WHATSAPP_FROM")
    if not frm.startswith("whatsapp:"):
        frm = f"whatsapp:{frm}"
    msg = client.messages.create(from_=frm, to=f"whatsapp:{to}", body=body)
    return {"status": "sent", "provider": "twilio", "sid": msg.sid, "to": to}


def _send_email_sync(to: str, subject: str, html: str) -> dict:
    import resend
    resend.api_key = _env("RESEND_API_KEY")
    res = resend.Emails.send({
        "from": _env("SENDER_EMAIL"),
        "to": [to],
        "subject": subject,
        "html": html,
    })
    return {"status": "sent", "provider": "resend", "email_id": res.get("id") if isinstance(res, dict) else None, "to": to}


async def send_sms(to: str, body: str) -> dict:
    number = to_e164(to)
    if not sms_configured():
        logger.info("[SMS not configured] would send to %s: %s", number, body)
        return {"status": "not_configured", "channel": "sms", "to": number}
    try:
        return await asyncio.to_thread(_send_sms_sync, number, body)
    except Exception as e:
        logger.error("SMS send failed: %s", e)
        return {"status": "error", "channel": "sms", "to": number, "error": str(e)}


async def send_whatsapp(to: str, body: str) -> dict:
    number = to_e164(to)
    if not whatsapp_configured():
        logger.info("[WhatsApp not configured] would send to %s: %s", number, body)
        return {"status": "not_configured", "channel": "whatsapp", "to": number}
    try:
        return await asyncio.to_thread(_send_whatsapp_sync, number, body)
    except Exception as e:
        logger.error("WhatsApp send failed: %s", e)
        return {"status": "error", "channel": "whatsapp", "to": number, "error": str(e)}


async def send_email(to: str, subject: str, html: str) -> dict:
    if not email_configured():
        logger.info("[Email not configured] would send to %s: %s", to, subject)
        return {"status": "not_configured", "channel": "email", "to": to}
    try:
        return await asyncio.to_thread(_send_email_sync, to, subject, html)
    except Exception as e:
        logger.error("Email send failed: %s", e)
        return {"status": "error", "channel": "email", "to": to, "error": str(e)}
