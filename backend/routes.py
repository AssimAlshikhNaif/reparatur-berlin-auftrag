import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from bson import ObjectId

from fastapi import (APIRouter, HTTPException, Depends, UploadFile, File,
                     Query, Header, WebSocket, WebSocketDisconnect, Response, Form)
from pydantic import BaseModel
from fastapi.responses import Response


from db import db
from auth import get_current_user, require_roles, decode_user_from_token
from storage import put_object, get_object, APP_NAME
from notify import push_notification
import messaging

class OrderNoteCreate(BaseModel):
    content: str
    is_internal: bool = True  # افتراضياً ملاحظة داخلية للموظفين

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

WARRANTY_DEFAULT_MONTHS = 6

# ---- Status constants ----
STATUS_FLOW = [
    "ANGENOMMEN", "ZUGEWIESEN", "AKZEPTIERT", "WARTEN_FREIGABE", "IN_BEARBEITUNG",
    "WARTEN_ERSATZTEIL", "FERTIG", "ABGEHOLT", "ABGELEHNT", "STORNIERT",
]
# Technical phases a technician may set (never administrative/final states like ABGEHOLT)
TECH_ALLOWED_STATUS = {"ANGENOMMEN", "WARTEN_FREIGABE", "IN_BEARBEITUNG", "WARTEN_ERSATZTEIL", "FERTIG"}
COST_STATES = {"WARTET", "BESTAETIGT", "ABGELEHNT"}
TAX_RATE = 0.19
FINAL_STATES = {"ABGEHOLT", "ABGELEHNT" , "STORNIERT"}
PII_FIELDS = ["customer_name", "customer_phone", "customer_email", "customer_address"]
# Felder, die über den Bearbeiten-Dialog nachträglich korrigiert werden dürfen.
EDITABLE_ORDER_FIELDS = [
    "customer_name", "customer_phone", "customer_email", "customer_address",
    "device_brand", "device_model", "imei", "device_passcode", "issue_description",
]


# ---- Helpers ----
def working_days_since(iso_ts: str) -> int:
    try:
        start = datetime.fromisoformat(iso_ts)
    except Exception:
        return 0
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    now = datetime.now(timezone.utc)
    days = 0
    cur = start.date()
    end = now.date()
    while cur < end:
        cur += timedelta(days=1)
        if cur.weekday() < 5:
            days += 1
    return days


def is_sla_breached(order: dict) -> bool:
    if order.get("status") in FINAL_STATES:
        return False
    return working_days_since(order.get("updated_at", order.get("created_at", ""))) >= 3


def compute_costs(order: dict) -> dict:
    d = float(order.get("diagnosis_fee") or 0)
    l = float(order.get("labor_cost") or 0)
    p = float(order.get("parts_cost") or 0)
    # Die eingegebenen Beträge sind Bruttopreise (inkl. MwSt.) – das ist der
    # Endbetrag, den der Kunde zahlt. Netto und MwSt. werden daraus rückwirkend
    # herausgerechnet (Gesamt bleibt unverändert = Summe der Eingaben).
    gross = round(d + l + p, 2)
    net = round(gross / (1 + TAX_RATE), 2)
    tax = round(gross - net, 2)
    return {
        "diagnosis_fee": d, "labor_cost": l, "parts_cost": p,
        "net": net, "tax": tax, "gross": gross, "tax_rate": 19,
        "status": order.get("cost_status", "WARTET"),
    }


def compute_warranty(order: dict) -> dict:
    months = int(order.get("warranty_months") or 0)
    start = order.get("warranty_start")
    until = order.get("warranty_until")
    res = {
        "warranty_months": months,
        "warranty_start": start,
        "warranty_until": until,
        "under_warranty": False,
        "warranty_days_left": None,
    }
    if until:
        try:
            u = datetime.fromisoformat(until)
            if u.tzinfo is None:
                u = u.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            res["under_warranty"] = now <= u
            res["warranty_days_left"] = (u - now).days
        except Exception:
            pass
    return res


def serialize_order(order: dict, user: dict, light: bool = False) -> dict:
    o = dict(order)
    o["id"] = str(o.pop("_id"))
    o["sla_breached"] = is_sla_breached(order)
    o["working_days_open"] = working_days_since(order.get("updated_at", order.get("created_at", "")))
    o["cost"] = compute_costs(order)
    o["used_parts"] = order.get("used_parts", [])
    o["imei_unreadable"] = bool(order.get("imei_unreadable", False))
    o["diagnosis_payment_status"] = order.get("diagnosis_payment_status", "OPEN")
    o["imei_reminder"] = bool(order.get("imei_unreadable", False)) and not (order.get("imei") or "").strip()
    o.update(compute_warranty(order))
    # Signature presence flags (avoid shipping heavy base64 in list views)
    o["has_intake_signature"] = bool(order.get("intake_signature"))
    o["has_pickup_signature"] = bool(order.get("pickup_signature"))
    if light:
        o.pop("intake_signature", None)
        o.pop("pickup_signature", None)
    if user["role"] == "techniker":
        for f in PII_FIELDS:
            o.pop(f, None)
        o["dsgvo_masked"] = True
        # Signatures are customer PII/biometric — never expose to technicians
        o.pop("intake_signature", None)
        o.pop("pickup_signature", None)
        # Strict cost privacy: technicians must not see any pricing/costs
        o.pop("cost", None)
        for f in ("diagnosis_fee", "labor_cost", "parts_cost", "estimated_price"):
            o.pop(f, None)
        o["used_parts"] = [
            {k: v for k, v in p.items() if k not in ("unit_price", "total")}
            for p in o.get("used_parts", [])
        ]
        o["cost_hidden"] = True
    return o


async def _name_maps():
    branches = await db.branches.find().to_list(100)
    users = await db.users.find().to_list(500)
    bmap = {str(b["_id"]): b["name"] for b in branches}
    umap = {str(u["_id"]): u["name"] for u in users}
    return bmap, umap


def attach_names(o: dict, bmap: dict, umap: dict) -> dict:
    # ربط اسم الفرع
    o["branch_name"] = bmap.get(o.get("branch_id"), "—")
    
    # ربط اسم التقني
    tid = o.get("assigned_techniker_id") or o.get("technician_id")
    o["assigned_techniker_name"] = umap.get(tid) if tid else "—"
    
    # ربط اسم الموظف (الذي أنشأ الطلب)
    uid = o.get("user_id") or o.get("created_by") or o.get("mitarbeiter_id")
    o["mitarbeiter_name"] = umap.get(uid) if uid else "—"
    
    return o


async def log_audit(order_id: str, action: str, detail: str, by: str):
    await db.audit_log.insert_one({
        "order_id": order_id, "action": action, "detail": detail,
        "by": by, "at": datetime.now(timezone.utc).isoformat(),
    })


AUTO_STATUS_MESSAGES = {
    "WARTEN_FREIGABE": "Die Diagnose ist abgeschlossen. Wir warten auf Ihre Freigabe des Kostenvoranschlags, um mit der Reparatur zu beginnen.",
    "IN_BEARBEITUNG": "Ihr Gerät befindet sich jetzt in Reparatur. Wir halten Sie auf dem Laufenden.",
    "WARTEN_ERSATZTEIL": "Für Ihre Reparatur wird ein Ersatzteil bestellt. Wir informieren Sie, sobald es eingetroffen ist.",
    "FERTIG": "Gute Nachrichten! Ihre Reparatur ist abgeschlossen. Ihr Gerät kann abgeholt werden.",
    "ABGEHOLT": "Vielen Dank! Ihr Gerät wurde abgeholt. Wir wünschen Ihnen viel Freude damit.",
    "ABGELEHNT": "Ihr Reparaturauftrag wurde storniert/abgelehnt. Bei Fragen kontaktieren Sie uns bitte.",
    "STORNIERT": "Ihr Reparaturauftrag wurde storniert. Bei Fragen kontaktieren Sie uns bitte.",
}


async def auto_status_communication(order: dict, status: str, by_name: str):
    """Log an automated customer status notification (WhatsApp-style) when the
    order status changes to a customer-relevant state."""
    text = AUTO_STATUS_MESSAGES.get(status)
    if not text:
        return
    phone = order.get("customer_phone", "")
    now = datetime.now(timezone.utc).isoformat()
    auftrag = order.get("auftragsnummer", "")
    message = f"[Auftrag {auftrag}] {text}"
    await db.communications.insert_one({
        "order_id": str(order["_id"]),
        "channel": "auto",
        "to": phone,
        "message": message,
        "by": "System (automatisch)",
        "at": now,
    })


