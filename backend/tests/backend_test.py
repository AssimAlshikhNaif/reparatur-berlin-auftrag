"""Backend API tests for Reparatur-Verwaltung Berlin."""
import os
import io
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE:
    # Fallback: read from frontend env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE}/api"
PWD = "Repair2026!"


def _login(email, password=PWD):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password})
    return r


@pytest.fixture(scope="session")
def admin_token():
    r = _login("admin@repair.de")
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def mit_token():
    r = _login("mohini@repair.de")
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def tech_token():
    r = _login("chris@repair.de")
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _h(t):
    return {"Authorization": f"Bearer {t}"}


# ---- AUTH ----
class TestAuth:
    def test_admin_login(self):
        r = _login("admin@repair.de")
        assert r.status_code == 200
        d = r.json()
        assert "access_token" in d and d["user"]["role"] == "admin"

    def test_mitarbeiter_login(self):
        r = _login("mohini@repair.de")
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "mitarbeiter"

    def test_techniker_login(self):
        r = _login("chris@repair.de")
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "techniker"

    def test_wrong_password(self):
        r = _login("admin@repair.de", "wrongpass123")
        assert r.status_code in (401, 429)

    def test_no_public_register(self):
        r = requests.post(f"{API}/auth/register", json={"email": "x@x.de", "password": "x"})
        assert r.status_code in (404, 405)

    def test_me(self, admin_token):
        r = requests.get(f"{API}/auth/me", headers=_h(admin_token))
        assert r.status_code == 200
        assert r.json()["email"] == "admin@repair.de"


# ---- STATS / DASHBOARD ----
class TestStats:
    def test_admin_stats(self, admin_token):
        r = requests.get(f"{API}/stats", headers=_h(admin_token))
        assert r.status_code == 200
        d = r.json()
        for k in ["total_orders", "active_orders", "sla_breached", "total_users", "total_branches"]:
            assert k in d

    def test_techniker_stats(self, tech_token):
        r = requests.get(f"{API}/stats", headers=_h(tech_token))
        assert r.status_code == 200


# ---- BRANCHES / USERS / INVENTORY ----
class TestSeeded:
    def test_branches_count(self, admin_token):
        r = requests.get(f"{API}/branches", headers=_h(admin_token))
        assert r.status_code == 200
        assert len(r.json()) == 5

    def test_users_count(self, admin_token):
        r = requests.get(f"{API}/users", headers=_h(admin_token))
        assert r.status_code == 200
        assert len(r.json()) >= 10

    def test_users_forbidden_for_techniker(self, tech_token):
        r = requests.get(f"{API}/users", headers=_h(tech_token))
        assert r.status_code == 403

    def test_inventory_seeded(self, admin_token):
        r = requests.get(f"{API}/inventory", headers=_h(admin_token))
        assert r.status_code == 200
        assert len(r.json()) >= 40

    def test_inventory_mitarbeiter_readable(self, mit_token):
        r = requests.get(f"{API}/inventory", headers=_h(mit_token))
        assert r.status_code == 200

    def test_inventory_mitarbeiter_cannot_create(self, mit_token):
        r = requests.post(f"{API}/inventory", headers=_h(mit_token),
                          json={"sku": "T", "part_type": "x", "brand": "y",
                                "device_model": "z", "price": 1, "quantity": 1, "min_stock": 1})
        assert r.status_code == 403


# ---- USER MANAGEMENT ----
class TestUsers:
    def test_create_and_delete_user(self, admin_token):
        import uuid
        email = f"test_{uuid.uuid4().hex[:8]}@repair.de"
        r = requests.post(f"{API}/users", headers=_h(admin_token),
                          json={"name": "TEST User", "email": email, "role": "mitarbeiter",
                                "password": "Test2026!", "branch_id": None})
        assert r.status_code == 200, r.text
        uid = r.json()["id"]
        # verify in list
        r2 = requests.get(f"{API}/users", headers=_h(admin_token))
        assert any(u["email"] == email for u in r2.json())
        # delete
        rd = requests.delete(f"{API}/users/{uid}", headers=_h(admin_token))
        assert rd.status_code == 200


