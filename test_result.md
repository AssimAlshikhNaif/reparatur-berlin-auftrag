#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Add 7 production-grade features to the German Repair Shop ERP WITHOUT removing any existing
  functionality: (1) External parts procurement & tracking per order, (2) Conditional IMEI validation
  with "Gerät defekt / IMEI nicht lesbar" bypass + persistent reminder, (3) Digital signatures (intake
  + pickup) with legal liability waiver, (4) Real-time admin notifications (polling) with visual toast +
  audible beep for every Mitarbeiter/Techniker action, (5) Strict cost privacy for Technicians,
  (6) Warranty tracking (Garantiefall) + automated status notifications, (7) Global search + enhanced analytics.

backend:
  - task: "Techniker cost privacy in serialize_order"
    implemented: true
    working: true
    file: "backend/routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "serialize_order now strips cost, diagnosis_fee, labor_cost, parts_cost, estimated_price and used_parts prices for techniker role; sets cost_hidden=true. Verify techniker GET /orders and /orders/{id} contain no cost keys, while admin/mitarbeiter still see them."
        - working: true
          agent: "testing"
          comment: "✅ ALL TESTS PASSED (12/12). Verified: (1) Techniker GET /orders and /orders/{id} do NOT contain cost/diagnosis_fee/labor_cost/parts_cost/estimated_price fields, (2) cost_hidden flag is true for techniker, (3) used_parts do NOT contain unit_price or total for techniker, (4) Admin/Mitarbeiter see full cost object with net/tax/gross, (5) Techniker search by customer_name is blocked (PII protection), (6) Techniker can search by auftragsnummer. Cost privacy implementation is production-ready."
  - task: "Conditional IMEI validation + reminder + PATCH imei"
    implemented: true
    working: true
    file: "backend/routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /orders now 400 if imei empty AND imei_unreadable false. Stores imei_unreadable; serialize adds imei_reminder flag. New PATCH /orders/{id}/imei sets imei and clears imei_unreadable. Smoke-tested via curl (400/200/200)."
        - working: true
          agent: "testing"
          comment: "✅ ALL TESTS PASSED (6/6). Verified: (1) POST /orders without IMEI and imei_unreadable=false returns 400 with validation error, (2) POST /orders with imei_unreadable=true succeeds (200) and sets imei_unreadable=true and imei_reminder=true, (3) PATCH /orders/{id}/imei successfully updates IMEI and clears both imei_unreadable and imei_reminder flags to false. Conditional validation working correctly."
  - task: "External parts procurement CRUD (purchases.py)"
    implemented: true
    working: true
    file: "backend/purchases.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Rewrote purchases.py (previously crashed: db not imported). GET /purchases/order/{id}, POST /purchases, PATCH /purchases/{id}, DELETE /purchases/{id}. Fields part_name, supplier_url, order_timestamp, expected_arrival, actual_arrival, status (ANGEFRAGT/BESTELLT/UNTERWEGS/ANGEKOMMEN/EINGEBAUT/STORNIERT). Price hidden for techniker. Marking ANGEKOMMEN auto-stamps actual_arrival. Notifies admin + audit log."
        - working: true
          agent: "testing"
          comment: "✅ ALL TESTS PASSED (8/8). Verified: (1) POST /purchases creates procurement with status ANGEFRAGT and order_timestamp set, (2) GET /purchases/order/{order_id} returns purchases, (3) PATCH status to ANGEKOMMEN auto-populates actual_arrival timestamp, (4) Techniker responses do NOT contain price field (privacy), (5) Admin/Mitarbeiter responses DO contain price field, (6) DELETE as techniker returns 403 (forbidden), (7) DELETE as mitarbeiter returns 200 (success). Full CRUD working with proper role-based access control."
  - task: "Digital signatures endpoint"
    implemented: true
    working: true
    file: "backend/routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "POST /orders/{id}/signature {type: intake|pickup, signature (data:image base64), signer_name}. Admin/Mitarbeiter only. Order create also accepts intake_signature. serialize adds has_intake_signature/has_pickup_signature; full base64 only in single GET (light=true in lists)."
        - working: true
          agent: "testing"
          comment: "✅ ALL TESTS PASSED (6/6). Verified: (1) POST intake signature with valid data:image base64 returns 200 and sets has_intake_signature=true with signature data present, (2) POST pickup signature works similarly with has_pickup_signature flag, (3) Invalid signature (not starting with data:image) returns 400, (4) Invalid type returns 400, (5) Techniker attempting to add signature returns 403 (forbidden). Signature capture working correctly with proper validation and access control."
  - task: "Admin notifications (polling)"
    implemented: true
    working: true
    file: "backend/notify.py, backend/routes.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "push_notification only creates docs for mitarbeiter/techniker actions (admin actions skipped by design). Wired into create/assign/accept/reject/status/costs/parts/media/whatsapp/imei/signature/purchases. GET /notifications (admin) returns {unread, items}; POST /notifications/read; DELETE /notifications. Verified mitarbeiter create -> admin unread=1; admin create -> no notification."
        - working: true
          agent: "testing"
          comment: "✅ ALL TESTS PASSED (5/5). Verified: (1) GET /notifications returns initial state with unread count, (2) Mitarbeiter action (create order) increases unread count and creates notification with by_role=mitarbeiter, (3) Admin action (create order) does NOT increase unread count (by design - admin not notified of own actions), (4) POST /notifications/read successfully clears unread count to 0. Notification system working as designed with proper role filtering."
  - task: "Warranty tracking + automated status communications"
    implemented: true
    working: true
    file: "backend/routes.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "warranty_months (default 6) on create; when status -> ABGEHOLT sets warranty_start/until; serialize computes under_warranty + warranty_days_left. auto_status_communication logs an automated WhatsApp-style message into db.communications on status changes (IN_BEARBEITUNG/WARTEN_ERSATZTEIL/FERTIG/ABGEHOLT/ABGELEHNT)."
        - working: true
          agent: "testing"
          comment: "✅ ALL TESTS PASSED (6/6). Verified: (1) Order created with warranty_months=6, (2) Status change to IN_BEARBEITUNG creates automated communication with by='System (automatisch)', (3) Status change to ABGEHOLT sets under_warranty=true, warranty_start and warranty_until timestamps, (4) Automated communication for ABGEHOLT status is logged in communications. Warranty tracking and automated status notifications working correctly."
  - task: "Global search endpoint"
    implemented: true
    working: true
    file: "backend/routes.py"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "GET /search?q= searches auftragsnummer/imei/customer_phone (+customer_name for non-techniker), role-scoped via _order_query_for_user. Returns light serialized orders. Verified q=Max returns 1."
        - working: true
          agent: "testing"
          comment: "✅ ALL TESTS PASSED (4/4). Verified: (1) Search by auftragsnummer prefix (e.g., 'RB') returns matching results, (2) Search by full auftragsnummer finds specific order, (3) Search by IMEI finds order, (4) Search by customer_phone finds order. Global search working correctly with role-based scoping (techniker cannot search by customer_name as verified in cost privacy tests)."

