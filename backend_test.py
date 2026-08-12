#!/usr/bin/env python3
"""
Backend test suite for German Repair Shop ERP - New Features Testing
Tests 7 newly added production features without re-testing existing endpoints.
"""
import requests
import json
import sys
from datetime import datetime, timedelta

# Backend URL from environment
BASE_URL = "https://shop-management-pro-12.preview.emergentagent.com/api"

# Test credentials
ADMIN_EMAIL = "admin@repair.de"
MITARBEITER_EMAIL = "mohini@repair.de"
TECHNIKER_EMAIL = "chris@repair.de"
PASSWORD = "Repair2026!"

# Color codes for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

class TestResults:
    def __init__(self):
        self.passed = []
        self.failed = []
        self.warnings = []
    
    def add_pass(self, test_name):
        self.passed.append(test_name)
        print(f"{GREEN}✓ PASS{RESET}: {test_name}")
    
    def add_fail(self, test_name, reason):
        self.failed.append((test_name, reason))
        print(f"{RED}✗ FAIL{RESET}: {test_name}")
        print(f"  Reason: {reason}")
    
    def add_warning(self, test_name, reason):
        self.warnings.append((test_name, reason))
        print(f"{YELLOW}⚠ WARNING{RESET}: {test_name}")
        print(f"  Reason: {reason}")
    
    def summary(self):
        print(f"\n{BLUE}{'='*60}{RESET}")
        print(f"{BLUE}TEST SUMMARY{RESET}")
        print(f"{BLUE}{'='*60}{RESET}")
        print(f"{GREEN}Passed: {len(self.passed)}{RESET}")
        print(f"{RED}Failed: {len(self.failed)}{RESET}")
        print(f"{YELLOW}Warnings: {len(self.warnings)}{RESET}")
        
        if self.failed:
            print(f"\n{RED}Failed Tests:{RESET}")
            for test, reason in self.failed:
                print(f"  - {test}: {reason}")
        
        return len(self.failed) == 0

results = TestResults()

def login(email, password):
    """Login and return JWT token"""
    try:
        resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
        if resp.status_code == 200:
            data = resp.json()
            # Try both 'token' and 'access_token' keys
            return data.get("token") or data.get("access_token")
        else:
            print(f"{RED}Login failed for {email}: {resp.status_code} - {resp.text}{RESET}")
            return None
    except Exception as e:
        print(f"{RED}Login exception for {email}: {e}{RESET}")
        return None

def get_headers(token):
    """Return authorization headers"""
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

