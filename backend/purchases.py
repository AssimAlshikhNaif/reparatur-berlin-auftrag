from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from bson import ObjectId
from auth import get_current_user

router = APIRouter(prefix="/api/purchases", tags=["purchases"])

class PartRequestCreate(BaseModel):
    order_id: str
    item_name: str
    supplier_url: str
    notes: Optional[str] = None

class PurchaseProcess(BaseModel):
    price: float
    estimated_days: int
    status: str = "BESTELLT"

# 1. جلب جميع طلبات القطع الخاصة برقم عقد معين (Auftrag)
@router.get("/order/{order_id}")
async def get_purchases_by_order(order_id: str):
    # ملاحظة: تأكد من أن متغير الاتصال بقاعدة البيانات لديك مطابق (مثل db أو client)
    purchases = await db.purchases.find({"order_id": order_id}).to_list(100)
    for p in purchases:
        p["_id"] = str(p["_id"])
    return purchases

# 2. التقني يرسل طلب قطعة (اسم القطعة والرابط)
@router.post("/request")
async def request_part_by_tech(data: PartRequestCreate, current_user = Depends(get_current_user)):
    if current_user["role"] not in ["techniker", "admin"]:
        raise HTTPException(status_code=403, detail="Nur Techniker und Administratoren dürfen Teile anfordern.")

    part_doc = {
        "order_id": data.order_id,
        "item_name": data.item_name,
        "supplier_url": data.supplier_url,
        "notes": data.notes,
        "requested_by_id": current_user["id"],
        "requested_by_name": current_user["name"],
        "requested_by_role": current_user["role"],
        "price": 0.0,
        "estimated_days": 0,
        "status": "ANGEFRAGT",
        "created_at": datetime.utcnow().isoformat()
    }
    
    result = await db.purchases.insert_one(part_doc)
    part_doc["_id"] = str(result.inserted_id)
    return part_doc

# 3. الموظف أو الأدمن يعتمد الطلب ويدخل السعر ووقت التوصيل
@router.patch("/{purchase_id}/process")
async def process_purchase(purchase_id: str, data: PurchaseProcess, current_user = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "mitarbeiter"]:
        raise HTTPException(status_code=403, detail="Nur Admin und Mitarbeiter können Bestellungen freigeben.")

    await db.purchases.update_one(
        {"_id": ObjectId(purchase_id)},
        {"$set": {
            "price": data.price,
            "estimated_days": data.estimated_days,
            "status": data.status,
            "processed_by": current_user["name"]
        }}
    )
    return {"message": "Bestellung erfolgreich aktualisiert"}