async def next_auftragsnummer() -> str:
    year = datetime.now(timezone.utc).year
    res = await db.counters.find_one_and_update(
        {"_id": f"auftrag-{year}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = res["seq"] if res else 1
    return f"RB-{year}-{seq:05d}"


async def next_invoice_number(branch_id: str) -> str:
    """GoBD: unique, gapless invoice number sequenced PER BRANCH per year."""
    year = datetime.now(timezone.utc).year
    branch_short = (branch_id or "0000")[-4:].upper()
    res = await db.counters.find_one_and_update(
        {"_id": f"invoice-{branch_id}-{year}"},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True,
    )
    seq = res["seq"] if res else 1
    return f"RE-{year}-{branch_short}-{seq:05d}"


# ---- Models ----
class OrderCreate(BaseModel):
    branch_id: str
    device_brand: str
    device_model: str
    media: Optional[List[str]] = []
    imei: Optional[str] = ""
    imei_unreadable: Optional[bool] = False
    device_passcode: Optional[str] = ""
    device_lock_type: Optional[str] = "none"  # none | pattern | pin | password
    issue_description: str
    customer_name: str
    customer_phone: Optional[str] = ""
    customer_email: Optional[str] = ""
    customer_address: Optional[str] = ""
    estimated_price: Optional[float] = None
    diagnosis_fee: Optional[float] = 0
    labor_cost: Optional[float] = 0
    parts_cost: Optional[float] = 0
    diagnosis_payment_status: Optional[str] = "OPEN"  # PAID | OPEN | NA
    warranty_months: Optional[int] = WARRANTY_DEFAULT_MONTHS
    assigned_techniker_id: Optional[str] = None
    intake_signature: Optional[str] = None
    intake_signed_name: Optional[str] = None
    is_reclamation: Optional[bool] = False
    reclamation_of: Optional[str] = None          # original order id
    reclamation_of_number: Optional[str] = None   # original auftragsnummer


class ImeiUpdate(BaseModel):
    imei: str


class SignatureInput(BaseModel):
    type: str  # "intake" | "pickup"
    signature: str  # base64 data URL
    signer_name: Optional[str] = ""


class InspectionItem(BaseModel):
    status: str = "NV"   # OK | NOK | NV
    note: Optional[str] = ""


class InspectionInput(BaseModel):
    checklist: dict = {}                 # {itemKey: {status, note}}
    display_type: Optional[str] = ""   # Original | In-Cell | OLED | Service-Pack
    battery_health: Optional[str] = "" # percentage as string
    notes: Optional[str] = ""
    inspection_type: Optional[str] = "end" # <--- أضف هذا السطر هنا ليتم استلام النوع بنجاح


class CostUpdate(BaseModel):
    diagnosis_fee: Optional[float] = None
    labor_cost: Optional[float] = None
    parts_cost: Optional[float] = None
    paid_amount: Optional[float] = None
    cost_status: Optional[str] = None
    diagnosis_payment_status: Optional[str] = None  # PAID | OPEN | NA


class UsedPartInput(BaseModel):
    inventory_id: str
    quantity: int = 1


class StatusUpdate(BaseModel):
    status: str
    reason: Optional[str] = ""


class AssignInput(BaseModel):
    techniker_id: str


class RejectInput(BaseModel):
    reason: str

class CancelInput(BaseModel):
    reason: str


class OrderEditInput(BaseModel):
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    customer_address: Optional[str] = None
    device_brand: Optional[str] = None
    device_model: Optional[str] = None
    imei: Optional[str] = None
    device_passcode: Optional[str] = None
    issue_description: Optional[str] = None

class UserCreate(BaseModel):
    name: str
    email: str
    role: str
    branch_id: Optional[str] = None
    password: str


class InventoryCreate(BaseModel):
    sku: str
    part_type: str
    brand: str
    device_model: str
    price: float
    quantity: int
    min_stock: int
    branch_id: Optional[str] = None


class InventoryUpdate(BaseModel):
    quantity: Optional[int] = None
    min_stock: Optional[int] = None
    price: Optional[float] = None


# ==================== BRANCHES ====================
# Per-branch branding/config defaults (DB values override these when present).
BRANCH_CONFIG = {}


class BranchCreate(BaseModel):
    name: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    city: Optional[str] = ""
    address: Optional[str] = ""


class BranchUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None


@router.get("/branches")
async def list_branches(current=Depends(get_current_user)):
    branches = await db.branches.find().to_list(100)
    out = []
    for b in branches:
        name = b.get("name", "")
        defaults = BRANCH_CONFIG.get(name, {"city": "", "address": "", "phone": "", "email": ""})
        out.append({
            "id": str(b["_id"]),
            "name": name,
            "city": b.get("city") or defaults["city"],
            "address": b.get("address") or defaults["address"],
            "phone": b.get("phone") or defaults["phone"],
            "email": b.get("email") or defaults["email"],
            "logo_url": b.get("logo_url") or "",
            "tax_number": b.get("tax_number") or "USt-IdNr.: DE123456789",
            "steuernummer": b.get("steuernummer") or "Steuernr.: 30/123/45678",
        })
    return out


@router.post("/branches")
async def create_branch(input: BranchCreate, current=Depends(require_roles("admin"))):
    name = (input.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name darf nicht leer sein")
    existing = await db.branches.find_one({"name": name})
    if existing:
        raise HTTPException(status_code=400, detail="Eine Filiale mit diesem Namen existiert bereits")
    doc = {
        "name": name,
        "phone": (input.phone or "").strip(),
        "email": (input.email or "").strip(),
        "city": (input.city or "").strip(),
        "address": (input.address or "").strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.branches.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    return doc


@router.put("/branches/{branch_id}")
async def update_branch(branch_id: str, input: BranchUpdate, current=Depends(require_roles("admin"))):
    branch = await db.branches.find_one({"_id": ObjectId(branch_id)})
    if not branch:
        raise HTTPException(status_code=404, detail="Filiale nicht gefunden")
    updates = {k: v for k, v in input.dict(exclude_unset=True).items() if v is not None}
    if "name" in updates:
        updates["name"] = updates["name"].strip()
        if not updates["name"]:
            raise HTTPException(status_code=400, detail="Name darf nicht leer sein")
        dup = await db.branches.find_one({"name": updates["name"], "_id": {"$ne": ObjectId(branch_id)}})
        if dup:
            raise HTTPException(status_code=400, detail="Eine Filiale mit diesem Namen existiert bereits")
    if updates:
        await db.branches.update_one({"_id": ObjectId(branch_id)}, {"$set": updates})
    updated = await db.branches.find_one({"_id": ObjectId(branch_id)})
    updated["id"] = str(updated.pop("_id"))
    return updated


@router.delete("/branches/{branch_id}")
async def delete_branch(branch_id: str, current=Depends(require_roles("admin"))):
    branch = await db.branches.find_one({"_id": ObjectId(branch_id)})
    if not branch:
        raise HTTPException(status_code=404, detail="Filiale nicht gefunden")
    in_use = await db.orders.count_documents({"branch_id": branch_id})
    if in_use > 0:
        raise HTTPException(status_code=400, detail=f"Filiale hat {in_use} Aufträge und kann nicht gelöscht werden")
    await db.branches.delete_one({"_id": ObjectId(branch_id)})
    return {"status": "deleted"}


# ==================== USERS (Admin only) ====================
@router.get("/users")
async def list_users(current=Depends(require_roles("admin"))):
    users = await db.users.find().to_list(200)
    out = []
    for u in users:
        out.append({
            "id": str(u["_id"]), "name": u["name"], "email": u["email"],
            "role": u["role"], "branch_id": u.get("branch_id"), "active": u.get("active", True),
        })
    return out


@router.get("/technicians")
async def list_technicians(current=Depends(get_current_user)):
    users = await db.users.find({"role": "techniker"}).to_list(200)
    return [{"id": str(u["_id"]), "name": u["name"]} for u in users]


@router.post("/users")
async def create_user(input: UserCreate, current=Depends(require_roles("admin"))):
    from auth import hash_password
    if input.role not in ("admin", "mitarbeiter", "techniker"):
        raise HTTPException(status_code=400, detail="Ungültige Rolle")
    email = input.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="E-Mail bereits vergeben")
    doc = {
        "name": input.name, "email": email, "role": input.role,
        "branch_id": input.branch_id, "password_hash": hash_password(input.password),
        "active": True, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    res = await db.users.insert_one(doc)
    return {"id": str(res.inserted_id), "name": input.name, "email": email, "role": input.role,
            "branch_id": input.branch_id, "active": True}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current=Depends(require_roles("admin"))):
    if user_id == str(current["_id"]):
        raise HTTPException(status_code=400, detail="Sie können sich nicht selbst löschen")
    await db.users.delete_one({"_id": ObjectId(user_id)})
    return {"message": "Benutzer gelöscht"}


# ==================== INVENTORY (Fully Updated) ====================
@router.get("/inventory")
async def list_inventory(current=Depends(get_current_user)):
    items = await db.inventory.find().to_list(2000)
    out = []
    for it in items:
        out.append({
            "id": str(it["_id"]), "sku": it.get("sku", ""), "part_type": it.get("part_type", ""),
            "brand": it.get("brand", ""), "device_model": it.get("device_model", ""), "price": float(it.get("price", 0)),
            "quantity": int(it.get("quantity", 0)), "min_stock": int(it.get("min_stock", 3)),
            "branch_id": it.get("branch_id"),
            "low_stock": int(it.get("quantity", 0)) <= int(it.get("min_stock", 3)),
        })
    return out


@router.post("/inventory")
async def create_inventory(input: InventoryCreate, current=Depends(get_current_user)):
    if current["role"] not in ("admin", "mitarbeiter"):
        raise HTTPException(status_code=403, detail="Keine Berechtigung")
    
    doc = input.model_dump()
    if not doc.get("branch_id") and current.get("branch_id"):
        doc["branch_id"] = current["branch_id"]
        
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.inventory.insert_one(doc)
    
    created_item = await db.inventory.find_one({"_id": res.inserted_id})
    return {
        "id": str(created_item["_id"]), "sku": created_item.get("sku", ""), "part_type": created_item.get("part_type", ""),
        "brand": created_item.get("brand", ""), "device_model": created_item.get("device_model", ""), "price": float(created_item.get("price", 0)),
        "quantity": int(created_item.get("quantity", 0)), "min_stock": int(created_item.get("min_stock", 3)),
        "branch_id": created_item.get("branch_id"),
        "low_stock": int(created_item.get("quantity", 0)) <= int(created_item.get("min_stock", 3))
    }


@router.post("/inventory/{item_id}/increment")
async def increment_inventory(item_id: str, current=Depends(get_current_user)):
    item = await db.inventory.find_one({"_id": ObjectId(item_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Ersatzteil nicht gefunden")
    
    new_qty = int(item.get("quantity", 0)) + 1
    await db.inventory.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {"quantity": new_qty, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    it = await db.inventory.find_one({"_id": ObjectId(item_id)})
    return {
        "id": str(it["_id"]), "sku": it.get("sku", ""), "part_type": it.get("part_type", ""),
        "brand": it.get("brand", ""), "device_model": it.get("device_model", ""), "price": float(it.get("price", 0)),
        "quantity": int(it.get("quantity", 0)), "min_stock": int(it.get("min_stock", 3)),
        "branch_id": it.get("branch_id"),
        "low_stock": int(it.get("quantity", 0)) <= int(it.get("min_stock", 3))
    }


@router.post("/inventory/{item_id}/consume")
async def consume_inventory(item_id: str, current=Depends(get_current_user)):
    item = await db.inventory.find_one({"_id": ObjectId(item_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Ersatzteil nicht gefunden")
    
    current_qty = int(item.get("quantity", 0))
    if current_qty <= 0:
        raise HTTPException(status_code=400, detail="Bestand ist bereits 0")
        
    new_qty = current_qty - 1
    await db.inventory.update_one(
        {"_id": ObjectId(item_id)},
        {"$set": {"quantity": new_qty, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    it = await db.inventory.find_one({"_id": ObjectId(item_id)})
    return {
        "id": str(it["_id"]), "sku": it.get("sku", ""), "part_type": it.get("part_type", ""),
        "brand": it.get("brand", ""), "device_model": it.get("device_model", ""), "price": float(it.get("price", 0)),
        "quantity": int(it.get("quantity", 0)), "min_stock": int(it.get("min_stock", 3)),
        "branch_id": it.get("branch_id"),
        "low_stock": int(it.get("quantity", 0)) <= int(it.get("min_stock", 3))
    }


@router.patch("/inventory/{item_id}")
async def update_inventory(item_id: str, input: InventoryUpdate, current=Depends(get_current_user)):
    updates = {k: v for k, v in input.model_dump().items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.inventory.update_one({"_id": ObjectId(item_id)}, {"$set": updates})
        
    it = await db.inventory.find_one({"_id": ObjectId(item_id)})
    if not it:
        raise HTTPException(status_code=404, detail="Ersatzteil nicht gefunden")
        
    return {
        "id": str(it["_id"]), "sku": it.get("sku", ""), "part_type": it.get("part_type", ""),
        "brand": it.get("brand", ""), "device_model": it.get("device_model", ""), "price": float(it.get("price", 0)),
        "quantity": int(it.get("quantity", 0)), "min_stock": int(it.get("min_stock", 3)),
        "branch_id": it.get("branch_id"),
        "low_stock": int(it.get("quantity", 0)) <= int(it.get("min_stock", 3))
    }


@router.delete("/inventory/{item_id}")
async def delete_inventory(item_id: str, current=Depends(require_roles("admin"))):
    await db.inventory.delete_one({"_id": ObjectId(item_id)})
    return {"message": "Ersatzteil gelöscht"}


# ==================== ORDERS ====================
async def _order_query_for_user(user: dict) -> dict:
    if user["role"] == "admin":
        return {}
    if user["role"] == "techniker":
        return {"assigned_techniker_id": str(user["_id"])}
    return {"branch_id": user.get("branch_id")}

@router.post("/orders/{order_id}/notes")
async def add_order_note(
    order_id: str,
    note_in: OrderNoteCreate,
    current: dict = Depends(get_current_user)
):
    # منع التقني من إضافة ملاحظات داخلية حساسة
    if current.get("role") == "techniker" and note_in.is_internal:
        raise HTTPException(
            status_code=403,
            detail="Technicians cannot add internal staff notes."
        )

    try:
        obj_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID format")

    order = await db.orders.find_one({"_id": obj_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    new_note = {
        "id": str(ObjectId()),
        "content": note_in.content,
        "author_name": current.get("name", "Unknown"),
        "is_internal": note_in.is_internal,
        "created_at": datetime.now(timezone.utc).isoformat()
    }

    # حفظ الملاحظة داخل مصفوفة notes في المستند
    await db.orders.update_one(
        {"_id": obj_id},
        {"$push": {"notes": new_note}}
    )

    return {"message": "Note added successfully", "note": new_note}

@router.get("/orders")
async def list_orders(
    status: Optional[str] = None, 
    sla: Optional[bool] = None,
    branch_id: Optional[str] = None, 
    limit: int = 50, 
    skip: int = 0, 
    current=Depends(get_current_user)
):
    print(">>> ENTERED /orders ENDPOINT <<<")
    
    try:
        query = await _order_query_for_user(current)
    except Exception:
        query = {}
    
    if status:
        query["status"] = status
        
    if branch_id:
        try:
            query["$or"] = [
                {"branch_id": branch_id},
                {"branch_id": ObjectId(branch_id)}
            ]
        except Exception:
            query["branch_id"] = branch_id
    
    # Projection شامل لجلب رقم الطلب، الحقول الأساسية، ومعرفات الموظفين والتقنيين
    try:
        orders = await db.orders.find(
            query,
            {
                "auftragsnummer": 1, "customer_name": 1, "device_model": 1, 
                "status": 1, "created_at": 1, "branch_id": 1, 
                "is_reclamation": 1, "warranty_until": 1, 
                "user_id": 1, "created_by": 1, "mitarbeiter_id": 1, "assigned_techniker_id": 1
            }
        ).sort("created_at", -1).skip(skip).to_list(length=limit)
    except Exception as e:
        print(f"DB Error in /orders: {e}")
        orders = []
    
    try:
        bmap, umap = await _name_maps()
    except Exception:
        bmap, umap = {}, {}

    result = []
    for o in orders:
        try:
            serialized = serialize_order(o, current, light=True)
            res_item = attach_names(serialized, bmap, umap)
            
            if sla:
                if res_item.get("sla_breached"):
                    result.append(res_item)
            else:
                result.append(res_item)
        except Exception:
            continue
            
    return result

@router.get("/orders/lookup/{auftragsnummer}")
async def lookup_order(auftragsnummer: str, current=Depends(get_current_user)):
    order = await db.orders.find_one({"auftragsnummer": auftragsnummer})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    if current["role"] == "techniker" and order.get("assigned_techniker_id") != str(current["_id"]):
        raise HTTPException(status_code=403, detail="Nicht zugewiesen")
    if current["role"] == "mitarbeiter" and order.get("branch_id") != current.get("branch_id"):
        raise HTTPException(status_code=403, detail="Anderer Filiale zugeordnet")
    bmap, umap = await _name_maps()
    return attach_names(serialize_order(order, current), bmap, umap)


@router.get("/orders/{order_id}")
async def get_order(order_id: str, current=Depends(get_current_user)):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    if current["role"] == "techniker" and order.get("assigned_techniker_id") != str(current["_id"]):
        raise HTTPException(status_code=403, detail="Nicht zugewiesen")
    if current["role"] == "mitarbeiter" and order.get("branch_id") != current.get("branch_id"):
        raise HTTPException(status_code=403, detail="Anderer Filiale zugeordnet")
    bmap, umap = await _name_maps()
    return attach_names(serialize_order(order, current), bmap, umap)


@router.delete("/orders/{order_id}")
async def delete_order(order_id: str, current=Depends(require_roles("admin"))):
    """Admin-only. Permanently deletes a single order plus its related
    operational records (procurement, chat, communications, notifications, files)."""
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    await db.orders.delete_one({"_id": ObjectId(order_id)})
    for coll in ("purchases", "chat_messages", "communications", "notifications", "audit_log", "files"):
        try:
            await db[coll].delete_many({"order_id": order_id})
        except Exception:
            pass
    return {"message": "Auftrag gelöscht", "auftragsnummer": order.get("auftragsnummer")}


@router.post("/orders")
async def create_order(input: OrderCreate, current=Depends(require_roles("admin", "mitarbeiter"))):
    # 1. التحقق من اسم العميل
    if not (input.customer_name or "").strip():
        raise HTTPException(status_code=400, detail="Kundenname ist erforderlich.")
    
    # 2. التحقق من توفر وسيلة تواصل واحدة على الأقل (هاتف أو إيميل)
    phone = (input.customer_phone or "").strip()
    email = (input.customer_email or "").strip()
    if not phone and not email:
        raise HTTPException(
            status_code=400, 
            detail="Mindestens eine Kontaktmöglichkeit (Telefonnummer oder E-Mail) ist erforderlich."
        )

    # 2. التحقق من تفاصيل الجهاز والمشكلة
    if not (input.device_brand or "").strip() or not (input.device_model or "").strip():
        raise HTTPException(status_code=400, detail="Gerätemarke und Modell sind erforderlich.")
    if not (input.issue_description or "").strip():
        raise HTTPException(status_code=400, detail="Fehlerbeschreibung (issue_description) ist erforderlich.")

    # 3. التحقق من الـ IMEI
    if not (input.imei or "").strip() and not input.imei_unreadable:
        raise HTTPException(
            status_code=400,
            detail="IMEI ist erforderlich. Falls das Gerät defekt / die IMEI nicht lesbar ist, bitte die Option 'Gerät defekt / IMEI nicht lesbar' aktivieren.",
        )

    now = datetime.now(timezone.utc).isoformat()
    auftragsnummer = await next_auftragsnummer()
    status = "ZUGEWIESEN" if input.assigned_techniker_id else "ANGENOMMEN"
    branch_id = input.branch_id
    if current["role"] == "mitarbeiter":
        branch_id = current.get("branch_id") or input.branch_id
    warranty_months = input.warranty_months if input.warranty_months is not None else WARRANTY_DEFAULT_MONTHS
    
    doc = {
        "auftragsnummer": auftragsnummer,
        "branch_id": branch_id,
        "device_brand": input.device_brand,
        "device_model": input.device_model,
        "imei": input.imei or "",
        "imei_unreadable": bool(input.imei_unreadable),
        "device_passcode": input.device_passcode or "",
        "device_lock_type": input.device_lock_type or "none",
        "issue_description": input.issue_description,
        "customer_name": input.customer_name,
        "customer_phone": input.customer_phone,
        "customer_email": input.customer_email or "",
        "customer_address": input.customer_address or "",
        "estimated_price": input.estimated_price,
        "diagnosis_fee": input.diagnosis_fee or 0,
        "labor_cost": input.labor_cost or 0,
        "parts_cost": input.parts_cost or 0,
        "diagnosis_payment_status": input.diagnosis_payment_status or "OPEN",
        "cost_status": "WARTET",
        "used_parts": [],
        "warranty_months": warranty_months,
        "warranty_start": None,
        "warranty_until": None,
        "intake_signature": input.intake_signature or None,
        "intake_signed_name": input.intake_signed_name or "",
        "intake_signed_at": now if input.intake_signature else None,
        "pickup_signature": None,
        "pickup_signed_name": "",
        "pickup_signed_at": None,
        "assigned_techniker_id": input.assigned_techniker_id,
        "status": status,
        "reject_reason": "",
        "media": input.media if input.media else [],
        "status_history": [{"status": status, "at": now, "by": current["name"]}],
        "is_reclamation": bool(input.is_reclamation),
        "reclamation_of": input.reclamation_of or None,
        "reclamation_of_number": input.reclamation_of_number or None,
        "created_by": str(current["_id"]),
        "created_by_name": current["name"],
        "created_at": now,
        "updated_at": now,
    }
    
    res = await db.orders.insert_one(doc)
    order = await db.orders.find_one({"_id": res.inserted_id})
    
    if input.is_reclamation:
        await log_audit(str(res.inserted_id), "REKLAMATION",
                        f"Reklamation/Garantiefall zu {input.reclamation_of_number or '—'} angelegt", current["name"])
                        
    await push_notification(
        kind="AUFTRAG", title=("Neue Reklamation angelegt" if input.is_reclamation else "Neuer Auftrag angelegt"),
        message=f"{current['name']} hat {'Reklamation' if input.is_reclamation else 'Auftrag'} {auftragsnummer} angelegt.",
        by=current["name"], by_role=current["role"],
        order_id=str(res.inserted_id), auftragsnummer=auftragsnummer,
    )
    
    if input.assigned_techniker_id:
        await push_notification(
            kind="ASSIGNED", title="🔧 Neuer Auftrag zugewiesen",
            message=f"Ihnen wurde {auftragsnummer} zugewiesen: {input.device_brand} {input.device_model}",
            by=current["name"], by_role=current["role"],
            order_id=str(res.inserted_id), auftragsnummer=auftragsnummer,
            target_user_id=input.assigned_techniker_id, target_role="techniker",
        )
        
    return serialize_order(order, current)

async def _touch_order(order_id, new_status, by_name, extra=None):
    now = datetime.now(timezone.utc).isoformat()
    update = {"$set": {"status": new_status, "updated_at": now},
             "$push": {"status_history": {"status": new_status, "at": now, "by": by_name}}}
    if extra:
        update["$set"].update(extra)
    await db.orders.update_one({"_id": ObjectId(order_id)}, update)
    await log_audit(order_id, "STATUS", f"Status → {new_status}", by_name)

@router.patch("/orders/{order_id}")
async def edit_order(order_id: str, input: OrderEditInput,
                     current=Depends(require_roles("admin", "mitarbeiter"))):
    """Korrigiert Stammdaten eines Auftrags (z. B. Tippfehler im Kundennamen).
    Zulässig nur, solange der Auftrag noch nicht final ist (kein ABGEHOLT/
    ABGELEHNT/STORNIERT), und für Mitarbeiter nur bei selbst angelegten Aufträgen."""
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    if order.get("status") in FINAL_STATES:
        raise HTTPException(status_code=400, detail="Abgeschlossene/stornierte Aufträge können nicht mehr bearbeitet werden")
    if current["role"] == "mitarbeiter" and order.get("created_by") != str(current["_id"]):
        raise HTTPException(status_code=403, detail="Sie können nur selbst angelegte Aufträge bearbeiten")

    updates = {}
    changes_desc = []
    for field in EDITABLE_ORDER_FIELDS:
        v = getattr(input, field)
        if v is not None:
            v = v.strip() if isinstance(v, str) else v
            old_val = order.get(field, "")
            if v != old_val:
                updates[field] = v
                changes_desc.append(field)
    if not updates:
        return serialize_order(order, current)

    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": updates})
    await log_audit(order_id, "BEARBEITET", f"Felder korrigiert: {', '.join(changes_desc)}", current["name"])
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize_order(order, current)


@router.post("/orders/{order_id}/cancel")
async def cancel_order(order_id: str, input: CancelInput,
                       current=Depends(require_roles("admin", "mitarbeiter"))):
    """Storniert einen Auftrag (z. B. weil der Kunde die Reparatur nicht mehr
    wünscht) mit Pflicht-Angabe eines Grundes. Endgültig — keine weitere
    Bearbeitung des Auftrags danach möglich."""
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    if order.get("status") in FINAL_STATES:
        raise HTTPException(status_code=400, detail="Auftrag ist bereits abgeschlossen/storniert")
    if not input.reason.strip():
        raise HTTPException(status_code=400, detail="Stornierungsgrund erforderlich")
    if current["role"] == "mitarbeiter" and order.get("created_by") != str(current["_id"]):
        raise HTTPException(status_code=403, detail="Sie können nur selbst angelegte Aufträge stornieren")

    await _touch_order(order_id, "STORNIERT", current["name"], {"cancel_reason": input.reason.strip()})
    await log_audit(order_id, "STORNIERT", f"Auftrag storniert: {input.reason.strip()}", current["name"])
    await auto_status_communication(order, "STORNIERT", current["name"])
    await push_notification(
        kind="STATUS", title="Auftrag storniert",
        message=f"{current['name']} hat {order.get('auftragsnummer','')} storniert: {input.reason.strip()}",
        by=current["name"], by_role=current["role"],
        order_id=order_id, auftragsnummer=order.get("auftragsnummer"),
    )
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize_order(order, current)


@router.post("/orders/{order_id}/assign")
async def assign_order(order_id: str, input: AssignInput,
                       current=Depends(require_roles("admin", "mitarbeiter"))):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    tech = await db.users.find_one({"_id": ObjectId(input.techniker_id), "role": "techniker"})
    if not tech:
        raise HTTPException(status_code=404, detail="Techniker nicht gefunden")
    was_rejected = order.get("status") == "ABGELEHNT"
    # Clear any previous rejection reason so a reassigned order starts clean.
    await _touch_order(order_id, "ZUGEWIESEN", current["name"],
                       {"assigned_techniker_id": input.techniker_id, "reject_reason": ""})
    if was_rejected:
        await log_audit(order_id, "ZUWEISUNG",
                        f"Nach Ablehnung neu zugewiesen an {tech['name']}", current["name"])
    action_word = "neu zugewiesen" if was_rejected else "zugewiesen"
    await push_notification(
        kind="STATUS", title=("Auftrag neu zugewiesen" if was_rejected else "Auftrag zugewiesen"),
        message=f"{current['name']} hat {order.get('auftragsnummer','')} an {tech['name']} {action_word}.",
        by=current["name"], by_role=current["role"],
        order_id=order_id, auftragsnummer=order.get("auftragsnummer"),
    )
    # Targeted real-time alert to the assigned technician
    await push_notification(
        kind="ASSIGNED", title="🔧 Neuer Auftrag zugewiesen",
        message=f"Ihnen wurde {order.get('auftragsnummer','')} zugewiesen: {order.get('device_brand','')} {order.get('device_model','')}",
        by=current["name"], by_role=current["role"],
        order_id=order_id, auftragsnummer=order.get("auftragsnummer"),
        target_user_id=input.techniker_id, target_role="techniker",
    )
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize_order(order, current)


@router.post("/orders/{order_id}/accept")
async def accept_order(order_id: str, current=Depends(require_roles("techniker"))):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order or order.get("assigned_techniker_id") != str(current["_id"]):
        raise HTTPException(status_code=403, detail="Nicht zugewiesen")
    await _touch_order(order_id, "AKZEPTIERT", current["name"])
    await push_notification(
        kind="STATUS", title="Auftrag akzeptiert",
        message=f"Techniker {current['name']} hat {order.get('auftragsnummer','')} akzeptiert.",
        by=current["name"], by_role=current["role"],
        order_id=order_id, auftragsnummer=order.get("auftragsnummer"),
    )
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize_order(order, current)


@router.post("/orders/{order_id}/reject")
async def reject_order(order_id: str, input: RejectInput,
                       current=Depends(require_roles("techniker"))):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order or order.get("assigned_techniker_id") != str(current["_id"]):
        raise HTTPException(status_code=403, detail="Nicht zugewiesen")
    if not input.reason.strip():
        raise HTTPException(status_code=400, detail="Ablehnungsgrund erforderlich")
    await _touch_order(order_id, "ABGELEHNT", current["name"],
                       {"reject_reason": input.reason})
    await auto_status_communication(order, "ABGELEHNT", current["name"])
    await push_notification(
        kind="STATUS", title="Auftrag abgelehnt",
        message=f"Techniker {current['name']} hat {order.get('auftragsnummer','')} abgelehnt: {input.reason}",
        by=current["name"], by_role=current["role"],
        order_id=order_id, auftragsnummer=order.get("auftragsnummer"),
    )
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize_order(order, current)


@router.patch("/orders/{order_id}/status")
async def update_status(order_id: str, input: StatusUpdate, current=Depends(get_current_user)):
    if input.status not in STATUS_FLOW:
        raise HTTPException(status_code=400, detail="Ungültiger Status")
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    role = current["role"]
    if role == "techniker":
        if order.get("assigned_techniker_id") != str(current["_id"]):
            raise HTTPException(status_code=403, detail="Nicht zugewiesen")
        if input.status not in TECH_ALLOWED_STATUS:
            raise HTTPException(status_code=403, detail="Techniker dürfen diesen Status nicht setzen")
    elif role == "mitarbeiter":
        if input.status not in ("ANGENOMMEN", "WARTEN_FREIGABE", "IN_BEARBEITUNG", "WARTEN_ERSATZTEIL", "FERTIG", "ABGEHOLT"):
            raise HTTPException(status_code=403, detail="Mitarbeiter dürfen diesen Status nicht setzen")
    if input.status == "FERTIG":
        has_repair_media = any(isinstance(m, dict) and m.get("media_type") == "repair" for m in order.get("media", []))
        if not has_repair_media:
            raise HTTPException(status_code=400,
                                detail="Bitte zuerst Reparatur-Fotos/Videos aufnehmen, bevor der Auftrag als 'Fertig' markiert wird.")
        if not order.get("inspection"):
            raise HTTPException(status_code=400,
                                detail="Bitte zuerst das Abschluss-Prüfprotokoll (Endkontrolle) ausfüllen, bevor der Auftrag als 'Fertig' markiert wird.")
    extra = {"reject_reason": input.reason} if input.reason else None
    # Start warranty period when the device is handed back (delivered)
    if input.status == "ABGEHOLT":
        months = int(order.get("warranty_months") or WARRANTY_DEFAULT_MONTHS)
        start = datetime.now(timezone.utc)
        until = start + timedelta(days=30 * months)
        extra = {**(extra or {}),
                 "warranty_start": start.isoformat(),
                 "warranty_until": until.isoformat()}
    await _touch_order(order_id, input.status, current["name"], extra)
    # Automated customer status notification (WhatsApp-style log)
    await auto_status_communication(order, input.status, current["name"])
    fertig = input.status == "FERTIG"
    await push_notification(
        kind=("FERTIG" if fertig else "STATUS"),
        title=("✓ Reparatur fertig – abholbereit" if fertig else "Status geändert"),
        message=(f"{current['name']}: {order.get('auftragsnummer','')} ist FERTIG – bereit zur Abholung."
                 if fertig else f"{current['name']}: {order.get('auftragsnummer','')} → {input.status}"),
        by=current["name"], by_role=current["role"],
        order_id=order_id, auftragsnummer=order.get("auftragsnummer"),
    )
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize_order(order, current)

@router.delete("/orders/{order_id}/media/{media_id}")
async def delete_order_media(order_id: str, media_id: str, current=Depends(get_current_user)):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    
    media_list = order.get("media", [])
    import urllib.parse
    decoded_id = urllib.parse.unquote(media_id)

    target_media = None
    target_index = -1

    # 1. البحث بالطريقة الذكية مع دعم الأشكال المختلفة (نصوص أو كائنات)
    for i, m in enumerate(media_list):
        if isinstance(m, str):
            m_id = m
            m_oid = m
            m_file = m
            m_storage = m
            m_filename = m
        else:
            m_id = str(m.get("id", ""))
            m_oid = str(m.get("_id", ""))
            m_file = str(m.get("file_path", ""))
            m_storage = str(m.get("storage_path", ""))
            m_filename = str(m.get("filename", ""))
        
        if (decoded_id == m_id or 
            decoded_id == m_oid or 
            decoded_id == m_filename or 
            decoded_id in m_file or 
            decoded_id in m_storage or
            m_file.endswith(decoded_id) or
            m_storage.endswith(decoded_id)):
            target_media = m
            target_index = i
            break

    # 2. إذا لم يتم العثور عليها، نتحقق إن كان الـ media_id عبارة عن رقم ترتيبي (Index)
    if target_index == -1 and decoded_id.isdigit():
        idx = int(decoded_id)
        if 0 <= idx < len(media_list):
            target_index = idx
            target_media = media_list[idx]

    if not target_media or target_index == -1:
        raise HTTPException(status_code=404, detail="Media not found")

    # 3. حذف الملف الفعلي من السيرفر بأمان تام (سواء كان الكائن دكشنري أو نص)
    file_path = None
    if isinstance(target_media, dict):
        file_path = target_media.get("file_path") or target_media.get("storage_path")
    elif isinstance(target_media, str):
        file_path = target_media

    if file_path:
        full_path = os.path.join("/app", file_path) if not file_path.startswith("/") else file_path
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except Exception:
                pass

    # 4. إزالة العنصر من القائمة وتحديث قاعدة البيانات بدقة
    media_list.pop(target_index)
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"media": media_list}}
    )
    
    updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
    bmap, umap = await _name_maps()
    return serialize_order(updated_order, current)

# ==================== COSTS ====================
@router.patch("/orders/{order_id}/costs")
async def update_costs(order_id: str, input: CostUpdate,
                       current=Depends(require_roles("admin", "mitarbeiter"))):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    
    updates = {}
    
    # 1. تحديث حقول التكاليف الأساسية
    existing_cost = order.get("cost", {})
    diagnosis_fee = float(getattr(input, "diagnosis_fee", None) if getattr(input, "diagnosis_fee", None) is not None else existing_cost.get("diagnosis_fee", 0))
    labor_cost = float(getattr(input, "labor_cost", None) if getattr(input, "labor_cost", None) is not None else existing_cost.get("labor_cost", 0))
    parts_cost = float(getattr(input, "parts_cost", None) if getattr(input, "parts_cost", None) is not None else existing_cost.get("parts_cost", 0))
    
    for k in ("diagnosis_fee", "labor_cost", "parts_cost"):
        v = getattr(input, k)
        if v is not None:
            updates[f"cost.{k}"] = float(v)

    # 2. معالجة وتخزين المبلغ المدفوع والمتبقي
    paid_input = getattr(input, "paid_amount", None)
    if paid_input is not None:
        paid_amount = float(paid_input)
        updates["cost.paid_amount"] = paid_amount
    else:
        paid_amount = float(existing_cost.get("paid_amount", 0))

    # 3. حسابات المالية التلقائية (Netto, MwSt, Brutto, Restbetrag)
    net = diagnosis_fee + labor_cost + parts_cost
    tax = net * 0.19
    gross = net + tax
    remaining_amount = max(0.0, gross - paid_amount)

    updates["cost.net"] = round(net, 2)
    updates["cost.tax"] = round(tax, 2)
    updates["cost.gross"] = round(gross, 2)
    updates["cost.remaining_amount"] = round(remaining_amount, 2)

    # 4. التحقق من الحالات الأخرى (Status)
    if input.cost_status is not None:
        if input.cost_status not in COST_STATES:
            raise HTTPException(status_code=400, detail="Ungültiger Kostenstatus")
        updates["cost.cost_status"] = input.cost_status
        
    if input.diagnosis_payment_status is not None:
        if input.diagnosis_payment_status not in ("PAID", "OPEN", "NA"):
            raise HTTPException(status_code=400, detail="Ungültiger Zahlungsstatus")
        updates["cost.diagnosis_payment_status"] = input.diagnosis_payment_status

    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": updates})
        
        if "cost.cost_status" in updates:
            await log_audit(order_id, "KOSTEN", f"Kostenstatus → {updates['cost.cost_status']}", current["name"])
        else:
            await log_audit(order_id, "KOSTEN", "Kosten aktualisiert", current["name"])
            
        await push_notification(
            kind="KOSTEN", title="Kosten aktualisiert",
            message=f"{current['name']} hat Kosten für {order.get('auftragsnummer','')} aktualisiert.",
            by=current["name"], by_role=current["role"],
            order_id=order_id, auftragsnummer=order.get("auftragsnummer"),
        )
        
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize_order(order, current)


# ==================== USED PARTS ====================
async def _assert_order_access(order, current):
    if current["role"] == "techniker" and order.get("assigned_techniker_id") != str(current["_id"]):
        raise HTTPException(status_code=403, detail="Nicht zugewiesen")


@router.post("/orders/{order_id}/parts")
async def add_used_part(order_id: str, input: UsedPartInput, current=Depends(get_current_user)):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    await _assert_order_access(order, current)
    if input.quantity < 1:
        raise HTTPException(status_code=400, detail="Menge muss mindestens 1 sein")
    item = await db.inventory.find_one({"_id": ObjectId(input.inventory_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Ersatzteil nicht gefunden")
    if item["quantity"] < input.quantity:
        raise HTTPException(status_code=400, detail=f"Nicht genügend Bestand ({item['quantity']} verfügbar)")
    total = round(item["price"] * input.quantity, 2)
    part = {
        "id": str(uuid.uuid4()),
        "inventory_id": str(item["_id"]),
        "sku": item["sku"],
        "name": f"{item['brand']} {item['device_model']} · {item['part_type']}",
        "quantity": input.quantity,
        "unit_price": item["price"],
        "total": total,
        "added_by": current["name"],
        "added_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.inventory.update_one({"_id": item["_id"]}, {"$inc": {"quantity": -input.quantity}})
    new_parts_cost = round(float(order.get("parts_cost") or 0) + total, 2)
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$push": {"used_parts": part},
         "$set": {"parts_cost": new_parts_cost, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    await log_audit(order_id, "ERSATZTEIL", f"Verbaut: {input.quantity}× {part['sku']} (Lagerabzug)", current["name"])
    await push_notification(
        kind="ERSATZTEIL", title="Ersatzteil verbaut",
        message=f"{current['name']} hat {input.quantity}× {part['sku']} für {order.get('auftragsnummer','')} verbaut.",
        by=current["name"], by_role=current["role"],
        order_id=order_id, auftragsnummer=order.get("auftragsnummer"),
    )
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize_order(order, current)


@router.delete("/orders/{order_id}/parts/{part_id}")
async def remove_used_part(order_id: str, part_id: str, current=Depends(get_current_user)):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    await _assert_order_access(order, current)
    part = next((p for p in order.get("used_parts", []) if p["id"] == part_id), None)
    if not part:
        raise HTTPException(status_code=404, detail="Verbautes Teil nicht gefunden")
    try:
        await db.inventory.update_one({"_id": ObjectId(part["inventory_id"])},
                                      {"$inc": {"quantity": part["quantity"]}})
    except Exception:
        pass
    new_parts_cost = round(max(0.0, float(order.get("parts_cost") or 0) - float(part["total"])), 2)
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$pull": {"used_parts": {"id": part_id}},
         "$set": {"parts_cost": new_parts_cost, "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    await log_audit(order_id, "ERSATZTEIL", f"Entfernt: {part['sku']} (Bestand zurückgebucht)", current["name"])
    await push_notification(
        kind="ERSATZTEIL", title="Ersatzteil entfernt",
        message=f"{current['name']} hat {part['sku']} von {order.get('auftragsnummer','')} entfernt.",
        by=current["name"], by_role=current["role"],
        order_id=order_id, auftragsnummer=order.get("auftragsnummer"),
    )
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize_order(order, current)


# ==================== AUDIT LOG ====================
@router.get("/orders/{order_id}/audit")
async def get_audit(order_id: str, current=Depends(require_roles("admin", "mitarbeiter"))):
    entries = await db.audit_log.find({"order_id": order_id}).sort("at", -1).to_list(500)
    return [{"id": str(e["_id"]), "action": e["action"], "detail": e["detail"],
             "by": e["by"], "at": e["at"]} for e in entries]


# ==================== WHATSAPP ====================
class WhatsAppLog(BaseModel):
    message: str


@router.post("/orders/{order_id}/whatsapp")
async def log_whatsapp(order_id: str, input: WhatsAppLog,
                       current=Depends(require_roles("admin", "mitarbeiter"))):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    phone = order.get("customer_phone", "")
    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "order_id": order_id, "channel": "whatsapp", "to": phone,
        "message": input.message, "by": current["name"], "at": now,
    }
    res = await db.communications.insert_one(entry)
    await log_audit(order_id, "WHATSAPP", "WhatsApp-Nachricht an Kunden gesendet", current["name"])
    await push_notification(
        kind="WHATSAPP", title="WhatsApp-Nachricht gesendet",
        message=f"{current['name']} hat eine WhatsApp-Nachricht zu {order.get('auftragsnummer','')} gesendet.",
        by=current["name"], by_role=current["role"],
        order_id=order_id, auftragsnummer=order.get("auftragsnummer"),
    )
    digits = "".join(c for c in phone if c.isdigit())
    if digits.startswith("0"):
        digits = "49" + digits[1:]
    return {"id": str(res.inserted_id), "to": phone, "wa_number": digits,
            "message": input.message, "by": current["name"], "at": now}


@router.get("/orders/{order_id}/communications")
async def get_communications(order_id: str, current=Depends(require_roles("admin", "mitarbeiter"))):
    items = await db.communications.find({"order_id": order_id}).sort("at", -1).to_list(500)
    return [{"id": str(i["_id"]), "channel": i["channel"], "to": i.get("to", ""),
             "message": i["message"], "by": i["by"], "at": i["at"],
             "status": i.get("status", "")} for i in items]


# ============ CUSTOMER COMMUNICATION: SMS / WhatsApp / Email (real + fallback) ============
class NotifyInput(BaseModel):
    channel: str  # "sms" | "whatsapp" | "email"
    message: str
    subject: Optional[str] = None


@router.get("/communication/status")
async def communication_status(current=Depends(require_roles("admin", "mitarbeiter"))):
    """Which channels have credentials configured (drives the UI 'not configured' hints)."""
    return messaging.channel_status()


@router.post("/orders/{order_id}/notify")
async def notify_customer(order_id: str, input: NotifyInput,
                          current=Depends(require_roles("admin", "mitarbeiter"))):
    if input.channel not in ("sms", "whatsapp", "email"):
        raise HTTPException(status_code=400, detail="Ungültiger Kanal")
    text = (input.message or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Nachricht darf nicht leer sein")
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    if current["role"] == "mitarbeiter" and order.get("branch_id") != current.get("branch_id"):
        raise HTTPException(status_code=403, detail="Anderer Filiale zugeordnet")

    phone = order.get("customer_phone", "")
    email = order.get("customer_email", "")
    auftrag = order.get("auftragsnummer", "")

    branch_phone = ""
    branch_email = ""
    branch_id = order.get("branch_id")
    if branch_id:
        branch = await db.branches.find_one({"_id": ObjectId(branch_id)})
        if branch:
            branch_phone = branch.get("phone") or ""
            branch_email = branch.get("email") or ""

    if input.channel == "email":
        if not email:
            raise HTTPException(status_code=400, detail="Keine E-Mail-Adresse für diesen Kunden hinterlegt")
        subject = (input.subject or f"Ihr Reparaturauftrag {auftrag}").strip()
        html = f"<div style='font-family:Arial,sans-serif;font-size:14px;color:#111'>" \
               f"<p>Sehr geehrte/r Kunde/in,</p><p>{text}</p>" \
               f"<p style='color:#666;font-size:12px'>Auftrag: {auftrag}</p></div>"
        identity = messaging.resolve_send_identity(branch_email)
        result = await messaging.send_email(email, subject, html,
                                            from_email=identity["from_email"],
                                            reply_to=identity["reply_to"])
        to_val = email
    else:
        if not phone:
            raise HTTPException(status_code=400, detail="Keine Telefonnummer für diesen Kunden hinterlegt")
        body = f"[Auftrag {auftrag}] {text}"
        result = await (messaging.send_sms(phone, body) if input.channel == "sms"
                        else messaging.send_whatsapp(phone, body))
        to_val = result.get("to", phone)
        result["branch_phone"] = branch_phone

    status = result.get("status", "unknown")
    now = datetime.now(timezone.utc).isoformat()
    entry = {
        "order_id": order_id, "channel": input.channel, "to": to_val,
        "message": text, "by": current["name"], "at": now, "status": status,
    }
    res = await db.communications.insert_one(entry)
    entry.pop("_id", None)
    await log_audit(order_id, "KOMMUNIKATION",
                    f"{input.channel.upper()} an Kunden ({status})", current["name"])
    await push_notification(
        kind="KOMMUNIKATION", title=f"{input.channel.upper()} an Kunden",
        message=f"{current['name']} hat eine {input.channel.upper()}-Nachricht zu {auftrag} ausgelöst ({status}).",
        by=current["name"], by_role=current["role"],
        order_id=order_id, auftragsnummer=auftrag,
    )
    return {"id": str(res.inserted_id), **entry, "result": result}


# ==================== ANALYTICS ====================
def _hours_between(status_history, from_status, to_status):
    frm = next((h["at"] for h in status_history if h["status"] == from_status), None)
    to = next((h["at"] for h in reversed(status_history) if h["status"] == to_status), None)
    if not frm or not to:
        return None
    try:
        a = datetime.fromisoformat(frm)
        b = datetime.fromisoformat(to)
        return max(0.0, (b - a).total_seconds() / 3600.0)
    except Exception:
        return None


@router.get("/analytics")
async def analytics(
    branch_id: Optional[str] = None,
    current=Depends(require_roles("admin"))
):
    print(">>> ENTERED /analytics ENDPOINT <<<")
    try:
        query = await _order_query_for_user(current)
        if branch_id:
            try:
                query["$or"] = [
                    {"branch_id": branch_id},
                    {"branch_id": ObjectId(branch_id)}
                ]
            except Exception:
                query["branch_id"] = branch_id

        # 1. جلب المستخدمين مرة واحدة (عدددهم صغير عادة ولا يسبب ضغطاً)
        users = await db.users.find().to_list(500)
        mitarbeiter = {str(u["_id"]): {"id": str(u["_id"]), "name": u["name"], "role": u["role"],
                                     "created": 0, "delivered": 0, "revenue": 0.0}
                       for u in users if u["role"] in ("mitarbeiter", "admin")}
        techniker = {str(u["_id"]): {"id": str(u["_id"]), "name": u["name"],
                                    "assigned": 0, "resolved": 0, "revenue": 0.0,
                                    "_times": []}
                     for u in users if u["role"] == "techniker"}

        # 2. استخدام Projection جبار وسريع لجلب الحقول اللازمة فقط ودون جلب كل تفاصيل الـ 5000 طلب الثقيلة
        orders = await db.orders.find(
            query,
            {
                "created_by": 1, "assigned_techniker_id": 1, "status": 1,
                "total_price": 1, "estimated_price": 1, "labor_cost": 1, 
                "parts_cost": 1, "diagnosis_fee": 1, "cost_status": 1,
                "status_history": 1, "branch_id": 1, "created_at": 1
            }
        ).sort("created_at", -1).limit(2000).to_list(length=2000)

        for o in orders:
            gross = compute_costs(o)["gross"]
            cb = o.get("created_by")
            if cb in mitarbeiter:
                mitarbeiter[cb]["created"] += 1
                if o.get("status") == "ABGEHOLT":
                    mitarbeiter[cb]["delivered"] += 1
                    mitarbeiter[cb]["revenue"] = round(mitarbeiter[cb]["revenue"] + gross, 2)
                    
            tid = o.get("assigned_techniker_id")
            if tid in techniker:
                techniker[tid]["assigned"] += 1
                status = o.get("status")
                if status in ("FERTIG", "ABGEHOLT"):
                    techniker[tid]["resolved"] += 1
                    if status == "ABGEHOLT":
                        techniker[tid]["revenue"] = round(techniker[tid]["revenue"] + gross, 2)
                    hrs = _hours_between(o.get("status_history", []), "AKZEPTIERT", "FERTIG")
                    if hrs is None:
                        hrs = _hours_between(o.get("status_history", []), "ZUGEWIESEN", "FERTIG")
                    if hrs is not None:
                        techniker[tid]["_times"].append(hrs)

        tech_list = []
        for t in techniker.values():
            times = t.pop("_times")
            t["avg_hours"] = round(sum(times) / len(times), 1) if times else None
            tech_list.append(t)

        return {
            "mitarbeiter": sorted(mitarbeiter.values(), key=lambda x: -x["revenue"]),
            "techniker": sorted(tech_list, key=lambda x: -x["resolved"]),
        }
    except Exception as e:
        print(f"Error in analytics: {e}")
        return {"mitarbeiter": [], "techniker": []}

# ==================== MEDIA ====================
@router.post("/orders/{order_id}/media")
async def upload_media(
    order_id: str, 
    media_type: str = Form("intake"),
    file: UploadFile = File(...), 
    current=Depends(get_current_user)
):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    if current["role"] == "techniker" and order.get("assigned_techniker_id") != str(current["_id"]):
        raise HTTPException(status_code=403, detail="Nicht zugewiesen")
    
    ext = file.filename.split(".")[-1].lower() if file.filename and "." in file.filename else "bin"
    path = f"{APP_NAME}/orders/{order_id}/{uuid.uuid4()}.{ext}"
    
    # قراءة الملف على دفعات لتجنب امتلاء الذاكرة وتجاوز قيود الـ Payload
    CHUNK_SIZE = 1024 * 1024  # 1MB لكل دفعة
    data_chunks = []
    while True:
        chunk = await file.read(CHUNK_SIZE)
        if not chunk:
            break
        data_chunks.append(chunk)
    data = b"".join(data_chunks)
    
    ct = file.content_type or "application/octet-stream"
    result = put_object(path, data, ct)
    
    media_item = {
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "original_filename": file.filename or "recording.webm",
        "content_type": ct,
        "media_type": media_type,
        "is_video": ct.startswith("video"),
        "uploaded_by": current["name"],
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.files.insert_one({**media_item, "order_id": order_id, "is_deleted": False})
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {
            "$push": {"media": media_item},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    
    await push_notification(
        kind="MEDIEN", 
        title="Neue Medien hochgeladen",
        message=f"{current['name']} hat {media_type}-Medien zu {order.get('auftragsnummer','')} hinzugefügt.",
        by=current["name"], 
        by_role=current["role"],
        order_id=order_id, 
        auftragsnummer=order.get("auftragsnummer"),
    )
    
    return media_item


# ==================== CHAT ====================
@router.get("/orders/{order_id}/messages")
async def get_messages(order_id: str, current=Depends(get_current_user)):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    if current["role"] == "techniker" and order.get("assigned_techniker_id") != str(current["_id"]):
        raise HTTPException(status_code=403, detail="Nicht zugewiesen")
    msgs = await db.chat_messages.find({"order_id": order_id}).sort("created_at", 1).to_list(1000)
    return [{"id": str(m["_id"]), "sender_id": m["sender_id"], "sender_name": m["sender_name"],
             "sender_role": m["sender_role"], "message": m["message"],
             "created_at": m["created_at"]} for m in msgs]


class ChatMessageInput(BaseModel):
    message: str


@router.post("/orders/{order_id}/messages")
async def post_message(order_id: str, input: ChatMessageInput, current=Depends(get_current_user)):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    if current["role"] == "techniker" and order.get("assigned_techniker_id") != str(current["_id"]):
        raise HTTPException(status_code=403, detail="Nicht zugewiesen")
    if current["role"] == "mitarbeiter" and order.get("branch_id") != current.get("branch_id"):
        raise HTTPException(status_code=403, detail="Anderer Filiale zugeordnet")
    text = (input.message or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Nachricht darf nicht leer sein")
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "order_id": order_id,
        "sender_id": str(current["_id"]),
        "sender_name": current["name"],
        "sender_role": current["role"],
        "message": text,
        "created_at": now,
    }
    res = await db.chat_messages.insert_one(doc)
    await push_notification(
        kind="CHAT", title="Neue Chat-Nachricht",
        message=f"{current['name']} ({current['role']}) im Auftrag {order.get('auftragsnummer','')}: {text[:80]}",
        by=current["name"], by_role=current["role"],
        order_id=order_id, auftragsnummer=order.get("auftragsnummer"),
    )
    return {"id": str(res.inserted_id), "sender_id": doc["sender_id"], "sender_name": doc["sender_name"],
            "sender_role": doc["sender_role"], "message": doc["message"], "created_at": doc["created_at"]}


# ==================== STATS ====================
@router.get("/stats")
async def stats(current=Depends(get_current_user)):
    query = await _order_query_for_user(current)
    
    # جلب الحقول الأساسية فقط لتخفيف حجم البيانات المنقولة في الذاكرة
    orders = await db.orders.find(
        query, 
        {"status": 1, "branch_id": 1, "created_at": 1, "diagnosis_fee": 1, "labor_cost": 1, "parts_cost": 1}
    ).to_list(1000)
    
    by_status = {}
    sla_count = 0
    active_orders = 0
    completed_repairs = 0
    total_revenue = 0.0
    
    for o in orders:
        status = o.get("status", "UNKNOWN")
        by_status[status] = by_status.get(status, 0) + 1
        
        if is_sla_breached(o):
            sla_count += 1
            
        if status not in FINAL_STATES:
            active_orders += 1
            
        if status == "ABGEHOLT":
            completed_repairs += 1
            # حساب الإيرادات بشكل سريع وآمن
            costs = compute_costs(o)
            total_revenue += costs.get("gross", 0.0)

    result = {
        "total_orders": len(orders),
        "by_status": by_status,
        "sla_breached": sla_count,
        "active_orders": active_orders,
    }
    
    if current["role"] == "admin":
        result["total_users"] = await db.users.count_documents({})
        result["total_branches"] = await db.branches.count_documents({})
        
        # جلب العناصر التي تقل عن الحد الأدنى بطريقة سريعة
        low_stock = await db.inventory.find(
            {"$expr": {"$lte": ["$quantity", "$min_stock"]}}
        ).to_list(500)
        
        result["low_stock_count"] = len(low_stock)
        result["low_stock_items"] = [
            {
                "sku": i.get("sku"), 
                "device_model": i.get("device_model"), 
                "part_type": i.get("part_type"),
                "quantity": i.get("quantity"), 
                "min_stock": i.get("min_stock")
            } for i in low_stock
        ]
        
        result["completed_repairs"] = completed_repairs
        result["revenue"] = round(total_revenue, 2)
        
        # تجميع إحصائيات الفروع بطريقة محسنة
        branches = await db.branches.find({}, {"name": 1}).to_list(100)
        bmap = {str(b["_id"]): b["name"] for b in branches}
        
        by_branch = {name: {"branch": name, "revenue": 0.0, "orders": 0, "completed": 0} for name in bmap.values()}
        
        for o in orders:
            name = bmap.get(o.get("branch_id"))
            if not name or name not in by_branch:
                continue
            by_branch[name]["orders"] += 1
            if o.get("status") == "ABGEHOLT":
                by_branch[name]["completed"] += 1
                costs = compute_costs(o)
                by_branch[name]["revenue"] = round(by_branch[name]["revenue"] + costs.get("gross", 0.0), 2)
                
        result["by_branch"] = list(by_branch.values())
        
    return result

# ==================== IMEI (late fill-in) ====================
@router.patch("/orders/{order_id}/imei")
async def update_imei(order_id: str, input: ImeiUpdate, current=Depends(get_current_user)):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    if current["role"] == "techniker" and order.get("assigned_techniker_id") != str(current["_id"]):
        raise HTTPException(status_code=403, detail="Nicht zugewiesen")
    if current["role"] == "mitarbeiter" and order.get("branch_id") != current.get("branch_id"):
        raise HTTPException(status_code=403, detail="Anderer Filiale zugeordnet")
    imei = (input.imei or "").strip()
    if not imei:
        raise HTTPException(status_code=400, detail="IMEI darf nicht leer sein")
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {"imei": imei, "imei_unreadable": False,
                  "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    await log_audit(order_id, "IMEI", f"IMEI nachgetragen: {imei}", current["name"])
    await push_notification(
        kind="IMEI", title="IMEI nachgetragen",
        message=f"{current['name']} hat die IMEI für {order.get('auftragsnummer','')} nachgetragen.",
        by=current["name"], by_role=current["role"],
        order_id=order_id, auftragsnummer=order.get("auftragsnummer"),
    )
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize_order(order, current)


# ==================== DIGITAL SIGNATURES ====================
@router.post("/orders/{order_id}/signature")
async def add_signature(order_id: str, input: SignatureInput,
                        current=Depends(require_roles("admin", "mitarbeiter"))):
    if input.type not in ("intake", "pickup"):
        raise HTTPException(status_code=400, detail="Ungültiger Signaturtyp")
    if not input.signature or not input.signature.startswith("data:image"):
        raise HTTPException(status_code=400, detail="Ungültige Signatur")
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    now = datetime.now(timezone.utc).isoformat()
    prefix = input.type
    updates = {
        f"{prefix}_signature": input.signature,
        f"{prefix}_signed_name": input.signer_name or "",
        f"{prefix}_signed_at": now,
        "updated_at": now,
    }
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": updates})
    label = "Abgabe (Abholschein)" if input.type == "intake" else "Abholung/Übergabe"
    await log_audit(order_id, "UNTERSCHRIFT", f"Digitale Unterschrift erfasst: {label}", current["name"])
    await push_notification(
        kind="UNTERSCHRIFT", title="Unterschrift erfasst",
        message=f"{current['name']} hat eine Unterschrift ({label}) für {order.get('auftragsnummer','')} erfasst.",
        by=current["name"], by_role=current["role"],
        order_id=order_id, auftragsnummer=order.get("auftragsnummer"),
    )
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize_order(order, current)


# ==================== GLOBAL SEARCH ====================
@router.get("/search")
async def global_search(q: str = Query(..., min_length=1), current=Depends(get_current_user)):
    term = q.strip()
    if not term:
        return []
    import re
    safe = re.escape(term)
    rx = {"$regex": safe, "$options": "i"}
    base = await _order_query_for_user(current)
    or_clauses = [
        {"auftragsnummer": rx},
        {"imei": rx},
        {"customer_phone": rx},
    ]
    # Only non-technicians can search by customer name (PII)
    if current["role"] != "techniker":
        or_clauses.append({"customer_name": rx})
    query = {"$and": [base, {"$or": or_clauses}]} if base else {"$or": or_clauses}
    orders = await db.orders.find(query).sort("created_at", -1).to_list(50)
    bmap, umap = await _name_maps()
    return [attach_names(serialize_order(o, current, light=True), bmap, umap) for o in orders]


# ==================== NOTIFICATIONS (Admin + Reception + targeted Technicians) ====================
async def _notif_query(user: dict, branch_id_param: str = None):
    """Build the Mongo filter for the notifications a user may see."""
    role = user["role"]
    
    if role == "techniker":
        return {"target_user_id": str(user["_id"])}

    from bson import ObjectId
    target_branch = branch_id_param or user.get("branch_id")

    # إذا تم تحديد فرع معين
    if target_branch:
        query_branch_ids = [target_branch]
        try:
            query_branch_ids.append(ObjectId(target_branch))
        except:
            pass
            
        # جلب طلبات هذا الفرع
        orders = await db.orders.find({"branch_id": {"$in": query_branch_ids}}, {"_id": 1}).to_list(10000)
        
        # جمع الـ IDs بصيغتي النص (String) و (ObjectId) لضمان المطابقة التامة مع الإشعارات
        ids = [o["_id"] for o in orders]
        str_ids = [str(o["_id"]) for o in orders]
        all_order_ids = list(set(ids + str_ids))
        
        if not all_order_ids:
            # إذا لم تكن هناك طلبات في هذا الفرع، نعرض إشعاراً وهمياً لا يعيد شيئاً لتجنب الأخطاء
            return {"target_user_id": None, "order_id": {"$in": []}}

        return {
            "target_user_id": None,
            "order_id": {"$in": all_order_ids}
        }

    # إذا لم يتم تحديد فرع (في الصفحة الرئيسية / Dashboard) -> نعرض كل الإشعارات العامة أو التي لها order_id
    return {
        "target_user_id": None
    }

@router.get("/notifications")
async def list_notifications(limit: int = 50, branch_id: str = None, current=Depends(require_roles("admin", "mitarbeiter", "techniker"))):
    q = await _notif_query(current, branch_id)
    # جلب العدد المطلوب فقط لتخفيف الحمل
    items = await db.notifications.find(q).sort("at", -1).limit(limit).to_list(limit)
    unread = await db.notifications.count_documents({**q, "read": False})
    return {
        "unread": unread,
        "items": [{
            "id": str(n["_id"]),
            "kind": n.get("kind"),
            "title": n.get("title"),
            "message": n.get("message"),
            "by": n.get("by"),
            "by_role": n.get("by_role"),
            "order_id": n.get("order_id"),
            "auftragsnummer": n.get("auftragsnummer"),
            "read": n.get("read", False),
            "at": n.get("at"),
        } for n in items],
    }


@router.post("/notifications/read")
async def mark_notifications_read(branch_id: str = None, current=Depends(require_roles("admin", "mitarbeiter", "techniker"))):
    q = await _notif_query(current, branch_id)
    await db.notifications.update_many({**q, "read": False}, {"$set": {"read": True}})
    return {"message": "Alle Benachrichtigungen als gelesen markiert"}


@router.delete("/notifications")
async def clear_notifications(branch_id: str = None, current=Depends(require_roles("admin", "mitarbeiter", "techniker"))):
    q = await _notif_query(current, branch_id)
    await db.notifications.delete_many(q)
    return {"message": "Benachrichtigungen gelöscht"}

# ==================== INVOICE (Rechnung, GoBD per-branch) ====================
@router.post("/orders/{order_id}/invoice")
async def issue_invoice(order_id: str, current=Depends(require_roles("admin", "mitarbeiter"))):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    if current["role"] == "mitarbeiter" and order.get("branch_id") != current.get("branch_id"):
        raise HTTPException(status_code=403, detail="Anderer Filiale zugeordnet")
    if order.get("status") != "ABGEHOLT":
        raise HTTPException(status_code=400, detail="Rechnung erst nach Abholung (Status 'Abgeholt') möglich")
    # Idempotent: return existing invoice number if already issued (GoBD: no re-numbering)
    if not order.get("invoice_number"):
        inv_no = await next_invoice_number(order.get("branch_id"))
        now = datetime.now(timezone.utc).isoformat()
        await db.orders.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": {"invoice_number": inv_no, "invoice_date": now, "updated_at": now}},
        )
        await log_audit(order_id, "RECHNUNG", f"Rechnung erstellt: {inv_no}", current["name"])
        await push_notification(
            kind="RECHNUNG", title="Rechnung erstellt",
            message=f"{current['name']} hat Rechnung {inv_no} für {order.get('auftragsnummer','')} erstellt.",
            by=current["name"], by_role=current["role"],
            order_id=order_id, auftragsnummer=order.get("auftragsnummer"),
        )
        order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize_order(order, current)



# ==================== DUAL INSPECTION SYSTEM (Intake & QC) ====================
@router.post("/orders/{order_id}/inspection")
async def save_inspection(order_id: str, input: InspectionInput, current=Depends(get_current_user)):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    
    await _assert_order_access(order, current)
    now = datetime.now(timezone.utc).isoformat()
    
    update_field = "intake_inspection" if input.inspection_type == "intake" else "inspection"
    
    # التحقق هل الفحص موجود مسبقاً لنحافظ على اسم الموظف الأصلي
    existing_inspection = order.get(update_field, {})
    original_creator = existing_inspection.get("by", current["name"])
    original_time = existing_inspection.get("at", now)

    inspection_data = {
        "checklist": input.checklist or {},
        "display_type": input.display_type or "",
        "battery_health": input.battery_health or "",
        "notes": input.notes or "",
        "by": original_creator,             # يبقى اسم الموظف الأصلي الذي أنشأ الفحص
        "role": existing_inspection.get("role", current["role"]),
        "at": original_time,                # وقت الإنشاء الأصلي
        "last_edited_by": current["name"],  # اسم الأدمن الذي قام بالتعديل الأخير
        "updated_at": now                   # وقت التعديل الأخير
    }
    
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {"$set": {update_field: inspection_data, "updated_at": now}}
    )
    
    await log_audit(order_id, "PRUEFPROTOKOLL", f"{update_field} aktualisiert von {current['name']}", current["name"])
    
    updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize_order(updated_order, current)

# ==================== GLOBAL ACTIVITY FEED (Admin) ====================
@router.get("/activity")
async def global_activity(limit: int = 200, current=Depends(require_roles("admin"))):
    entries = await db.audit_log.find().sort("at", -1).to_list(limit)
    orders = await db.orders.find({}, {"auftragsnummer": 1}).to_list(5000)
    amap = {str(o["_id"]): o.get("auftragsnummer", "") for o in orders}
    return [{
        "id": str(e["_id"]), "order_id": e.get("order_id"),
        "auftragsnummer": amap.get(e.get("order_id"), "—"),
        "action": e.get("action"), "detail": e.get("detail"),
        "by": e.get("by"), "at": e.get("at"),
    } for e in entries]


# ==================== REKLAMATION / GARANTIE OVERVIEW ====================
@router.get("/reklamationen")
async def list_reklamationen(current=Depends(require_roles("admin", "mitarbeiter"))):
    base = await _order_query_for_user(current)
    # اجعل البحث يقتصر على طلبات الركلاماسيون الحقيقية فقط لكي لا تتداخل مع Abgeholt
    cond = {"is_reclamation": True}
    query = {"$and": [base, cond]} if base else cond
    orders = await db.orders.find(query).sort("created_at", -1).to_list(1000)
    bmap, umap = await _name_maps()
    out = []
    for o in orders:
        s = attach_names(serialize_order(o, current, light=True), bmap, umap)
        out.append(s)
    return out

@router.get("/files/{file_path:path}")
async def serve_file(file_path: str):
    safe_path = file_path.lstrip("/\\")
    if safe_path.startswith("repair-berlin/"):
        safe_path = safe_path[len("repair-berlin/"):]
    if safe_path.startswith("uploads/"):
        safe_path = safe_path[len("uploads/"):]

    UPLOAD_DIR = "/var/www/repair-berlin-uploads"
    target_file = os.path.join(UPLOAD_DIR, safe_path)
    
    # البحث المباشر السريع أولاً
    if not os.path.exists(target_file) or not os.path.isfile(target_file):
        # إن لم يوجد، ابحث بالاسم الأخير (يمكنك الاحتفاظ بـ os.walk بحذر ولكن يفضل ضبط مسارات الرفع لتكون مباشرة)
        filename = os.path.basename(safe_path)
        target_file = None
        if os.path.exists(UPLOAD_DIR):
            for root, dirs, files in os.walk(UPLOAD_DIR):
                if filename in files:
                    target_file = os.path.join(root, filename)
                    break

    if not target_file or not os.path.exists(target_file):
        raise HTTPException(status_code=404, detail=f"File not found in storage: {safe_path}")
        
    content_type = "application/octet-stream"
    lower_path = target_file.lower()
    if lower_path.endswith((".jpg", ".jpeg")):
        content_type = "image/jpeg"
    elif lower_path.endswith(".png"):
        content_type = "image/png"
    elif lower_path.endswith(".webp"):
        content_type = "image/webp"
    elif lower_path.endswith((".mp4", ".mov")):
        content_type = "video/mp4"
    elif lower_path.endswith(".webm"):
        content_type = "video/webm"
        
    with open(target_file, "rb") as f:
        content = f.read()
        
    return Response(content=content, media_type=content_type)