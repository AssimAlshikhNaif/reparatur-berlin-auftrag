"""Iteration 7 backend tests:
- POST /api/orders/{id}/inspection (admin/mitarbeiter/assigned techniker)
- FERTIG gate requires BOTH repair media AND saved inspection
- GET /api/activity (admin only, 403 for others)
- GET /api/reklamationen (admin/mitarbeiter) role-scoped, flags present
- Regression: create → assign → accept → start; techniker cost/PII stripped
"""
import os
import io
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
def mitarbeiter_headers():
    return {"Authorization": f"Bearer {_login('mohini@repair.de')}"}


@pytest.fixture(scope="session")
def techniker_headers():
    return {"Authorization": f"Bearer {_login('chris@repair.de')}"}


@pytest.fixture(scope="session")
def techniker_id(admin_headers):
    r = requests.get(f"{API}/users", headers=admin_headers, timeout=15)
    for u in r.json():
        if u.get("email") == "chris@repair.de":
            return u["id"]
    pytest.skip("chris techniker not found")


@pytest.fixture(scope="session")
def branch_id(admin_headers):
    r = requests.get(f"{API}/branches", headers=admin_headers, timeout=15)
    return r.json()[0]["id"]


def _create_order(admin_headers, branch_id, tid, model="TEST_Iter7 Model"):
    payload = {
        "branch_id": branch_id,
        "device_brand": "TESTBrand",
        "device_model": model,
        "imei": "356789012777777",
        "issue_description": "TEST iter7 QC",
        "customer_name": "TEST_Iter7",
        "customer_phone": "015112345678",
        "customer_email": "iter7@example.com",
        "diagnosis_fee": 10, "labor_cost": 20, "parts_cost": 5,
        "assigned_techniker_id": tid,
    }
    r = requests.post(f"{API}/orders", headers=admin_headers, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- INSPECTION ----------
def test_inspection_save_by_admin(admin_headers, branch_id, techniker_id):
    o = _create_order(admin_headers, branch_id, techniker_id, "TEST_Iter7 Insp Admin")
    oid = o["id"]
    payload = {
        "checklist": {
            "battery": {"status": "OK", "note": ""},
            "wifi": {"status": "OK", "note": ""},
            "fingerprint": {"status": "NV", "note": "kein Sensor"},
            "faceid": {"status": "OK", "note": ""},
            "housing": {"status": "NOK", "note": "kleiner Kratzer"},
            "cameras": {"status": "OK", "note": ""},
        },
        "display_type": "OLED",
        "battery_health": "92",
        "notes": "Alles ok bis auf Gehäuse",
    }
    r = requests.post(f"{API}/orders/{oid}/inspection", headers=admin_headers, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    # GET verify persisted
    r2 = requests.get(f"{API}/orders/{oid}", headers=admin_headers, timeout=15)
    d = r2.json()
    ins = d.get("inspection")
    assert ins is not None, "inspection missing after save"
    assert ins["display_type"] == "OLED"
    assert ins["battery_health"] == "92"
    assert ins["checklist"]["housing"]["status"] == "NOK"
    assert ins["checklist"]["housing"]["note"] == "kleiner Kratzer"
    assert ins.get("by")
    assert ins.get("at")
    # Audit contains PRUEFPROTOKOLL
    ra = requests.get(f"{API}/orders/{oid}/audit", headers=admin_headers, timeout=15)
    assert ra.status_code == 200
    actions = [e["action"] for e in ra.json()]
    assert "PRUEFPROTOKOLL" in actions, f"audit missing PRUEFPROTOKOLL: {actions}"


def test_inspection_save_by_assigned_techniker(admin_headers, techniker_headers, branch_id, techniker_id):
    o = _create_order(admin_headers, branch_id, techniker_id, "TEST_Iter7 Insp Tech")
    oid = o["id"]
    payload = {
        "checklist": {"battery": {"status": "OK", "note": ""}},
        "display_type": "Original", "battery_health": "100", "notes": "ok",
    }
    r = requests.post(f"{API}/orders/{oid}/inspection", headers=techniker_headers, json=payload, timeout=15)
    assert r.status_code == 200, r.text


# ---------- FERTIG GATE ----------
def _upload_repair_media(headers, oid):
    # 1x1 png
    png = (b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
           b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xf8\xcf\xc0\x00"
           b"\x00\x00\x03\x00\x01\xe2!\xbc3\x00\x00\x00\x00IEND\xaeB`\x82")
    files = {"file": ("test.png", io.BytesIO(png), "image/png")}
    data = {"media_type": "repair"}
    r = requests.post(f"{API}/orders/{oid}/media", headers=headers,
                      files=files, data=data, timeout=15)
    assert r.status_code == 200, r.text


def test_fertig_gate_requires_inspection(admin_headers, techniker_headers, branch_id, techniker_id):
    o = _create_order(admin_headers, branch_id, techniker_id, "TEST_Iter7 FertigGate")
    oid = o["id"]
    # techniker accept + start
    r = requests.post(f"{API}/orders/{oid}/accept", headers=techniker_headers, timeout=15)
    assert r.status_code == 200, r.text
    r = requests.patch(f"{API}/orders/{oid}/status", headers=techniker_headers,
                       json={"status": "IN_BEARBEITUNG"}, timeout=15)
    assert r.status_code == 200, r.text

    # 1) attempt FERTIG with no media, no inspection -> 400 (media)
    r = requests.patch(f"{API}/orders/{oid}/status", headers=techniker_headers,
                       json={"status": "FERTIG"}, timeout=15)
    assert r.status_code == 400
    assert "Foto" in r.text or "Video" in r.text or "Reparatur" in r.text

    # 2) upload repair media, still no inspection -> 400 (inspection)
    _upload_repair_media(techniker_headers, oid)
    r = requests.patch(f"{API}/orders/{oid}/status", headers=techniker_headers,
                       json={"status": "FERTIG"}, timeout=15)
    assert r.status_code == 400, r.text
    assert "Prüfprotokoll" in r.text or "Endkontrolle" in r.text

    # 3) save inspection -> now FERTIG succeeds
    r = requests.post(f"{API}/orders/{oid}/inspection", headers=techniker_headers, json={
        "checklist": {"battery": {"status": "OK", "note": ""}},
        "display_type": "Original", "battery_health": "95", "notes": "",
    }, timeout=15)
    assert r.status_code == 200, r.text
    r = requests.patch(f"{API}/orders/{oid}/status", headers=techniker_headers,
                       json={"status": "FERTIG"}, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "FERTIG"


# ---------- ACTIVITY ----------
def test_activity_admin_ok(admin_headers):
    r = requests.get(f"{API}/activity", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    entries = r.json()
    assert isinstance(entries, list)
    assert len(entries) > 0, "activity feed unexpectedly empty"
    e = entries[0]
    for k in ("id", "order_id", "auftragsnummer", "action", "detail", "by", "at"):
        assert k in e, f"activity entry missing {k}: {e}"


def test_activity_mitarbeiter_forbidden(mitarbeiter_headers):
    r = requests.get(f"{API}/activity", headers=mitarbeiter_headers, timeout=15)
    assert r.status_code == 403


def test_activity_techniker_forbidden(techniker_headers):
    r = requests.get(f"{API}/activity", headers=techniker_headers, timeout=15)
    assert r.status_code == 403


# ---------- REKLAMATIONEN ----------
def test_reklamationen_admin(admin_headers):
    r = requests.get(f"{API}/reklamationen", headers=admin_headers, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)
    # each item includes flags
    for o in data:
        # under_warranty always set by compute_warranty; is_reclamation only present if truthy on legacy orders
        assert "under_warranty" in o
        assert o.get("is_reclamation") or o.get("under_warranty")


def test_reklamationen_mitarbeiter_scoped(mitarbeiter_headers):
    r = requests.get(f"{API}/reklamationen", headers=mitarbeiter_headers, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_reklamationen_techniker_forbidden(techniker_headers):
    r = requests.get(f"{API}/reklamationen", headers=techniker_headers, timeout=15)
    assert r.status_code == 403


# ---------- REGRESSION: techniker PII/cost stripped ----------
def test_techniker_cost_signature_stripped(techniker_headers):
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
