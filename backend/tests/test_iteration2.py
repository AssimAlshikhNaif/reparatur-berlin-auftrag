"""Iteration 2: costs, used parts (stock deduction), manual status, admin revenue stats."""
import os
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE}/api"
PWD = "Repair2026!"


def _login(email):
    return requests.post(f"{API}/auth/login", json={"email": email, "password": PWD})


def _h(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def admin_token():
    return _login("admin@repair.de").json()["access_token"]


@pytest.fixture(scope="module")
def mit_token():
    return _login("mohini@repair.de").json()["access_token"]


@pytest.fixture(scope="module")
def tech_token():
    return _login("chris@repair.de").json()["access_token"]


@pytest.fixture(scope="module")
def order_ctx(admin_token):
    # Use mohini's branch so mitarbeiter can operate on the order
    r = requests.get(f"{API}/users", headers=_h(admin_token))
    users = r.json()
    mohini = next(u for u in users if u["email"] == "mohini@repair.de")
    chris = next(u for u in users if u["email"] == "chris@repair.de")
    branch_id = mohini["branch_id"]
    if not branch_id:
        branch_id = requests.get(f"{API}/branches", headers=_h(admin_token)).json()[0]["id"]
    payload = {
        "branch_id": branch_id, "device_brand": "Apple", "device_model": "iPhone 15",
        "issue_description": "TEST cost + parts", "customer_name": "TEST it2",
        "customer_phone": "+49", "estimated_price": 100,
        "diagnosis_fee": 20, "labor_cost": 50, "parts_cost": 0,
        "assigned_techniker_id": chris["id"],
    }
    r = requests.post(f"{API}/orders", headers=_h(admin_token), json=payload)
    assert r.status_code == 200, r.text
    return {"order": r.json(), "chris_id": chris["id"], "branch_id": branch_id}


class TestCosts:
    def test_initial_cost_calc(self, order_ctx):
        c = order_ctx["order"]["cost"]
        assert c["net"] == 70.0
        assert c["tax"] == round(70.0 * 0.19, 2)
        assert c["gross"] == round(70.0 * 1.19, 2)
        assert c["status"] == "WARTET"

    def test_update_costs_and_status_bestaetigt(self, mit_token, order_ctx):
        oid = order_ctx["order"]["id"]
        r = requests.patch(f"{API}/orders/{oid}/costs", headers=_h(mit_token),
                           json={
                               "diagnosis_fee": 30, 
                               "labor_cost": 100, 
                               "parts_cost": 20,
                               "cost_status": "BESTAETIGT",
                               "paid_amount": 50.0  # <--- أضفنا اختبار المبلغ المدفوع هنا للاطمئنان التام
                           })
        assert r.status_code == 200, r.text
        c = r.json()["cost"]
        assert c["net"] == 150.0
        assert c["gross"] == round(150.0 * 1.19, 2)
        assert c["status"] == "BESTAETIGT"
        assert c["paid_amount"] == 50.0  # <--- التحقق من أن السيرفر حفظ المبلغ المدفوع
        assert c["remaining_amount"] == round(c["gross"] - 50.0, 2)  # <--- التحقق من صحة حساب المتبقي

    def test_reject_cost_status(self, mit_token, order_ctx):
        oid = order_ctx["order"]["id"]
        r = requests.patch(f"{API}/orders/{oid}/costs", headers=_h(mit_token),
                           json={"cost_status": "ABGELEHNT"})
        assert r.status_code == 200
        assert r.json()["cost"]["status"] == "ABGELEHNT"

    def test_invalid_cost_status(self, mit_token, order_ctx):
        oid = order_ctx["order"]["id"]
        r = requests.patch(f"{API}/orders/{oid}/costs", headers=_h(mit_token),
                           json={"cost_status": "NONSENSE"})
        assert r.status_code == 400

    def test_techniker_cannot_update_costs(self, tech_token, order_ctx):
        oid = order_ctx["order"]["id"]
        r = requests.patch(f"{API}/orders/{oid}/costs", headers=_h(tech_token),
                           json={"diagnosis_fee": 999})
        assert r.status_code == 403


class TestUsedParts:
    def test_add_part_deducts_stock_and_updates_cost(self, admin_token, mit_token, order_ctx):
        oid = order_ctx["order"]["id"]
        inv = requests.get(f"{API}/inventory", headers=_h(admin_token)).json()
        item = next(i for i in inv if i["quantity"] >= 3)
        item_id = item["id"]
        qty_before = item["quantity"]
        price = item["price"]

        order_before = requests.get(f"{API}/orders/{oid}", headers=_h(admin_token)).json()
        parts_cost_before = order_before["cost"]["parts_cost"]

        r = requests.post(f"{API}/orders/{oid}/parts", headers=_h(mit_token),
                          json={"inventory_id": item_id, "quantity": 2})
        assert r.status_code == 200, r.text
        data = r.json()
        assert len(data["used_parts"]) >= 1
        added = [p for p in data["used_parts"] if p["inventory_id"] == item_id]
        assert added, "Added part should be in used_parts"
        part = added[-1]
        assert part["quantity"] == 2
        expected_total = round(price * 2, 2)
        assert part["total"] == expected_total
        assert data["cost"]["parts_cost"] == round(parts_cost_before + expected_total, 2)

        # Verify stock deducted
        inv_after = requests.get(f"{API}/inventory", headers=_h(admin_token)).json()
        item_after = next(i for i in inv_after if i["id"] == item_id)
        assert item_after["quantity"] == qty_before - 2

        # Save for removal test
        order_ctx["part_id"] = part["id"]
        order_ctx["item_id"] = item_id
        order_ctx["qty_before"] = qty_before
        order_ctx["part_total"] = expected_total
        order_ctx["parts_cost_before"] = parts_cost_before

    def test_techniker_can_add_part(self, admin_token, tech_token, order_ctx):
        oid = order_ctx["order"]["id"]
        inv = requests.get(f"{API}/inventory", headers=_h(admin_token)).json()
        item = next(i for i in inv if i["quantity"] >= 1 and i["id"] != order_ctx.get("item_id"))
        r = requests.post(f"{API}/orders/{oid}/parts", headers=_h(tech_token),
                          json={"inventory_id": item["id"], "quantity": 1})
        assert r.status_code == 200, r.text
        # Remove it back
        added = r.json()["used_parts"][-1]
        rd = requests.delete(f"{API}/orders/{oid}/parts/{added['id']}", headers=_h(tech_token))
        assert rd.status_code == 200

    def test_remove_part_restores_stock(self, admin_token, mit_token, order_ctx):
        oid = order_ctx["order"]["id"]
        part_id = order_ctx["part_id"]
        r = requests.delete(f"{API}/orders/{oid}/parts/{part_id}", headers=_h(mit_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert not any(p["id"] == part_id for p in data["used_parts"])
        # stock restored
        inv_after = requests.get(f"{API}/inventory", headers=_h(admin_token)).json()
        item_after = next(i for i in inv_after if i["id"] == order_ctx["item_id"])
        assert item_after["quantity"] == order_ctx["qty_before"]
        # parts_cost decreased
        assert data["cost"]["parts_cost"] == order_ctx["parts_cost_before"]

    def test_insufficient_stock(self, mit_token, admin_token, order_ctx):
        oid = order_ctx["order"]["id"]
        inv = requests.get(f"{API}/inventory", headers=_h(admin_token)).json()
        item = inv[0]
        r = requests.post(f"{API}/orders/{oid}/parts", headers=_h(mit_token),
                          json={"inventory_id": item["id"], "quantity": 99999})
        assert r.status_code == 400


class TestManualStatus:
    def test_mitarbeiter_set_warten_ersatzteil(self, mit_token, order_ctx):
        oid = order_ctx["order"]["id"]
        r = requests.patch(f"{API}/orders/{oid}/status", headers=_h(mit_token),
                           json={"status": "WARTEN_ERSATZTEIL"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "WARTEN_ERSATZTEIL"

    def test_mitarbeiter_set_fertig(self, mit_token, admin_token, order_ctx):
        oid = order_ctx["order"]["id"]
        # Iteration 3: repair media mandatory
        files = {"file": ("repair.jpg", __import__("io").BytesIO(b"\xff\xd8\xff" + b"0" * 100), "image/jpeg")}
        rm = requests.post(f"{API}/orders/{oid}/media", headers=_h(admin_token),
                           data={"media_type": "repair"}, files=files)
        assert rm.status_code == 200
        r = requests.patch(f"{API}/orders/{oid}/status", headers=_h(mit_token),
                           json={"status": "FERTIG"})
        assert r.status_code == 200
        assert r.json()["status"] == "FERTIG"

    def test_mitarbeiter_cannot_set_zugewiesen(self, mit_token, order_ctx):
        oid = order_ctx["order"]["id"]
        r = requests.patch(f"{API}/orders/{oid}/status", headers=_h(mit_token),
                           json={"status": "ZUGEWIESEN"})
        assert r.status_code == 403

    def test_techniker_warten_ersatzteil(self, tech_token, order_ctx):
        oid = order_ctx["order"]["id"]
        r = requests.patch(f"{API}/orders/{oid}/status", headers=_h(tech_token),
                           json={"status": "WARTEN_ERSATZTEIL"})
        assert r.status_code == 200
        assert r.json()["status"] == "WARTEN_ERSATZTEIL"


class TestAdminStats:
    def test_admin_revenue_and_branch(self, admin_token):
        r = requests.get(f"{API}/stats", headers=_h(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert "revenue" in d
        assert "completed_repairs" in d
        assert "revenue_by_branch" in d
        assert isinstance(d["revenue_by_branch"], list)
        assert len(d["revenue_by_branch"]) == 5
        for b in d["revenue_by_branch"]:
            assert set(["branch", "revenue", "orders", "completed"]).issubset(b.keys())

    def test_mitarbeiter_no_revenue(self, mit_token):
        r = requests.get(f"{API}/stats", headers=_h(mit_token))
        d = r.json()
        assert "revenue_by_branch" not in d


class TestTechnikerDSGVO:
    def test_techniker_order_no_pii(self, tech_token, order_ctx):
        oid = order_ctx["order"]["id"]
        r = requests.get(f"{API}/orders/{oid}", headers=_h(tech_token))
        assert r.status_code == 200
        d = r.json()
        for f in ["customer_name", "customer_phone", "customer_email", "customer_address"]:
            assert f not in d
        assert d.get("dsgvo_masked") is True
        # But cost visible
        assert "cost" in d
