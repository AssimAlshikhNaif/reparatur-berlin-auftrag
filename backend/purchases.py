"""External parts procurement & tracking, linked per Auftrag (order).

Tracks: part name, external supplier link/URL, order timestamp, expected
arrival, actual arrival and status. Every create/update alerts the admin
(via notifications) and is written to the order audit log.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId

from db import db
from auth import get_current_user
from notify import push_notification

router = APIRouter(prefix="/api/purchases", tags=["purchases"])

# Procurement status lifecycle
PURCHASE_STATES = [
    "ANGEFRAGT",   # requested by technician
    "BESTELLT",    # ordered externally
    "UNTERWEGS",   # in transit / shipped
    "ANGEKOMMEN",  # arrived at shop
    "EINGEBAUT",   # installed into device
    "STORNIERT",   # cancelled
]

STATUS_LABELS = {
    "ANGEFRAGT": "Angefragt",
    "BESTELLT": "Bestellt",
    "UNTERWEGS": "Unterwegs",
    "ANGEKOMMEN": "Angekommen",
    "EINGEBAUT": "Eingebaut",
    "STORNIERT": "Storniert",
}


class PurchaseCreate(BaseModel):
    order_id: str
    part_name: str
    supplier_url: Optional[str] = ""
    notes: Optional[str] = ""
    price: Optional[float] = None
    status: Optional[str] = "ANGEFRAGT"
    expected_arrival: Optional[str] = None  # ISO datetime string


class PurchaseUpdate(BaseModel):
    part_name: Optional[str] = None
    supplier_url: Optional[str] = None
    notes: Optional[str] = None
    price: Optional[float] = None
    status: Optional[str] = None
    expected_arrival: Optional[str] = None
    actual_arrival: Optional[str] = None


def _serialize(p: dict, user: dict) -> dict:
    out = {
        "id": str(p["_id"]),
        "order_id": p.get("order_id"),
        "part_name": p.get("part_name", ""),
        "supplier_url": p.get("supplier_url", ""),
        "notes": p.get("notes", ""),
        "status": p.get("status", "ANGEFRAGT"),
        "status_label": STATUS_LABELS.get(p.get("status", "ANGEFRAGT"), p.get("status", "")),
        "order_timestamp": p.get("order_timestamp"),
        "expected_arrival": p.get("expected_arrival"),
        "actual_arrival": p.get("actual_arrival"),
        "created_by": p.get("created_by_name") or p.get("requested_by_name"),
        "created_at": p.get("created_at"),
        "updated_at": p.get("updated_at"),
    }
    # Technicians must not see any pricing
    if user.get("role") != "techniker":
        out["price"] = float(p.get("price") or 0)
    return out


async def _order_summary(order_id: str):
    try:
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
    except Exception:
        order = None
    return order


async def _log_audit(order_id: str, action: str, detail: str, by: str):
    await db.audit_log.insert_one({
        "order_id": order_id, "action": action, "detail": detail,
        "by": by, "at": datetime.now(timezone.utc).isoformat(),
    })


@router.get("/alerts")
async def get_arrival_alerts(current_user=Depends(get_current_user)):
    """Procurement items that are due TODAY or OVERDUE and not yet arrived.
    Admin: all; Mitarbeiter: own branch; Techniker: 403."""
    if current_user["role"] not in ("admin", "mitarbeiter"):
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    from datetime import date as _date
    today = datetime.now(timezone.utc).date()
    done_states = {"ANGEKOMMEN", "EINGEBAUT", "STORNIERT"}

    purchases = await db.purchases.find().sort("expected_arrival", 1).to_list(2000)
    order_ids = []
    for p in purchases:
        oid = p.get("order_id")
        if oid:
            try:
                order_ids.append(ObjectId(oid))
            except Exception:
                pass
    orders = await db.orders.find({"_id": {"$in": order_ids}}).to_list(2000) if order_ids else []
    omap = {str(o["_id"]): o for o in orders}
    user_branch = current_user.get("branch_id")

    out = []
    for p in purchases:
        if p.get("status") in done_states:
            continue
        exp = p.get("expected_arrival")
        if not exp:
            continue
        try:
            exp_date = _date.fromisoformat(str(exp)[:10])
        except Exception:
            continue
        if exp_date > today:
            continue  # not due yet
        order = omap.get(p.get("order_id"))
        if current_user["role"] == "mitarbeiter":
            if not order or order.get("branch_id") != user_branch:
                continue
        item = _serialize(p, current_user)
        item["due_category"] = "OVERDUE" if exp_date < today else "TODAY"
        item["days_overdue"] = (today - exp_date).days
        if order:
            item["auftragsnummer"] = order.get("auftragsnummer")
            item["device_brand"] = order.get("device_brand")
            item["device_model"] = order.get("device_model")
            item["customer_name"] = order.get("customer_name")
            item["order_status"] = order.get("status")
        else:
            item["auftragsnummer"] = None
            item["device_brand"] = item["device_model"] = item["customer_name"] = None
            item["order_status"] = None
        out.append(item)
    # Overdue first, then by expected date ascending
    out.sort(key=lambda x: (0 if x["due_category"] == "OVERDUE" else 1, x.get("expected_arrival") or ""))
    return out


@router.get("/order/{order_id}")
async def get_purchases_by_order(order_id: str, current_user=Depends(get_current_user)):
    purchases = await db.purchases.find({"order_id": order_id}).sort("created_at", -1).to_list(200)
    return [_serialize(p, current_user) for p in purchases]


@router.get("/all")
async def get_all_purchases(current_user=Depends(get_current_user)):
    """Centralized procurement list across ALL orders (Admin: all; Mitarbeiter: own
    branch). Technicians are not allowed here."""
    if current_user["role"] not in ("admin", "mitarbeiter"):
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    purchases = await db.purchases.find().sort("created_at", -1).to_list(2000)
    order_ids = []
    for p in purchases:
        oid = p.get("order_id")
        if oid:
            try:
                order_ids.append(ObjectId(oid))
            except Exception:
                pass
    orders = await db.orders.find({"_id": {"$in": order_ids}}).to_list(2000) if order_ids else []
    omap = {str(o["_id"]): o for o in orders}

    user_branch = current_user.get("branch_id")
    out = []
    for p in purchases:
        order = omap.get(p.get("order_id"))
        if current_user["role"] == "mitarbeiter":
            if not order or order.get("branch_id") != user_branch:
                continue
        item = _serialize(p, current_user)
        if order:
            item["auftragsnummer"] = order.get("auftragsnummer")
            item["device_brand"] = order.get("device_brand")
            item["device_model"] = order.get("device_model")
            item["customer_name"] = order.get("customer_name")
            item["order_status"] = order.get("status")
        else:
            item["auftragsnummer"] = None
            item["device_brand"] = item["device_model"] = item["customer_name"] = None
            item["order_status"] = None
        out.append(item)
    return out


@router.post("")
@router.post("/")
async def create_purchase(data: PurchaseCreate, current_user=Depends(get_current_user)):
    if current_user["role"] not in ("admin", "mitarbeiter", "techniker"):
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    status = data.status if data.status in PURCHASE_STATES else "ANGEFRAGT"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "order_id": data.order_id,
        "part_name": data.part_name,
        "supplier_url": data.supplier_url or "",
        "notes": data.notes or "",
        "price": float(data.price) if data.price is not None else None,
        "status": status,
        "order_timestamp": now,
        "expected_arrival": data.expected_arrival,
        "actual_arrival": None,
        "created_by_id": str(current_user["_id"]),
        "created_by_name": current_user["name"],
        "created_by_role": current_user["role"],
        "created_at": now,
        "updated_at": now,
    }
    res = await db.purchases.insert_one(doc)
    doc["_id"] = res.inserted_id

    order = await _order_summary(data.order_id)
    auftragsnummer = order.get("auftragsnummer") if order else None
    await _log_audit(data.order_id, "BESCHAFFUNG",
                     f"Teil-Beschaffung angelegt: {data.part_name} ({STATUS_LABELS.get(status, status)})",
                     current_user["name"])
    await push_notification(
        kind="BESCHAFFUNG",
        title="Neue Teil-Beschaffung",
        message=f"{current_user['name']} hat '{data.part_name}' für Auftrag {auftragsnummer or ''} angelegt.",
        by=current_user["name"], by_role=current_user["role"],
        order_id=data.order_id, auftragsnummer=auftragsnummer,
    )
    return _serialize(doc, current_user)


@router.patch("/{purchase_id}")
async def update_purchase(purchase_id: str, data: PurchaseUpdate, current_user=Depends(get_current_user)):
    if current_user["role"] not in ("admin", "mitarbeiter", "techniker"):
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    try:
        existing = await db.purchases.find_one({"_id": ObjectId(purchase_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Ungültige ID")
    if not existing:
        raise HTTPException(status_code=404, detail="Beschaffung nicht gefunden")

    updates = {}
    for field in ("part_name", "supplier_url", "notes", "expected_arrival", "actual_arrival"):
        if hasattr(data, field):  # ◄ حماية ضد أي AttributeError
            val = getattr(data, field, None)
            if val is not None:
                updates[field] = val
    # Technicians are not allowed to set/see prices
    if data.price is not None and current_user["role"] != "techniker":
        updates["price"] = float(data.price)

    status_changed = False
    if data.status is not None:
        if data.status not in PURCHASE_STATES:
            raise HTTPException(status_code=400, detail="Ungültiger Status")
        updates["status"] = data.status
        status_changed = data.status != existing.get("status")
        # Auto-stamp actual arrival when marked as arrived
        if data.status == "ANGEKOMMEN" and not existing.get("actual_arrival") and data.actual_arrival is None:
            updates["actual_arrival"] = datetime.now(timezone.utc).isoformat()

    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.purchases.update_one({"_id": ObjectId(purchase_id)}, {"$set": updates})

    merged = {**existing, **updates}
    order = await _order_summary(existing.get("order_id"))
    auftragsnummer = order.get("auftragsnummer") if order else None
    part_name = merged.get("part_name", "")

    if status_changed:
        new_label = STATUS_LABELS.get(data.status, data.status)
        await _log_audit(existing.get("order_id"), "BESCHAFFUNG",
                         f"Beschaffung '{part_name}' → {new_label}", current_user["name"])
        await push_notification(
            kind="BESCHAFFUNG",
            title="Beschaffungs-Status geändert",
            message=f"{current_user['name']}: '{part_name}' → {new_label} (Auftrag {auftragsnummer or ''}).",
            by=current_user["name"], by_role=current_user["role"],
            order_id=existing.get("order_id"), auftragsnummer=auftragsnummer,
        )
    elif updates:
        await push_notification(
            kind="BESCHAFFUNG",
            title="Beschaffung aktualisiert",
            message=f"{current_user['name']} hat '{part_name}' aktualisiert (Auftrag {auftragsnummer or ''}).",
            by=current_user["name"], by_role=current_user["role"],
            order_id=existing.get("order_id"), auftragsnummer=auftragsnummer,
        )

    return _serialize(merged, current_user)


@router.delete("/{purchase_id}")
async def delete_purchase(purchase_id: str, current_user=Depends(get_current_user)):
    if current_user["role"] not in ("admin", "mitarbeiter"):
        raise HTTPException(status_code=403, detail="Nur Admin und Mitarbeiter dürfen löschen")
    try:
        existing = await db.purchases.find_one({"_id": ObjectId(purchase_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Ungültige ID")
    if not existing:
        raise HTTPException(status_code=404, detail="Beschaffung nicht gefunden")
    await db.purchases.delete_one({"_id": ObjectId(purchase_id)})
    await _log_audit(existing.get("order_id"), "BESCHAFFUNG",
                     f"Beschaffung gelöscht: {existing.get('part_name', '')}", current_user["name"])
    return {"message": "Beschaffung gelöscht"}
