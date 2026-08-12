"""Lightweight admin notification helper.

Every action performed by a Mitarbeiter or Techniker creates a notification
document that the Admin dashboard polls for (visual toast + audible alert).
Actions performed by an admin themselves are intentionally skipped.
"""
import logging
from datetime import datetime, timezone
from typing import Optional

from db import db

logger = logging.getLogger(__name__)


async def push_notification(
    kind: str,
    title: str,
    message: str,
    by: str,
    by_role: str,
    order_id: Optional[str] = None,
    auftragsnummer: Optional[str] = None,
    meta: Optional[dict] = None,
):
    """Insert an admin notification.

    Only actions by mitarbeiter/techniker generate notifications (an admin does
    not need to be alerted about their own actions).
    """
    try:
        if by_role not in ("mitarbeiter", "techniker"):
            return None
        doc = {
            "kind": kind,
            "title": title,
            "message": message,
            "by": by,
            "by_role": by_role,
            "order_id": order_id,
            "auftragsnummer": auftragsnummer,
            "meta": meta or {},
            "read": False,
            "at": datetime.now(timezone.utc).isoformat(),
        }
        res = await db.notifications.insert_one(doc)
        return str(res.inserted_id)
    except Exception as e:  # never let a notification failure break the main action
        logger.error(f"push_notification failed: {e}")
        return None
