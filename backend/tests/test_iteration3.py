"""Iteration 3: analytics, whatsapp log, audit log, mandatory repair media, RBAC branch, order list names."""
import os
import io
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
def ids(admin_token):
    users = requests.get(f"{API}/users", headers=_h(admin_token)).json()
    mohini = next(u for u in users if u["email"] == "mohini@repair.de")
    chris = next(u for u in users if u["email"] == "chris@repair.de")
    return {"mohini": mohini, "chris": chris}


# ---- ORDER LIST HAS NAMES ----
class TestOrderListNames:
    def test_admin_list_has_branch_and_names(self, admin_token):
        r = requests.get(f"{API}/orders", headers=_h(admin_token))
        assert r.status_code == 200
        arr = r.json()
        assert arr, "expected seeded orders"
        for o in arr:
            assert "branch_name" in o
        # at least one order should have created_by_name / assigned_techniker_name
        assert any(o.get("created_by_name") for o in arr)
        assert any(o.get("assigned_techniker_name") for o in arr)


# ---- ANALYTICS ----
class TestAnalytics:
    def test_analytics_admin_shape(self, admin_token):
        r = requests.get(f"{API}/analytics", headers=_h(admin_token))
        assert r.status_code == 200
        d = r.json()
        assert "mitarbeiter" in d and "techniker" in d
        assert isinstance(d["mitarbeiter"], list) and isinstance(d["techniker"], list)
        # Mohini present
        names = [m["name"] for m in d["mitarbeiter"]]
        assert any("Mohini" in n or "mohini" in n.lower() for n in names)
        # Techniker fields
        for t in d["techniker"]:
            for k in ("assigned", "resolved", "revenue", "avg_hours"):
                assert k in t

    def test_analytics_forbidden_mitarbeiter(self, mit_token):
        r = requests.get(f"{API}/analytics", headers=_h(mit_token))
        assert r.status_code == 403

    def test_analytics_forbidden_techniker(self, tech_token):
        r = requests.get(f"{API}/analytics", headers=_h(tech_token))
        assert r.status_code == 403


# ---- RBAC MITARBEITER BRANCH OVERRIDE ----
class TestMitarbeiterBranchLock:
    def test_mitarbeiter_create_forces_own_branch(self, mit_token, admin_token, ids):
        branches = requests.get(f"{API}/branches", headers=_h(admin_token)).json()
        mohini_bid = ids["mohini"]["branch_id"]
        assert mohini_bid, "mohini needs a branch_id"
        # pick a different branch to send in payload
        other = next(b for b in branches if b["id"] != mohini_bid)
        payload = {
            "branch_id": other["id"],  # attempt to override
            "device_brand": "Apple", "device_model": "iPhone SE",
            "issue_description": "TEST RBAC branch",
            "customer_name": "TEST rbac", "customer_phone": "+490",
        }
        r = requests.post(f"{API}/orders", headers=_h(mit_token), json=payload)
        assert r.status_code == 200, r.text
        assert r.json()["branch_id"] == mohini_bid, "backend must force mitarbeiter own branch"

    def test_mitarbeiter_list_only_own_branch(self, mit_token, ids):
        r = requests.get(f"{API}/orders", headers=_h(mit_token))
        assert r.status_code == 200
        for o in r.json():
            assert o["branch_id"] == ids["mohini"]["branch_id"]


# ---- WHATSAPP LOG ----
class TestWhatsApp:
    @pytest.fixture(scope="class")
    def order_id(self, admin_token, mit_token, ids):
        # create an order via mitarbeiter (own branch)
        payload = {
            "branch_id": ids["mohini"]["branch_id"],
            "device_brand": "Samsung", "device_model": "S24",
            "issue_description": "TEST wa",
            "customer_name": "TEST wa", "customer_phone": "01711234567",
            "assigned_techniker_id": ids["chris"]["id"],
        }
        r = requests.post(f"{API}/orders", headers=_h(mit_token), json=payload)
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def test_log_whatsapp_normalizes_phone(self, mit_token, order_id):
        r = requests.post(f"{API}/orders/{order_id}/whatsapp", headers=_h(mit_token),
                          json={"message": "Ihr Gerät ist abholbereit."})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["wa_number"].startswith("49"), f"expected 49… normalized, got {d['wa_number']}"
        assert d["message"] == "Ihr Gerät ist abholbereit."

    def test_communications_list(self, mit_token, order_id):
        r = requests.get(f"{API}/orders/{order_id}/communications", headers=_h(mit_token))
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) >= 1
        assert arr[0]["channel"] == "whatsapp"

    def test_techniker_cannot_log_or_list(self, tech_token, order_id):
        r = requests.post(f"{API}/orders/{order_id}/whatsapp", headers=_h(tech_token),
                          json={"message": "x"})
        assert r.status_code == 403
        r = requests.get(f"{API}/orders/{order_id}/communications", headers=_h(tech_token))
        assert r.status_code == 403


