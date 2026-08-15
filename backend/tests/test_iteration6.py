"""Iteration 6 backend tests:
- GET /api/communication/status (no creds configured)
- POST /api/orders/{id}/notify (sms/whatsapp/email) with graceful fallback
- OrderCreate accepts device_lock_type/device_passcode + reclamation fields
- Regressions: IMEI conditional 400 ; techniker cost/signature stripped
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
PW = "Repair2026!"


def _login(email):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": PW}, timeout=15)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def admin_headers():
    return {"Authorization": f"Bearer {_login('admin@repair.de')}"}


@pytest.fixture(scope="session")
def techniker_headers():
    return {"Authorization": f"Bearer {_login('chris@repair.de')}"}


@pytest.fixture(scope="session")
def branch_id(admin_headers):
    r = requests.get(f"{API}/branches", headers=admin_headers, timeout=15)
    return r.json()[0]["id"]


# ---------- communication/status ----------
def test_comm_status_all_false(admin_headers):
    r = requests.get(f"{API}/communication/status", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d == {"sms": False, "whatsapp": False, "email": False}


def test_comm_status_techniker_forbidden(techniker_headers):
    r = requests.get(f"{API}/communication/status", headers=techniker_headers, timeout=15)
    assert r.status_code == 403


# ---------- order create with new fields ----------
@pytest.fixture(scope="module")
def new_order(admin_headers, branch_id):
    payload = {
        "branch_id": branch_id,
        "device_brand": "TESTBrand",
        "device_model": "TEST iPhone Lock Iter6",
        "imei": "356789012999999",
        "issue_description": "TEST iter6",
        "customer_name": "TEST_Iter6",
        "customer_phone": "015112345678",
        "customer_email": "test.iter6@example.com",
        "device_lock_type": "pattern",
        "device_passcode": "1-2-3-6-9",
        "diagnosis_fee": 10,
        "labor_cost": 20,
        "parts_cost": 5,
    }
    r = requests.post(f"{API}/orders", headers=admin_headers, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


def test_order_stores_lock_fields(admin_headers, new_order):
    oid = new_order["id"]
    r = requests.get(f"{API}/orders/{oid}", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["device_lock_type"] == "pattern"
    assert d["device_passcode"] == "1-2-3-6-9"
    assert d["is_reclamation"] is False


def test_reclamation_order_flags(admin_headers, branch_id, new_order):
    payload = {
        "branch_id": branch_id,
        "device_brand": new_order["device_brand"],
        "device_model": new_order["device_model"],
        "imei": new_order["imei"],
        "issue_description": "REKLAMATION - Gerät wieder defekt",
        "customer_name": "TEST_Iter6",
        "customer_phone": "015112345678",
        "diagnosis_fee": 0, "labor_cost": 0, "parts_cost": 0,
        "is_reclamation": True,
        "reclamation_of": new_order["id"],
        "reclamation_of_number": new_order["auftragsnummer"],
    }
    r = requests.post(f"{API}/orders", headers=admin_headers, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["is_reclamation"] is True
    assert d["reclamation_of"] == new_order["id"]
    assert d["reclamation_of_number"] == new_order["auftragsnummer"]


# ---------- notify ----------
def test_notify_whatsapp_not_configured(admin_headers, new_order):
    oid = new_order["id"]
    r = requests.post(f"{API}/orders/{oid}/notify", headers=admin_headers,
                      json={"channel": "whatsapp", "message": "Hallo Test iter6"}, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["result"]["status"] == "not_configured"
    assert d["to"].startswith("+49"), f"expected E.164 +49..., got {d['to']}"
    assert d["channel"] == "whatsapp"
    # Verify communications log
    r2 = requests.get(f"{API}/orders/{oid}/communications", headers=admin_headers, timeout=15)
    assert r2.status_code == 200
    logs = r2.json()
    matches = [l for l in logs if l["channel"] == "whatsapp" and l["status"] == "not_configured"]
    assert matches, f"no whatsapp/not_configured entry in {logs}"


def test_notify_sms_not_configured(admin_headers, new_order):
    oid = new_order["id"]
    r = requests.post(f"{API}/orders/{oid}/notify", headers=admin_headers,
                      json={"channel": "sms", "message": "SMS test"}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["result"]["status"] == "not_configured"
    assert d["to"].startswith("+49")


def test_notify_email_ok_when_email_present(admin_headers, new_order):
    oid = new_order["id"]
    r = requests.post(f"{API}/orders/{oid}/notify", headers=admin_headers,
                      json={"channel": "email", "message": "Body", "subject": "Test"}, timeout=15)
    assert r.status_code == 200
    assert r.json()["result"]["status"] == "not_configured"


def test_notify_email_400_when_no_email(admin_headers, branch_id):
    payload = {
        "branch_id": branch_id, "device_brand": "B", "device_model": "M",
        "imei": "356789012888888", "issue_description": "x",
        "customer_name": "TEST_NoEmail", "customer_phone": "015112345678",
    }
    cr = requests.post(f"{API}/orders", headers=admin_headers, json=payload, timeout=15)
    oid = cr.json()["id"]
    r = requests.post(f"{API}/orders/{oid}/notify", headers=admin_headers,
                      json={"channel": "email", "message": "no email addr"}, timeout=15)
    assert r.status_code == 400


def test_notify_invalid_channel(admin_headers, new_order):
    r = requests.post(f"{API}/orders/{new_order['id']}/notify", headers=admin_headers,
                      json={"channel": "carrier-pigeon", "message": "x"}, timeout=15)
    assert r.status_code == 400


def test_notify_empty_message(admin_headers, new_order):
    r = requests.post(f"{API}/orders/{new_order['id']}/notify", headers=admin_headers,
                      json={"channel": "sms", "message": "   "}, timeout=15)
    assert r.status_code == 400


# ---------- regression ----------
def test_imei_required_conditional(admin_headers, branch_id):
    r = requests.post(f"{API}/orders", headers=admin_headers, json={
        "branch_id": branch_id, "device_brand": "B", "device_model": "M",
        "imei": "", "imei_unreadable": False, "issue_description": "x",
        "customer_name": "TEST_IMEI", "customer_phone": "015112345678",
    }, timeout=15)
    assert r.status_code == 400


def test_techniker_cost_and_signature_stripped(techniker_headers):
    r = requests.get(f"{API}/orders", headers=techniker_headers, timeout=15)
    orders = r.json()
    if not orders:
        pytest.skip("techniker has no orders")
    oid = orders[0]["id"]
    r2 = requests.get(f"{API}/orders/{oid}", headers=techniker_headers, timeout=15)
    d = r2.json()
    assert d.get("cost_hidden") is True
    for f in ("cost", "diagnosis_fee", "labor_cost", "parts_cost",
              "pickup_signature", "intake_signature",
              "customer_name", "customer_phone"):
        assert f not in d, f"techniker sees {f}"
