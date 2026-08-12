import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List
from bson import ObjectId

from fastapi import (APIRouter, HTTPException, Depends, UploadFile, File,
                     Query, Header, WebSocket, WebSocketDisconnect, Response, Form)
from pydantic import BaseModel

from db import db
from auth import get_current_user, require_roles, decode_user_from_token
from storage import put_object, get_object, APP_NAME

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

# ---- Status constants ----
STATUS_FLOW = [
    "ANGENOMMEN", "ZUGEWIESEN", "AKZEPTIERT", "IN_BEARBEITUNG",
    "WARTEN_ERSATZTEIL", "FERTIG", "ABGEHOLT", "ABGELEHNT",
]
COST_STATES = {"WARTET", "BESTAETIGT", "ABGELEHNT"}
TAX_RATE = 0.19
FINAL_STATES = {"ABGEHOLT", "ABGELEHNT"}
PII_FIELDS = ["customer_name", "customer_phone", "customer_email", "customer_address"]


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
    net = round(d + l + p, 2)
    tax = round(net * TAX_RATE, 2)
    gross = round(net + tax, 2)
    return {
        "diagnosis_fee": d, "labor_cost": l, "parts_cost": p,
        "net": net, "tax": tax, "gross": gross, "tax_rate": 19,
        "status": order.get("cost_status", "WARTET"),
    }


def serialize_order(order: dict, user: dict) -> dict:
    o = dict(order)
    o["id"] = str(o.pop("_id"))
    o["sla_breached"] = is_sla_breached(order)
    o["working_days_open"] = working_days_since(order.get("updated_at", order.get("created_at", "")))
    o["cost"] = compute_costs(order)
    o["used_parts"] = order.get("used_parts", [])
    if user["role"] == "techniker":
        for f in PII_FIELDS:
            o.pop(f, None)
        o["dsgvo_masked"] = True
    return o


async def _name_maps():
    branches = await db.branches.find().to_list(100)
    users = await db.users.find().to_list(500)
    bmap = {str(b["_id"]): b["name"] for b in branches}
    umap = {str(u["_id"]): u["name"] for u in users}
    return bmap, umap


def attach_names(o: dict, bmap: dict, umap: dict) -> dict:
    o["branch_name"] = bmap.get(o.get("branch_id"), "—")
    tid = o.get("assigned_techniker_id")
    o["assigned_techniker_name"] = umap.get(tid) if tid else None
    return o