def test_techniker_cost_privacy():
    """Test 1: Techniker cost privacy"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST 1: Techniker Cost Privacy{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    
    # Login as mitarbeiter
    mitarbeiter_token = login(MITARBEITER_EMAIL, PASSWORD)
    if not mitarbeiter_token:
        results.add_fail("1.1 Mitarbeiter login", "Failed to login as mitarbeiter")
        return
    results.add_pass("1.1 Mitarbeiter login")
    
    # Get technicians list
    resp = requests.get(f"{BASE_URL}/technicians", headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("1.2 Get technicians list", f"Status {resp.status_code}")
        return
    technicians = resp.json()
    chris_tech = next((t for t in technicians if t["name"].lower() == "chris"), None)
    if not chris_tech:
        results.add_fail("1.2 Get technicians list", "Chris technician not found")
        return
    techniker_id = chris_tech["id"]
    results.add_pass("1.2 Get technicians list")
    
    # Create an order with valid IMEI
    order_data = {
        "branch_id": "branch_1",
        "device_brand": "Samsung",
        "device_model": "Galaxy S21",
        "imei": "356789012345678",
        "device_passcode": "1234",
        "issue_description": "Screen cracked, needs replacement",
        "customer_name": "Max Mustermann",
        "customer_phone": "+491701234567",
        "customer_email": "max@example.com",
        "estimated_price": 150.0,
        "diagnosis_fee": 20.0,
        "labor_cost": 50.0,
        "parts_cost": 80.0
    }
    resp = requests.post(f"{BASE_URL}/orders", json=order_data, headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("1.3 Create order", f"Status {resp.status_code}: {resp.text}")
        return
    order = resp.json()
    order_id = order["id"]
    results.add_pass("1.3 Create order")
    
    # Assign to techniker (Chris)
    resp = requests.post(f"{BASE_URL}/orders/{order_id}/assign", 
                        json={"techniker_id": techniker_id},
                        headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("1.4 Assign order to techniker", f"Status {resp.status_code}")
        return
    results.add_pass("1.4 Assign order to techniker")
    
    # Login as techniker (Chris)
    techniker_token = login(TECHNIKER_EMAIL, PASSWORD)
    if not techniker_token:
        results.add_fail("1.5 Techniker login", "Failed to login as techniker")
        return
    results.add_pass("1.5 Techniker login")
    
    # GET /orders as techniker - check cost fields are hidden
    resp = requests.get(f"{BASE_URL}/orders", headers=get_headers(techniker_token))
    if resp.status_code != 200:
        results.add_fail("1.6 GET /orders as techniker", f"Status {resp.status_code}")
        return
    
    orders = resp.json()
    tech_order = next((o for o in orders if o["id"] == order_id), None)
    if not tech_order:
        results.add_fail("1.6 GET /orders as techniker", "Order not found in list")
        return
    
    # Check that cost fields are NOT present
    forbidden_fields = ["cost", "diagnosis_fee", "labor_cost", "parts_cost", "estimated_price"]
    found_forbidden = [f for f in forbidden_fields if f in tech_order]
    if found_forbidden:
        results.add_fail("1.6 GET /orders as techniker - cost hidden", 
                        f"Found forbidden fields: {found_forbidden}")
    else:
        results.add_pass("1.6 GET /orders as techniker - cost hidden")
    
    # Check cost_hidden flag
    if tech_order.get("cost_hidden") != True:
        results.add_fail("1.6 GET /orders - cost_hidden flag", "cost_hidden is not True")
    else:
        results.add_pass("1.6 GET /orders - cost_hidden flag")
    
    # GET /orders/{id} as techniker
    resp = requests.get(f"{BASE_URL}/orders/{order_id}", headers=get_headers(techniker_token))
    if resp.status_code != 200:
        results.add_fail("1.7 GET /orders/{id} as techniker", f"Status {resp.status_code}")
        return
    
    tech_order_detail = resp.json()
    found_forbidden = [f for f in forbidden_fields if f in tech_order_detail]
    if found_forbidden:
        results.add_fail("1.7 GET /orders/{id} - cost hidden", 
                        f"Found forbidden fields: {found_forbidden}")
    else:
        results.add_pass("1.7 GET /orders/{id} - cost hidden")
    
    # Check used_parts don't contain unit_price or total
    if "used_parts" in tech_order_detail:
        for part in tech_order_detail["used_parts"]:
            if "unit_price" in part or "total" in part:
                results.add_fail("1.7 GET /orders/{id} - parts pricing hidden", 
                                "used_parts contain unit_price or total")
                break
        else:
            results.add_pass("1.7 GET /orders/{id} - parts pricing hidden")
    
    # Login as admin and verify cost IS present
    admin_token = login(ADMIN_EMAIL, PASSWORD)
    if not admin_token:
        results.add_fail("1.8 Admin login", "Failed to login as admin")
        return
    
    resp = requests.get(f"{BASE_URL}/orders/{order_id}", headers=get_headers(admin_token))
    if resp.status_code != 200:
        results.add_fail("1.8 GET /orders/{id} as admin", f"Status {resp.status_code}")
        return
    
    admin_order = resp.json()
    if "cost" not in admin_order:
        results.add_fail("1.8 Admin sees cost", "cost field missing for admin")
    else:
        cost = admin_order["cost"]
        if "net" in cost and "tax" in cost and "gross" in cost:
            results.add_pass("1.8 Admin sees cost with net/tax/gross")
        else:
            results.add_fail("1.8 Admin sees cost", "cost object incomplete")
    
    # Test search privacy - techniker should NOT find by customer_name
    resp = requests.get(f"{BASE_URL}/search?q=Max", headers=get_headers(techniker_token))
    if resp.status_code != 200:
        results.add_fail("1.9 Techniker search by customer name", f"Status {resp.status_code}")
    else:
        search_results = resp.json()
        # Should NOT return the order (PII restriction)
        found = any(o["id"] == order_id for o in search_results)
        if found:
            results.add_fail("1.9 Techniker search by customer name", 
                           "Techniker can search by customer name (PII leak)")
        else:
            results.add_pass("1.9 Techniker search by customer name blocked")
    
    # Techniker SHOULD be able to search by auftragsnummer
    auftragsnummer = admin_order.get("auftragsnummer")
    if auftragsnummer:
        resp = requests.get(f"{BASE_URL}/search?q={auftragsnummer[:5]}", 
                          headers=get_headers(techniker_token))
        if resp.status_code == 200:
            search_results = resp.json()
            found = any(o["id"] == order_id for o in search_results)
            if found:
                results.add_pass("1.10 Techniker search by auftragsnummer works")
            else:
                results.add_fail("1.10 Techniker search by auftragsnummer", 
                               "Order not found by auftragsnummer")
        else:
            results.add_fail("1.10 Techniker search by auftragsnummer", 
                           f"Status {resp.status_code}")
    
    return order_id

def test_conditional_imei_validation():
    """Test 2: Conditional IMEI validation"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST 2: Conditional IMEI Validation{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    
    mitarbeiter_token = login(MITARBEITER_EMAIL, PASSWORD)
    if not mitarbeiter_token:
        results.add_fail("2.1 Mitarbeiter login", "Failed to login")
        return
    
    # Test 1: POST without IMEI and imei_unreadable=false should fail (400)
    order_data = {
        "branch_id": "branch_1",
        "device_brand": "Apple",
        "device_model": "iPhone 12",
        "imei": "",
        "imei_unreadable": False,
        "issue_description": "Battery replacement needed",
        "customer_name": "Anna Schmidt",
        "customer_phone": "+491709876543",
    }
    resp = requests.post(f"{BASE_URL}/orders", json=order_data, headers=get_headers(mitarbeiter_token))
    if resp.status_code == 400:
        results.add_pass("2.1 POST order without IMEI (imei_unreadable=false) returns 400")
    else:
        results.add_fail("2.1 POST order without IMEI validation", 
                        f"Expected 400, got {resp.status_code}")
    
    # Test 2: POST with imei_unreadable=true should succeed (200)
    order_data["imei_unreadable"] = True
    resp = requests.post(f"{BASE_URL}/orders", json=order_data, headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("2.2 POST order with imei_unreadable=true", 
                        f"Expected 200, got {resp.status_code}: {resp.text}")
        return
    
    order = resp.json()
    order_id = order["id"]
    
    # Check imei_unreadable and imei_reminder flags
    if order.get("imei_unreadable") != True:
        results.add_fail("2.2 imei_unreadable flag", "imei_unreadable is not True")
    else:
        results.add_pass("2.2 imei_unreadable flag is True")
    
    if order.get("imei_reminder") != True:
        results.add_fail("2.2 imei_reminder flag", "imei_reminder is not True")
    else:
        results.add_pass("2.2 imei_reminder flag is True")
    
    # Test 3: PATCH /orders/{id}/imei to fill in IMEI
    resp = requests.patch(f"{BASE_URL}/orders/{order_id}/imei",
                         json={"imei": "356789012345678"},
                         headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("2.3 PATCH /orders/{id}/imei", 
                        f"Expected 200, got {resp.status_code}: {resp.text}")
        return
    
    updated_order = resp.json()
    
    # Check IMEI is set
    if updated_order.get("imei") != "356789012345678":
        results.add_fail("2.3 IMEI updated", f"IMEI is {updated_order.get('imei')}")
    else:
        results.add_pass("2.3 IMEI updated correctly")
    
    # Check imei_unreadable is now False
    if updated_order.get("imei_unreadable") != False:
        results.add_fail("2.3 imei_unreadable cleared", "imei_unreadable is not False")
    else:
        results.add_pass("2.3 imei_unreadable cleared to False")
    
    # Check imei_reminder is now False
    if updated_order.get("imei_reminder") != False:
        results.add_fail("2.3 imei_reminder cleared", "imei_reminder is not False")
    else:
        results.add_pass("2.3 imei_reminder cleared to False")

def test_external_parts_procurement(order_id=None):
    """Test 3: External parts procurement"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST 3: External Parts Procurement{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    
    mitarbeiter_token = login(MITARBEITER_EMAIL, PASSWORD)
    admin_token = login(ADMIN_EMAIL, PASSWORD)
    techniker_token = login(TECHNIKER_EMAIL, PASSWORD)
    
    if not mitarbeiter_token or not admin_token or not techniker_token:
        results.add_fail("3.1 Login for procurement test", "Failed to login")
        return
    
    # Create a test order if not provided
    if not order_id:
        order_data = {
            "branch_id": "branch_1",
            "device_brand": "Samsung",
            "device_model": "Galaxy S22",
            "imei": "123456789012345",
            "issue_description": "Needs OLED display replacement",
            "customer_name": "Test Customer",
            "customer_phone": "+491701111111",
        }
        resp = requests.post(f"{BASE_URL}/orders", json=order_data, 
                           headers=get_headers(mitarbeiter_token))
        if resp.status_code != 200:
            results.add_fail("3.1 Create test order", f"Status {resp.status_code}")
            return
        order_id = resp.json()["id"]
    
    # Test 1: POST /purchases - create procurement
    expected_arrival = (datetime.now() + timedelta(days=5)).isoformat()
    purchase_data = {
        "order_id": order_id,
        "part_name": "OLED Display",
        "supplier_url": "https://x.com",
        "price": 89.9,
        "expected_arrival": expected_arrival
    }
    resp = requests.post(f"{BASE_URL}/purchases", json=purchase_data, 
                        headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("3.1 POST /purchases", f"Status {resp.status_code}: {resp.text}")
        return
    
    purchase = resp.json()
    purchase_id = purchase["id"]
    
    # Check status is ANGEFRAGT
    if purchase.get("status") != "ANGEFRAGT":
        results.add_fail("3.1 Purchase status", f"Expected ANGEFRAGT, got {purchase.get('status')}")
    else:
        results.add_pass("3.1 POST /purchases with status ANGEFRAGT")
    
    # Check order_timestamp is set
    if not purchase.get("order_timestamp"):
        results.add_fail("3.1 order_timestamp", "order_timestamp not set")
    else:
        results.add_pass("3.1 order_timestamp set")
    
    # Test 2: GET /purchases/order/{order_id}
    resp = requests.get(f"{BASE_URL}/purchases/order/{order_id}", 
                       headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("3.2 GET /purchases/order/{order_id}", f"Status {resp.status_code}")
        return
    
    purchases = resp.json()
    if not any(p["id"] == purchase_id for p in purchases):
        results.add_fail("3.2 GET /purchases/order/{order_id}", "Purchase not found")
    else:
        results.add_pass("3.2 GET /purchases/order/{order_id} returns purchase")
    
    # Test 3: PATCH /purchases/{id} - mark as ANGEKOMMEN
    resp = requests.patch(f"{BASE_URL}/purchases/{purchase_id}",
                         json={"status": "ANGEKOMMEN"},
                         headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("3.3 PATCH /purchases/{id} status", f"Status {resp.status_code}: {resp.text}")
        return
    
    updated_purchase = resp.json()
    
    # Check status is ANGEKOMMEN
    if updated_purchase.get("status") != "ANGEKOMMEN":
        results.add_fail("3.3 Status updated to ANGEKOMMEN", 
                        f"Status is {updated_purchase.get('status')}")
    else:
        results.add_pass("3.3 Status updated to ANGEKOMMEN")
    
    # Check actual_arrival is auto-populated
    if not updated_purchase.get("actual_arrival"):
        results.add_fail("3.3 actual_arrival auto-populated", "actual_arrival is None")
    else:
        results.add_pass("3.3 actual_arrival auto-populated")
    
    # Test 4: Techniker should NOT see price
    resp = requests.get(f"{BASE_URL}/purchases/order/{order_id}", 
                       headers=get_headers(techniker_token))
    if resp.status_code != 200:
        results.add_fail("3.4 Techniker GET purchases", f"Status {resp.status_code}")
    else:
        tech_purchases = resp.json()
        tech_purchase = next((p for p in tech_purchases if p["id"] == purchase_id), None)
        if tech_purchase:
            if "price" in tech_purchase:
                results.add_fail("3.4 Techniker price hidden", "price field present for techniker")
            else:
                results.add_pass("3.4 Techniker price hidden")
        else:
            results.add_fail("3.4 Techniker GET purchases", "Purchase not found")
    
    # Test 5: Admin/Mitarbeiter SHOULD see price
    resp = requests.get(f"{BASE_URL}/purchases/order/{order_id}", 
                       headers=get_headers(admin_token))
    if resp.status_code != 200:
        results.add_fail("3.5 Admin GET purchases", f"Status {resp.status_code}")
    else:
        admin_purchases = resp.json()
        admin_purchase = next((p for p in admin_purchases if p["id"] == purchase_id), None)
        if admin_purchase:
            if "price" not in admin_purchase:
                results.add_fail("3.5 Admin sees price", "price field missing for admin")
            else:
                results.add_pass("3.5 Admin sees price")
        else:
            results.add_fail("3.5 Admin GET purchases", "Purchase not found")
    
    # Test 6: DELETE as techniker should fail (403)
    resp = requests.delete(f"{BASE_URL}/purchases/{purchase_id}", 
                          headers=get_headers(techniker_token))
    if resp.status_code == 403:
        results.add_pass("3.6 DELETE as techniker returns 403")
    else:
        results.add_fail("3.6 DELETE as techniker forbidden", 
                        f"Expected 403, got {resp.status_code}")
    
    # Test 7: DELETE as mitarbeiter should succeed (200)
    resp = requests.delete(f"{BASE_URL}/purchases/{purchase_id}", 
                          headers=get_headers(mitarbeiter_token))
    if resp.status_code == 200:
        results.add_pass("3.7 DELETE as mitarbeiter returns 200")
    else:
        results.add_fail("3.7 DELETE as mitarbeiter", 
                        f"Expected 200, got {resp.status_code}")

def test_admin_notifications():
    """Test 4: Admin notifications"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST 4: Admin Notifications{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    
    admin_token = login(ADMIN_EMAIL, PASSWORD)
    mitarbeiter_token = login(MITARBEITER_EMAIL, PASSWORD)
    
    if not admin_token or not mitarbeiter_token:
        results.add_fail("4.1 Login for notifications test", "Failed to login")
        return
    
    # Clear existing notifications
    resp = requests.post(f"{BASE_URL}/notifications/read", headers=get_headers(admin_token))
    if resp.status_code != 200:
        results.add_warning("4.1 Clear notifications", f"Status {resp.status_code}")
    
    # Get initial unread count
    resp = requests.get(f"{BASE_URL}/notifications", headers=get_headers(admin_token))
    if resp.status_code != 200:
        results.add_fail("4.1 GET /notifications", f"Status {resp.status_code}")
        return
    
    initial_data = resp.json()
    initial_unread = initial_data.get("unread", 0)
    results.add_pass("4.1 GET /notifications initial state")
    
    # Perform action as mitarbeiter (create order)
    order_data = {
        "branch_id": "branch_1",
        "device_brand": "Xiaomi",
        "device_model": "Mi 11",
        "imei": "111222333444555",
        "issue_description": "Camera not working",
        "customer_name": "Notification Test",
        "customer_phone": "+491702222222",
    }
    resp = requests.post(f"{BASE_URL}/orders", json=order_data, 
                        headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("4.2 Mitarbeiter create order", f"Status {resp.status_code}")
        return
    
    # Check notifications increased
    resp = requests.get(f"{BASE_URL}/notifications", headers=get_headers(admin_token))
    if resp.status_code != 200:
        results.add_fail("4.2 GET /notifications after mitarbeiter action", 
                        f"Status {resp.status_code}")
        return
    
    after_mitarbeiter = resp.json()
    new_unread = after_mitarbeiter.get("unread", 0)
    
    if new_unread > initial_unread:
        results.add_pass("4.2 Mitarbeiter action creates notification")
    else:
        results.add_fail("4.2 Mitarbeiter action notification", 
                        f"Unread count did not increase: {initial_unread} -> {new_unread}")
    
    # Check notification details
    items = after_mitarbeiter.get("items", [])
    if items:
        latest = items[0]
        if latest.get("by_role") == "mitarbeiter":
            results.add_pass("4.2 Notification contains mitarbeiter action")
        else:
            results.add_fail("4.2 Notification by_role", 
                           f"Expected mitarbeiter, got {latest.get('by_role')}")
    
    # Perform action as admin (create order)
    admin_unread_before = new_unread
    order_data["customer_name"] = "Admin Test"
    order_data["imei"] = "999888777666555"
    resp = requests.post(f"{BASE_URL}/orders", json=order_data, 
                        headers=get_headers(admin_token))
    if resp.status_code != 200:
        results.add_fail("4.3 Admin create order", f"Status {resp.status_code}")
        return
    
    # Check notifications should NOT increase for admin action
    resp = requests.get(f"{BASE_URL}/notifications", headers=get_headers(admin_token))
    if resp.status_code != 200:
        results.add_fail("4.3 GET /notifications after admin action", 
                        f"Status {resp.status_code}")
        return
    
    after_admin = resp.json()
    admin_unread_after = after_admin.get("unread", 0)
    
    if admin_unread_after == admin_unread_before:
        results.add_pass("4.3 Admin action does NOT create notification")
    else:
        results.add_fail("4.3 Admin action notification", 
                        f"Unread increased from {admin_unread_before} to {admin_unread_after}")
    
    # Mark all as read
    resp = requests.post(f"{BASE_URL}/notifications/read", headers=get_headers(admin_token))
    if resp.status_code != 200:
        results.add_fail("4.4 POST /notifications/read", f"Status {resp.status_code}")
        return
    
    # Check unread is now 0
    resp = requests.get(f"{BASE_URL}/notifications", headers=get_headers(admin_token))
    if resp.status_code != 200:
        results.add_fail("4.4 GET /notifications after read", f"Status {resp.status_code}")
        return
    
    final_data = resp.json()
    if final_data.get("unread", 0) == 0:
        results.add_pass("4.4 POST /notifications/read clears unread count")
    else:
        results.add_fail("4.4 Unread count after read", 
                        f"Expected 0, got {final_data.get('unread')}")

def test_digital_signatures():
    """Test 5: Digital signatures"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST 5: Digital Signatures{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    
    mitarbeiter_token = login(MITARBEITER_EMAIL, PASSWORD)
    techniker_token = login(TECHNIKER_EMAIL, PASSWORD)
    
    if not mitarbeiter_token or not techniker_token:
        results.add_fail("5.1 Login for signatures test", "Failed to login")
        return
    
    # Create test order
    order_data = {
        "branch_id": "branch_1",
        "device_brand": "OnePlus",
        "device_model": "9 Pro",
        "imei": "555666777888999",
        "issue_description": "Signature test order",
        "customer_name": "Signature Test",
        "customer_phone": "+491703333333",
    }
    resp = requests.post(f"{BASE_URL}/orders", json=order_data, 
                        headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("5.1 Create test order", f"Status {resp.status_code}")
        return
    
    order_id = resp.json()["id"]
    
    # Test 1: POST intake signature (valid)
    valid_signature = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    signature_data = {
        "type": "intake",
        "signature": valid_signature,
        "signer_name": "Max Mustermann"
    }
    resp = requests.post(f"{BASE_URL}/orders/{order_id}/signature",
                        json=signature_data,
                        headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("5.1 POST intake signature", f"Status {resp.status_code}: {resp.text}")
        return
    
    order = resp.json()
    if order.get("has_intake_signature") != True:
        results.add_fail("5.1 has_intake_signature flag", "Flag is not True")
    else:
        results.add_pass("5.1 POST intake signature successful")
    
    # Check intake_signature is present in response
    if not order.get("intake_signature"):
        results.add_fail("5.1 intake_signature data", "intake_signature not in response")
    else:
        results.add_pass("5.1 intake_signature data present")
    
    # Test 2: POST pickup signature
    signature_data["type"] = "pickup"
    signature_data["signer_name"] = "Max Mustermann (Abholung)"
    resp = requests.post(f"{BASE_URL}/orders/{order_id}/signature",
                        json=signature_data,
                        headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("5.2 POST pickup signature", f"Status {resp.status_code}: {resp.text}")
    else:
        order = resp.json()
        if order.get("has_pickup_signature") == True:
            results.add_pass("5.2 POST pickup signature successful")
        else:
            results.add_fail("5.2 has_pickup_signature flag", "Flag is not True")
    
    # Test 3: Invalid signature (not starting with data:image)
    invalid_signature_data = {
        "type": "intake",
        "signature": "invalid_base64_string",
        "signer_name": "Test"
    }
    resp = requests.post(f"{BASE_URL}/orders/{order_id}/signature",
                        json=invalid_signature_data,
                        headers=get_headers(mitarbeiter_token))
    if resp.status_code == 400:
        results.add_pass("5.3 Invalid signature returns 400")
    else:
        results.add_fail("5.3 Invalid signature validation", 
                        f"Expected 400, got {resp.status_code}")
    
    # Test 4: Invalid type
    invalid_type_data = {
        "type": "invalid_type",
        "signature": valid_signature,
        "signer_name": "Test"
    }
    resp = requests.post(f"{BASE_URL}/orders/{order_id}/signature",
                        json=invalid_type_data,
                        headers=get_headers(mitarbeiter_token))
    if resp.status_code == 400:
        results.add_pass("5.4 Invalid type returns 400")
    else:
        results.add_fail("5.4 Invalid type validation", 
                        f"Expected 400, got {resp.status_code}")
    
    # Test 5: Techniker should get 403
    resp = requests.post(f"{BASE_URL}/orders/{order_id}/signature",
                        json=signature_data,
                        headers=get_headers(techniker_token))
    if resp.status_code == 403:
        results.add_pass("5.5 Techniker signature returns 403")
    else:
        results.add_fail("5.5 Techniker signature forbidden", 
                        f"Expected 403, got {resp.status_code}")

def test_warranty_and_communications():
    """Test 6: Warranty tracking + automated status communications"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST 6: Warranty Tracking & Automated Communications{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    
    mitarbeiter_token = login(MITARBEITER_EMAIL, PASSWORD)
    admin_token = login(ADMIN_EMAIL, PASSWORD)
    
    if not mitarbeiter_token or not admin_token:
        results.add_fail("6.1 Login for warranty test", "Failed to login")
        return
    
    # Create order with warranty_months
    order_data = {
        "branch_id": "branch_1",
        "device_brand": "Google",
        "device_model": "Pixel 6",
        "imei": "777888999000111",
        "issue_description": "Warranty test order",
        "customer_name": "Warranty Test",
        "customer_phone": "+491704444444",
        "warranty_months": 6
    }
    resp = requests.post(f"{BASE_URL}/orders", json=order_data, 
                        headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("6.1 Create order with warranty", f"Status {resp.status_code}")
        return
    
    order = resp.json()
    order_id = order["id"]
    
    # Check warranty_months is set
    if order.get("warranty_months") != 6:
        results.add_fail("6.1 warranty_months", f"Expected 6, got {order.get('warranty_months')}")
    else:
        results.add_pass("6.1 Order created with warranty_months=6")
    
    # Move order through statuses to ABGEHOLT
    # First to IN_BEARBEITUNG
    resp = requests.patch(f"{BASE_URL}/orders/{order_id}/status",
                         json={"status": "IN_BEARBEITUNG"},
                         headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("6.2 Set status IN_BEARBEITUNG", f"Status {resp.status_code}: {resp.text}")
        return
    
    # Check automated communication was created
    resp = requests.get(f"{BASE_URL}/orders/{order_id}/communications",
                       headers=get_headers(admin_token))
    if resp.status_code != 200:
        results.add_fail("6.2 GET communications", f"Status {resp.status_code}")
    else:
        comms = resp.json()
        auto_comm = next((c for c in comms if c.get("by") == "System (automatisch)"), None)
        if auto_comm:
            results.add_pass("6.2 Automated communication created for IN_BEARBEITUNG")
        else:
            results.add_fail("6.2 Automated communication", "No System (automatisch) entry found")
    
    # Set status to ABGEHOLT (this should trigger warranty)
    resp = requests.patch(f"{BASE_URL}/orders/{order_id}/status",
                         json={"status": "ABGEHOLT"},
                         headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("6.3 Set status ABGEHOLT", f"Status {resp.status_code}: {resp.text}")
        return
    
    order = resp.json()
    
    # Check under_warranty is True
    if order.get("under_warranty") != True:
        results.add_fail("6.3 under_warranty flag", f"Expected True, got {order.get('under_warranty')}")
    else:
        results.add_pass("6.3 under_warranty is True after ABGEHOLT")
    
    # Check warranty_until is set
    if not order.get("warranty_until"):
        results.add_fail("6.3 warranty_until", "warranty_until is None")
    else:
        results.add_pass("6.3 warranty_until is set")
    
    # Check warranty_start is set
    if not order.get("warranty_start"):
        results.add_fail("6.3 warranty_start", "warranty_start is None")
    else:
        results.add_pass("6.3 warranty_start is set")
    
    # Check automated communication for ABGEHOLT
    resp = requests.get(f"{BASE_URL}/orders/{order_id}/communications",
                       headers=get_headers(admin_token))
    if resp.status_code == 200:
        comms = resp.json()
        abgeholt_comm = next((c for c in comms 
                             if c.get("by") == "System (automatisch)" 
                             and "abgeholt" in c.get("message", "").lower()), None)
        if abgeholt_comm:
            results.add_pass("6.4 Automated communication for ABGEHOLT")
        else:
            results.add_fail("6.4 Automated communication ABGEHOLT", 
                           "No System (automatisch) entry for ABGEHOLT")

def test_global_search():
    """Test 7: Global search endpoint"""
    print(f"\n{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}TEST 7: Global Search{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    
    mitarbeiter_token = login(MITARBEITER_EMAIL, PASSWORD)
    
    if not mitarbeiter_token:
        results.add_fail("7.1 Login for search test", "Failed to login")
        return
    
    # Create test order with known values
    order_data = {
        "branch_id": "branch_1",
        "device_brand": "Nokia",
        "device_model": "G50",
        "imei": "123123123123123",
        "issue_description": "Search test order",
        "customer_name": "Search Test Customer",
        "customer_phone": "+491705555555",
    }
    resp = requests.post(f"{BASE_URL}/orders", json=order_data, 
                        headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("7.1 Create test order", f"Status {resp.status_code}")
        return
    
    order = resp.json()
    order_id = order["id"]
    auftragsnummer = order.get("auftragsnummer")
    
    # Test 1: Search by auftragsnummer prefix (e.g., "RB")
    resp = requests.get(f"{BASE_URL}/search?q=RB", headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("7.1 Search by auftragsnummer prefix", f"Status {resp.status_code}")
    else:
        results_list = resp.json()
        if isinstance(results_list, list) and len(results_list) > 0:
            results.add_pass("7.1 Search by auftragsnummer prefix returns results")
        else:
            results.add_fail("7.1 Search results", "No results returned")
    
    # Test 2: Search by full auftragsnummer
    if auftragsnummer:
        resp = requests.get(f"{BASE_URL}/search?q={auftragsnummer}", 
                          headers=get_headers(mitarbeiter_token))
        if resp.status_code != 200:
            results.add_fail("7.2 Search by auftragsnummer", f"Status {resp.status_code}")
        else:
            results_list = resp.json()
            found = any(o["id"] == order_id for o in results_list)
            if found:
                results.add_pass("7.2 Search by auftragsnummer finds order")
            else:
                results.add_fail("7.2 Search by auftragsnummer", "Order not found")
    
    # Test 3: Search by IMEI
    resp = requests.get(f"{BASE_URL}/search?q=123123123123123", 
                       headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("7.3 Search by IMEI", f"Status {resp.status_code}")
    else:
        results_list = resp.json()
        found = any(o["id"] == order_id for o in results_list)
        if found:
            results.add_pass("7.3 Search by IMEI finds order")
        else:
            results.add_fail("7.3 Search by IMEI", "Order not found")
    
    # Test 4: Search by customer_phone
    resp = requests.get(f"{BASE_URL}/search?q=491705555555", 
                       headers=get_headers(mitarbeiter_token))
    if resp.status_code != 200:
        results.add_fail("7.4 Search by phone", f"Status {resp.status_code}")
    else:
        results_list = resp.json()
        found = any(o["id"] == order_id for o in results_list)
        if found:
            results.add_pass("7.4 Search by customer_phone finds order")
        else:
            results.add_fail("7.4 Search by phone", "Order not found")

def main():
    print(f"{BLUE}{'='*60}{RESET}")
    print(f"{BLUE}German Repair Shop ERP - Backend Feature Tests{RESET}")
    print(f"{BLUE}Testing 7 newly added production features{RESET}")
    print(f"{BLUE}{'='*60}{RESET}")
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Credentials: {ADMIN_EMAIL}, {MITARBEITER_EMAIL}, {TECHNIKER_EMAIL}")
    print(f"Password: {PASSWORD}")
    
    # Run all tests
    order_id = test_techniker_cost_privacy()
    test_conditional_imei_validation()
    test_external_parts_procurement(order_id)
    test_admin_notifications()
    test_digital_signatures()
    test_warranty_and_communications()
    test_global_search()
    
    # Print summary
    success = results.summary()
    
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
