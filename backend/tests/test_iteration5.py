"""Iteration 5 backend tests:
- GoBD invoice numbering + idempotency (per-branch, ABGEHOLT only, techniker restricted)
- GET /branches branch config shape
- GET /purchases/all + /purchases/alerts role scoping
- POST /orders/{id}/assign after ABGELEHNT (reassign)
- Techniker cost/signature stripping regression
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"
PW = "Repair2026!"


def _login(email):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": PW}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
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


# ---------------- Branches ----------------
def test_branches_shape(admin_headers):
    r = requests.get(f"{API}/branches", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) > 0
    b0 = data[0]
    for k in ("id", "name", "city", "address", "phone", "email", "logo_url", "tax_number", "steuernummer"):
        assert k in b0, f"missing key {k} in branch: {b0}"


# ---------------- Purchases ----------------
def test_purchases_all_ok(admin_headers, mitarbeiter_headers):
    r = requests.get(f"{API}/purchases/all", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    r2 = requests.get(f"{API}/purchases/all", headers=mitarbeiter_headers, timeout=15)
    assert r2.status_code == 200


def test_purchases_all_techniker_forbidden(techniker_headers):
    r = requests.get(f"{API}/purchases/all", headers=techniker_headers, timeout=15)
    assert r.status_code == 403


def test_purchases_alerts_ok(admin_headers):
    r = requests.get(f"{API}/purchases/alerts", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ---------------- Helpers ----------------
def _find_abgeholt_order(headers):
    r = requests.get(f"{API}/orders?status=ABGEHOLT", headers=headers, timeout=15)
    assert r.status_code == 200
    lst = r.json()
    assert len(lst) > 0, "no ABGEHOLT orders seeded"
    return lst


# ---------------- Invoice ----------------
def test_invoice_gobd_idempotent_admin(admin_headers):
    orders = _find_abgeholt_order(admin_headers)
    oid = orders[0]["id"]
    r1 = requests.post(f"{API}/orders/{oid}/invoice", headers=admin_headers, timeout=15)
    assert r1.status_code == 200, r1.text
    d1 = r1.json()
    inv_no = d1.get("invoice_number")
    assert inv_no and re.match(r"^RE-\d{4}-[A-Z0-9]{4}-\d{5}$", inv_no), f"bad invoice number: {inv_no}"
    assert d1.get("invoice_date")

    # Idempotent: call twice → same number
    r2 = requests.post(f"{API}/orders/{oid}/invoice", headers=admin_headers, timeout=15)
    assert r2.status_code == 200
    assert r2.json().get("invoice_number") == inv_no


def test_invoice_requires_abgeholt(admin_headers):
    # find a non-ABGEHOLT order
    r = requests.get(f"{API}/orders", headers=admin_headers, timeout=15)
    non = [o for o in r.json() if o["status"] not in ("ABGEHOLT",)]
    assert non, "need a non-ABGEHOLT order"
    oid = non[0]["id"]
    r2 = requests.post(f"{API}/orders/{oid}/invoice", headers=admin_headers, timeout=15)
    assert r2.status_code == 400


def test_invoice_per_branch_sequences(admin_headers):
    r = requests.get(f"{API}/orders?status=ABGEHOLT", headers=admin_headers, timeout=15)
    orders = r.json()
    by_branch = {}
    for o in orders:
        by_branch.setdefault(o["branch_id"], []).append(o)
    branches_used = [v[0] for v in by_branch.values()]
    if len(branches_used) < 2:
        pytest.skip("need ABGEHOLT orders in at least 2 branches")
    o1, o2 = branches_used[0], branches_used[1]
    inv1 = requests.post(f"{API}/orders/{o1['id']}/invoice", headers=admin_headers, timeout=15).json()["invoice_number"]
    inv2 = requests.post(f"{API}/orders/{o2['id']}/invoice", headers=admin_headers, timeout=15).json()["invoice_number"]
    # branch prefix segment (last 4 of branch id, upper) should differ
    seg1 = inv1.split("-")[2]
    seg2 = inv2.split("-")[2]
    assert seg1 != seg2, f"same branch segment {seg1} for different branches"


# ---------------- Reassign after ABGELEHNT ----------------
def test_reassign_after_rejected(admin_headers, techniker_headers):
    # Create a fresh order, assign, reject, then reassign
    branches = requests.get(f"{API}/branches", headers=admin_headers, timeout=15).json()
    techs = requests.get(f"{API}/technicians", headers=admin_headers, timeout=15).json()
    assert len(techs) >= 2
    chris = next(t for t in techs if "Chris" in t["name"])
    other = next(t for t in techs if t["id"] != chris["id"])
    payload = {
        "branch_id": branches[0]["id"],
        "device_brand": "TESTBrand", "device_model": "TESTModel", "imei": "356789012345678",
        "issue_description": "TEST reassign after reject",
        "customer_name": "TEST_Reassign", "customer_phone": "015112345678",
        "assigned_techniker_id": chris["id"],
    }
    cr = requests.post(f"{API}/orders", headers=admin_headers, json=payload, timeout=15)
    assert cr.status_code == 200, cr.text
    oid = cr.json()["id"]
    # techniker rejects
    rj = requests.post(f"{API}/orders/{oid}/reject", headers=techniker_headers, json={"reason": "TEST reject"}, timeout=15)
    assert rj.status_code == 200
    assert rj.json()["status"] == "ABGELEHNT"
    # admin reassigns
    ra = requests.post(f"{API}/orders/{oid}/assign", headers=admin_headers, json={"techniker_id": other["id"]}, timeout=15)
    assert ra.status_code == 200, ra.text
    d = ra.json()
    assert d["status"] == "ZUGEWIESEN"
    assert d["assigned_techniker_id"] == other["id"]


# ---------------- Techniker regression: cost hidden ----------------
def test_techniker_cost_and_signature_stripped(admin_headers, techniker_headers):
    # find an order assigned to Chris
    r = requests.get(f"{API}/orders", headers=techniker_headers, timeout=15)
    assert r.status_code == 200
    orders = r.json()
    assert orders, "chris has no orders"
    oid = orders[0]["id"]
    r2 = requests.get(f"{API}/orders/{oid}", headers=techniker_headers, timeout=15)
    assert r2.status_code == 200
    o = r2.json()
    assert o.get("cost_hidden") is True
    assert "cost" not in o
    assert "diagnosis_fee" not in o
    assert "labor_cost" not in o
    assert "parts_cost" not in o
    assert "pickup_signature" not in o
    assert "intake_signature" not in o