async def log_audit(order_id: str, action: str, detail: str, by: str):
    await db.audit_log.insert_one({
        "order_id": order_id, "action": action, "detail": detail,
        "by": by, "at": datetime.now(timezone.utc).isoformat(),
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


# ---- Models ----
class OrderCreate(BaseModel):
    branch_id: str
    device_brand: str
    device_model: str
    imei: Optional[str] = ""
    issue_description: str
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = ""
    customer_address: Optional[str] = ""
    estimated_price: Optional[float] = None
    diagnosis_fee: Optional[float] = 0
    labor_cost: Optional[float] = 0
    parts_cost: Optional[float] = 0
    assigned_techniker_id: Optional[str] = None


class CostUpdate(BaseModel):
    diagnosis_fee: Optional[float] = None
    labor_cost: Optional[float] = None
    parts_cost: Optional[float] = None
    cost_status: Optional[str] = None


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
@router.get("/branches")
async def list_branches(current=Depends(get_current_user)):
    branches = await db.branches.find().to_list(100)
    return [{"id": str(b["_id"]), "name": b["name"]} for b in branches]


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


@router.get("/orders")
async def list_orders(status: Optional[str] = None, sla: Optional[bool] = None,
                     current=Depends(get_current_user)):
    query = await _order_query_for_user(current)
    if status:
        query["status"] = status
    orders = await db.orders.find(query).sort("created_at", -1).to_list(1000)
    bmap, umap = await _name_maps()
    result = [attach_names(serialize_order(o, current), bmap, umap) for o in orders]
    if sla:
        result = [o for o in result if o.get("sla_breached")]
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


@router.post("/orders")
async def create_order(input: OrderCreate, current=Depends(require_roles("admin", "mitarbeiter"))):
    now = datetime.now(timezone.utc).isoformat()
    auftragsnummer = await next_auftragsnummer()
    status = "ZUGEWIESEN" if input.assigned_techniker_id else "ANGENOMMEN"
    branch_id = input.branch_id
    if current["role"] == "mitarbeiter":
        branch_id = current.get("branch_id") or input.branch_id
    doc = {
        "auftragsnummer": auftragsnummer,
        "branch_id": branch_id,
        "device_brand": input.device_brand,
        "device_model": input.device_model,
        "imei": input.imei or "",
        "device_passcode": getattr(input, "device_passcode", "") or "",  # <--- إضافة حفظ كلمة السر هنا
        "issue_description": input.issue_description,
        "customer_name": input.customer_name,
        "customer_phone": input.customer_phone,
        "customer_email": input.customer_email or "",
        "customer_address": input.customer_address or "",
        "estimated_price": input.estimated_price,
        "diagnosis_fee": input.diagnosis_fee or 0,
        "labor_cost": input.labor_cost or 0,
        "parts_cost": input.parts_cost or 0,
        "cost_status": "WARTET",
        "used_parts": [],
        "assigned_techniker_id": input.assigned_techniker_id,
        "status": status,
        "reject_reason": "",
        "media": [],
        "status_history": [{"status": status, "at": now, "by": current["name"]}],
        "created_by": str(current["_id"]),
        "created_by_name": current["name"],
        "created_at": now,
        "updated_at": now,
    }
    res = await db.orders.insert_one(doc)
    order = await db.orders.find_one({"_id": res.inserted_id})
    return serialize_order(order, current)


async def _touch_order(order_id, new_status, by_name, extra=None):
    now = datetime.now(timezone.utc).isoformat()
    update = {"$set": {"status": new_status, "updated_at": now},
             "$push": {"status_history": {"status": new_status, "at": now, "by": by_name}}}
    if extra:
        update["$set"].update(extra)
    await db.orders.update_one({"_id": ObjectId(order_id)}, update)
    await log_audit(order_id, "STATUS", f"Status → {new_status}", by_name)


@router.post("/orders/{order_id}/assign")
async def assign_order(order_id: str, input: AssignInput,
                       current=Depends(require_roles("admin", "mitarbeiter"))):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    tech = await db.users.find_one({"_id": ObjectId(input.techniker_id), "role": "techniker"})
    if not tech:
        raise HTTPException(status_code=404, detail="Techniker nicht gefunden")
    await _touch_order(order_id, "ZUGEWIESEN", current["name"],
                       {"assigned_techniker_id": input.techniker_id})
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize_order(order, current)


@router.post("/orders/{order_id}/accept")
async def accept_order(order_id: str, current=Depends(require_roles("techniker"))):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order or order.get("assigned_techniker_id") != str(current["_id"]):
        raise HTTPException(status_code=403, detail="Nicht zugewiesen")
    await _touch_order(order_id, "AKZEPTIERT", current["name"])
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
        if input.status not in ("IN_BEARBEITUNG", "WARTEN_ERSATZTEIL", "FERTIG"):
            raise HTTPException(status_code=403, detail="Techniker dürfen diesen Status nicht setzen")
    elif role == "mitarbeiter":
        if input.status not in ("ANGENOMMEN", "IN_BEARBEITUNG", "WARTEN_ERSATZTEIL", "FERTIG", "ABGEHOLT"):
            raise HTTPException(status_code=403, detail="Mitarbeiter dürfen diesen Status nicht setzen")
    if input.status == "FERTIG":
        has_repair_media = any(m.get("media_type") == "repair" for m in order.get("media", []))
        if not has_repair_media:
            raise HTTPException(status_code=400,
                                detail="Bitte zuerst Reparatur-Fotos/Videos aufnehmen, bevor der Auftrag als 'Fertig' markiert wird.")
    await _touch_order(order_id, input.status, current["name"],
                       {"reject_reason": input.reason} if input.reason else None)
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return serialize_order(order, current)

# ==================== COSTS ====================
@router.patch("/orders/{order_id}/costs")
async def update_costs(order_id: str, input: CostUpdate,
                       current=Depends(require_roles("admin", "mitarbeiter"))):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    updates = {}
    for k in ("diagnosis_fee", "labor_cost", "parts_cost"):
        v = getattr(input, k)
        if v is not None:
            updates[k] = float(v)
    if input.cost_status is not None:
        if input.cost_status not in COST_STATES:
            raise HTTPException(status_code=400, detail="Ungültiger Kostenstatus")
        updates["cost_status"] = input.cost_status
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": updates})
        if "cost_status" in updates:
            await log_audit(order_id, "KOSTEN", f"Kostenstatus → {updates['cost_status']}", current["name"])
        else:
            await log_audit(order_id, "KOSTEN", "Kosten aktualisiert", current["name"])
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
    digits = "".join(c for c in phone if c.isdigit())
    if digits.startswith("0"):
        digits = "49" + digits[1:]
    return {"id": str(res.inserted_id), "to": phone, "wa_number": digits,
            "message": input.message, "by": current["name"], "at": now}


@router.get("/orders/{order_id}/communications")
async def get_communications(order_id: str, current=Depends(require_roles("admin", "mitarbeiter"))):
    items = await db.communications.find({"order_id": order_id}).sort("at", -1).to_list(500)
    return [{"id": str(i["_id"]), "channel": i["channel"], "to": i.get("to", ""),
             "message": i["message"], "by": i["by"], "at": i["at"]} for i in items]


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
async def analytics(current=Depends(require_roles("admin"))):
    orders = await db.orders.find().to_list(5000)
    users = await db.users.find().to_list(500)
    mitarbeiter = {str(u["_id"]): {"id": str(u["_id"]), "name": u["name"], "role": u["role"],
                                   "created": 0, "delivered": 0, "revenue": 0.0}
                   for u in users if u["role"] in ("mitarbeiter", "admin")}
    techniker = {str(u["_id"]): {"id": str(u["_id"]), "name": u["name"],
                                  "assigned": 0, "resolved": 0, "revenue": 0.0,
                                  "_times": []}
                 for u in users if u["role"] == "techniker"}

    for o in orders:
        gross = compute_costs(o)["gross"]
        cb = o.get("created_by")
        if cb in mitarbeiter:
            mitarbeiter[cb]["created"] += 1
            if o["status"] == "ABGEHOLT":
                mitarbeiter[cb]["delivered"] += 1
                mitarbeiter[cb]["revenue"] = round(mitarbeiter[cb]["revenue"] + gross, 2)
        tid = o.get("assigned_techniker_id")
        if tid in techniker:
            techniker[tid]["assigned"] += 1
            if o["status"] in ("FERTIG", "ABGEHOLT"):
                techniker[tid]["resolved"] += 1
                if o["status"] == "ABGEHOLT":
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


# ==================== MEDIA ====================
@router.post("/orders/{order_id}/media")
async def upload_media(order_id: str, media_type: str = Form("intake"),
                       file: UploadFile = File(...), current=Depends(get_current_user)):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Auftrag nicht gefunden")
    if current["role"] == "techniker" and order.get("assigned_techniker_id") != str(current["_id"]):
        raise HTTPException(status_code=403, detail="Nicht zugewiesen")
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "bin"
    path = f"{APP_NAME}/orders/{order_id}/{uuid.uuid4()}.{ext}"
    data = await file.read()
    ct = file.content_type or "application/octet-stream"
    result = put_object(path, data, ct)
    media_item = {
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": ct,
        "media_type": media_type,
        "is_video": ct.startswith("video"),
        "uploaded_by": current["name"],
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.files.insert_one({**media_item, "order_id": order_id, "is_deleted": False})
    await db.orders.update_one({"_id": ObjectId(order_id)},
                              {"$push": {"media": media_item},
                               "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}})
    return media_item


@router.get("/files/{path:path}")
async def serve_file(path: str, authorization: str = Header(None), auth: str = Query(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(status_code=401, detail="Nicht authentifiziert")
    user = await decode_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Ungültiger Token")
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="Datei nicht gefunden")
    data, ct = get_object(path)
    return Response(content=data, media_type=record.get("content_type", ct))


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


# ==================== STATS ====================
@router.get("/stats")
async def stats(current=Depends(get_current_user)):
    query = await _order_query_for_user(current)
    orders = await db.orders.find(query).to_list(2000)
    by_status = {}
    sla_count = 0
    for o in orders:
        by_status[o["status"]] = by_status.get(o["status"], 0) + 1
        if is_sla_breached(o):
            sla_count += 1
    inv = await db.inventory.find().to_list(2000)
    low_stock = [i for i in inv if i["quantity"] <= i["min_stock"]]
    result = {
        "total_orders": len(orders),
        "by_status": by_status,
        "sla_breached": sla_count,
        "active_orders": len([o for o in orders if o["status"] not in FINAL_STATES]),
    }
    if current["role"] == "admin":
        result["total_users"] = await db.users.count_documents({})
        result["total_branches"] = await db.branches.count_documents({})
        result["low_stock_count"] = len(low_stock)
        result["low_stock_items"] = [
            {"sku": i["sku"], "device_model": i["device_model"], "part_type": i["part_type"],
             "quantity": i["quantity"], "min_stock": i["min_stock"]} for i in low_stock
        ]
        delivered = [o for o in orders if o["status"] == "ABGEHOLT"]
        result["completed_repairs"] = len(delivered)
        result["revenue"] = round(sum(compute_costs(o)["gross"] for o in delivered), 2)
        branches = await db.branches.find().to_list(100)
        bmap = {str(b["_id"]): b["name"] for b in branches}
        by_branch = {}
        for b_id, name in bmap.items():
            by_branch[name] = {"branch": name, "revenue": 0.0, "orders": 0, "completed": 0}
        for o in orders:
            name = bmap.get(o.get("branch_id"))
            if not name:
                continue
            by_branch[name]["orders"] += 1
            if o["status"] == "ABGEHOLT":
                by_branch[name]["completed"] += 1
                by_branch[name]["revenue"] = round(by_branch[name]["revenue"] + compute_costs(o)["gross"], 2)
        result["by_branch"] = list(by_branch.values())
    return result