# ---- AUDIT LOG ----
class TestAudit:
    def test_audit_after_actions(self, admin_token, mit_token, ids):
        payload = {
            "branch_id": ids["mohini"]["branch_id"],
            "device_brand": "Apple", "device_model": "iPad",
            "issue_description": "TEST audit", "customer_name": "TEST audit",
            "customer_phone": "+490",
        }
        r = requests.post(f"{API}/orders", headers=_h(mit_token), json=payload)
        oid = r.json()["id"]
        # trigger cost update
        requests.patch(f"{API}/orders/{oid}/costs", headers=_h(mit_token),
                       json={"cost_status": "BESTAETIGT"})
        r = requests.get(f"{API}/orders/{oid}/audit", headers=_h(mit_token))
        assert r.status_code == 200
        arr = r.json()
        assert any(e["action"] == "KOSTEN" for e in arr)
        for e in arr:
            for k in ("action", "detail", "by", "at"):
                assert k in e

    def test_audit_forbidden_techniker(self, tech_token, admin_token):
        r = requests.get(f"{API}/orders", headers=_h(admin_token))
        oid = r.json()[0]["id"]
        r = requests.get(f"{API}/orders/{oid}/audit", headers=_h(tech_token))
        assert r.status_code == 403


# ---- MANDATORY REPAIR MEDIA before FERTIG ----
class TestMandatoryRepairMedia:
    def test_fertig_blocked_without_repair_media(self, admin_token, tech_token, mit_token, ids):
        # Create fresh order assigned to chris, take it to IN_BEARBEITUNG
        payload = {
            "branch_id": ids["mohini"]["branch_id"],
            "device_brand": "Apple", "device_model": "iPhone 12",
            "issue_description": "TEST repair-media",
            "customer_name": "TEST rm", "customer_phone": "+490",
            "assigned_techniker_id": ids["chris"]["id"],
        }
        r = requests.post(f"{API}/orders", headers=_h(mit_token), json=payload)
        oid = r.json()["id"]
        # accept & in_bearbeitung
        r = requests.post(f"{API}/orders/{oid}/accept", headers=_h(tech_token))
        assert r.status_code == 200
        r = requests.patch(f"{API}/orders/{oid}/status", headers=_h(tech_token),
                           json={"status": "IN_BEARBEITUNG"})
        assert r.status_code == 200
        # try FERTIG -> should 400
        r = requests.patch(f"{API}/orders/{oid}/status", headers=_h(tech_token),
                           json={"status": "FERTIG"})
        assert r.status_code == 400
        assert "Reparatur" in r.json().get("detail", "")

        # upload repair media
        files = {"file": ("repair.jpg", io.BytesIO(b"\xff\xd8\xff" + b"0"*100), "image/jpeg")}
        r = requests.post(f"{API}/orders/{oid}/media", headers=_h(tech_token),
                          data={"media_type": "repair"}, files=files)
        assert r.status_code == 200
        # now FERTIG should pass
        r = requests.patch(f"{API}/orders/{oid}/status", headers=_h(tech_token),
                           json={"status": "FERTIG"})
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "FERTIG"

    def test_intake_media_alone_does_not_unlock_fertig(self, admin_token, tech_token, mit_token, ids):
        payload = {
            "branch_id": ids["mohini"]["branch_id"],
            "device_brand": "Apple", "device_model": "iPhone 13",
            "issue_description": "TEST intake-only",
            "customer_name": "TEST io", "customer_phone": "+490",
            "assigned_techniker_id": ids["chris"]["id"],
        }
        r = requests.post(f"{API}/orders", headers=_h(mit_token), json=payload)
        oid = r.json()["id"]
        requests.post(f"{API}/orders/{oid}/accept", headers=_h(tech_token))
        requests.patch(f"{API}/orders/{oid}/status", headers=_h(tech_token),
                       json={"status": "IN_BEARBEITUNG"})
        files = {"file": ("intake.jpg", io.BytesIO(b"\xff\xd8\xff" + b"0"*100), "image/jpeg")}
        r = requests.post(f"{API}/orders/{oid}/media", headers=_h(tech_token),
                         data={"media_type": "intake"}, files=files)
        assert r.status_code == 200
        r = requests.patch(f"{API}/orders/{oid}/status", headers=_h(tech_token),
                           json={"status": "FERTIG"})
        assert r.status_code == 400  # still blocked