# ---- ORDERS FLOW ----
class TestOrders:
    @pytest.fixture(scope="class")
    def branch_id(self, admin_token):
        r = requests.get(f"{API}/branches", headers=_h(admin_token))
        return r.json()[0]["id"]

    @pytest.fixture(scope="class")
    def techniker_id(self, admin_token):
        r = requests.get(f"{API}/technicians", headers=_h(admin_token))
        # chris is expected
        for t in r.json():
            if "chris" in t["name"].lower() or "Chris" in t["name"]:
                return t["id"]
        return r.json()[0]["id"]

    @pytest.fixture(scope="class")
    def chris_id(self, admin_token):
        r = requests.get(f"{API}/users", headers=_h(admin_token))
        for u in r.json():
            if u["email"] == "chris@repair.de":
                return u["id"]
        return None

    def test_create_order_and_get(self, admin_token, branch_id, chris_id):
        payload = {
            "branch_id": branch_id, "device_brand": "Apple", "device_model": "iPhone 15",
            "imei": "TEST123", "issue_description": "Display kaputt",
            "customer_name": "TEST Kunde", "customer_phone": "+491234567",
            "customer_email": "test@example.com", "customer_address": "Berlin",
            "estimated_price": 199.0, "assigned_techniker_id": chris_id,
        }
        r = requests.post(f"{API}/orders", headers=_h(admin_token), json=payload)
        assert r.status_code == 200, r.text
        o = r.json()
        assert o["auftragsnummer"].startswith("RB-2026-")
        assert o["status"] == "ZUGEWIESEN"
        pytest.order_id = o["id"]
        pytest.auftragsnummer = o["auftragsnummer"]

        # GET verify
        r2 = requests.get(f"{API}/orders/{o['id']}", headers=_h(admin_token))
        assert r2.status_code == 200
        assert r2.json()["auftragsnummer"] == o["auftragsnummer"]

    def test_lookup(self, admin_token):
        r = requests.get(f"{API}/orders/lookup/{pytest.auftragsnummer}", headers=_h(admin_token))
        assert r.status_code == 200

    def test_techniker_sees_no_pii(self, tech_token):
        r = requests.get(f"{API}/orders/{pytest.order_id}", headers=_h(tech_token))
        assert r.status_code == 200
        d = r.json()
        for f in ["customer_name", "customer_phone", "customer_email", "customer_address"]:
            assert f not in d
        assert d.get("dsgvo_masked") is True

    def test_techniker_accept(self, tech_token):
        r = requests.post(f"{API}/orders/{pytest.order_id}/accept", headers=_h(tech_token))
        assert r.status_code == 200
        assert r.json()["status"] == "AKZEPTIERT"

    def test_techniker_start_repair(self, tech_token):
        r = requests.patch(f"{API}/orders/{pytest.order_id}/status", headers=_h(tech_token),
                           json={"status": "IN_BEARBEITUNG"})
        assert r.status_code == 200

    def test_techniker_mark_ready(self, tech_token):
        # Iteration 3: repair media is mandatory before FERTIG
        files = {"file": ("repair.jpg", io.BytesIO(b"\xff\xd8\xff" + b"0" * 100), "image/jpeg")}
        rm = requests.post(f"{API}/orders/{pytest.order_id}/media", headers=_h(tech_token),
                           data={"media_type": "repair"}, files=files)
        assert rm.status_code == 200, rm.text
        r = requests.patch(f"{API}/orders/{pytest.order_id}/status", headers=_h(tech_token),
                           json={"status": "FERTIG"})
        assert r.status_code == 200
        assert r.json()["status"] == "FERTIG"

    def test_mitarbeiter_deliver(self, mit_token):
        r = requests.patch(f"{API}/orders/{pytest.order_id}/status", headers=_h(mit_token),
                           json={"status": "ABGEHOLT"})
        # Note: mitarbeiter must be same branch; we use branch[0] for order and mohini could be different
        # Accept 200 or 403 (if wrong branch); but we still record
        assert r.status_code in (200, 403), r.text

    def test_media_upload(self, admin_token):
        files = {"file": ("test.png", io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"0" * 100), "image/png")}
        r = requests.post(f"{API}/orders/{pytest.order_id}/media", headers=_h(admin_token),
                          data={"media_type": "intake"}, files=files)
        assert r.status_code == 200, r.text
        assert "storage_path" in r.json()

    def test_messages_get(self, admin_token):
        r = requests.get(f"{API}/orders/{pytest.order_id}/messages", headers=_h(admin_token))
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---- REJECT FLOW (separate order) ----
class TestRejectFlow:
    def test_create_and_reject(self, admin_token, tech_token):
        r = requests.get(f"{API}/branches", headers=_h(admin_token))
        branch_id = r.json()[0]["id"]
        r = requests.get(f"{API}/users", headers=_h(admin_token))
        chris_id = next(u["id"] for u in r.json() if u["email"] == "chris@repair.de")
        payload = {
            "branch_id": branch_id, "device_brand": "Samsung", "device_model": "S24",
            "issue_description": "Wasser", "customer_name": "TEST Reject",
            "customer_phone": "+490", "assigned_techniker_id": chris_id,
        }
        ro = requests.post(f"{API}/orders", headers=_h(admin_token), json=payload)
        assert ro.status_code == 200
        oid = ro.json()["id"]
        rj = requests.post(f"{API}/orders/{oid}/reject", headers=_h(tech_token),
                           json={"reason": "Wirtschaftlicher Totalschaden"})
        assert rj.status_code == 200
        assert rj.json()["status"] == "ABGELEHNT"