frontend:
  - task: "OrderCreate: IMEI toggle, warranty, intake signature + waiver"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/OrderCreate.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Added required IMEI with 'Gerät defekt / IMEI nicht lesbar' checkbox bypass, warranty months select, SignaturePad + LIABILITY_WAIVER text. NOT yet frontend-tested (awaiting user go-ahead)."
  - task: "OrderDetail: IMEI reminder/fill-in, warranty badge, signatures, cost hidden for techniker"
    implemented: true
    working: "NA"
    file: "frontend/src/pages/OrderDetail.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "Cost section + part prices hidden when role=techniker. IMEI reminder badge + inline fill form. Warranty badge. Digital signatures section (intake view + pickup capture). Awaiting frontend test permission."
  - task: "Procurement tab, NotificationBell, GlobalSearch, list badges"
    implemented: true
    working: "NA"
    file: "frontend/src/components/OrderPurchasesTab.jsx, NotificationBell.jsx, GlobalSearch.jsx, Layout.jsx, Orders.jsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
        - working: "NA"
          agent: "main"
          comment: "New OrderPurchasesTab using new API; NotificationBell (admin, 5s poll, toast + Web Audio beep); GlobalSearch in top bar; IMEI/Garantie badges in Orders list. Awaiting frontend test permission."

metadata:
  created_by: "main_agent"
  version: "2.1"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
    - agent: "main"
      message: |
        Implemented 7 new backend feature areas without touching existing behavior. Please test BACKEND ONLY now.
        Seeded users password: Repair2026! (admin@repair.de, mohini@repair.de=mitarbeiter, chris@repair.de=techniker). See /app/memory/test_credentials.md.
        Key scenarios:
        1) Cost privacy: assign an order to a techniker, login as chris@repair.de -> GET /orders and /orders/{id} must NOT contain 'cost'/'diagnosis_fee'/'labor_cost'/'parts_cost' and used_parts must have no unit_price/total; admin/mitarbeiter still get cost. Techniker global /search must not match customer_name.
        2) IMEI: POST /orders without imei and imei_unreadable=false -> 400; with imei_unreadable=true -> 200 and imei_reminder=true; PATCH /orders/{id}/imei -> imei set, imei_unreadable false, imei_reminder false.
        3) Procurement: full CRUD on /purchases; set status ANGEKOMMEN auto-fills actual_arrival; techniker responses omit price.
        4) Notifications (admin GET /notifications): a mitarbeiter/techniker action creates an unread notification; an admin action does NOT. POST /notifications/read zeroes unread.
        5) Signatures: POST /orders/{id}/signature type intake/pickup with data:image base64 -> 200; invalid base64 -> 400; techniker forbidden (403).
        6) Warranty: mark order ABGEHOLT -> under_warranty true and warranty_until set; auto communication logged (GET /orders/{id}/communications shows a 'System (automatisch)' entry).
        7) Global search GET /search?q= by auftragsnummer / imei / phone returns matches, role-scoped.
        Do NOT retest unrelated existing endpoints unless needed for regression of the above.
    - agent: "testing"
      message: |
        ✅ BACKEND TESTING COMPLETE - ALL 7 FEATURES PASSED (48/48 tests)
        
        Comprehensive testing completed for all 7 newly added production features. Created backend_test.py with 48 automated test cases covering all scenarios specified in the review request.
        
        TEST RESULTS SUMMARY:
        
        1. ✅ Techniker Cost Privacy (12/12 tests passed)
           - Cost fields completely hidden from techniker role
           - Admin/Mitarbeiter see full cost breakdown
           - PII protection: techniker cannot search by customer name
           - Search by auftragsnummer works for all roles
        
        2. ✅ Conditional IMEI Validation (6/6 tests passed)
           - Validation enforced when imei_unreadable=false
           - Bypass works with imei_unreadable=true
           - PATCH endpoint successfully fills in IMEI later
           - Flags (imei_reminder, imei_unreadable) update correctly
        
        3. ✅ External Parts Procurement (8/8 tests passed)
           - Full CRUD operations working
           - Auto-timestamp on ANGEKOMMEN status
           - Price hidden from techniker, visible to admin/mitarbeiter
           - DELETE restricted to admin/mitarbeiter (403 for techniker)
        
        4. ✅ Admin Notifications (5/5 tests passed)
           - Mitarbeiter/Techniker actions create notifications
           - Admin actions do NOT create notifications (by design)
           - Mark as read functionality working
           - Unread count accurate
        
        5. ✅ Digital Signatures (6/6 tests passed)
           - Intake and pickup signatures captured successfully
           - Validation working (data:image format, valid types)
           - Access control: techniker forbidden (403)
           - Signature flags (has_intake_signature, has_pickup_signature) set correctly
        
        6. ✅ Warranty Tracking & Automated Communications (6/6 tests passed)
           - Warranty period set on order creation
           - ABGEHOLT status triggers warranty_start/until
           - Automated communications logged with "System (automatisch)"
           - Status change notifications working
        
        7. ✅ Global Search (4/4 tests passed)
           - Search by auftragsnummer, IMEI, phone working
           - Role-based scoping enforced
           - Results returned correctly
        
        NO CRITICAL ISSUES FOUND. All backend APIs are production-ready.
        
        Test artifacts:
        - /app/backend_test.py (comprehensive test suite)
        - /app/test_output.log (detailed test execution log)
