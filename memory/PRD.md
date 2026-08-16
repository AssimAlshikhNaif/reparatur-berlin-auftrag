# PRD — Reparatur-Verwaltung Berlin (Repair Management ERP)

## Original Problem Statement
Production-ready, secure full-stack Repair Management System (ERP) for a smartphone repair chain in Berlin. Entire UI in GERMAN. Strict RBAC with no public registration, order management with QR + printable 80mm Abholschein, order-based realtime chat, 3-day SLA alarm, seeded branches/users/inventory. DSGVO-compliant (Techniker must not see customer PII).

## Stack (user-confirmed adaptation)
- Frontend: React (CRA/craco) + Tailwind + Phosphor Icons + qrcode.react + html5-qrcode
- Backend: FastAPI + WebSockets (chat) + JWT auth (bcrypt)
- DB: MongoDB (motor)
- Object storage: Emergent object storage for media (photos/videos)

## User Personas
- ADMIN: full access to all 5 branches, inventory, users, system SLA alerts.
- MITARBEITER (front-desk): create orders, intake media, print Abholschein, assign techniker, mark delivered, read-only inventory.
- TECHNIKER (workshop): sees only assigned orders WITHOUT customer PII (DSGVO), accept/reject with reason, upload repair media, chat.

## Core Requirements (static)
- No public registration; admin-only user creation.
- Auftragsnummer (RB-YYYY-#####) + QR code per order; QR scan/manual lookup.
- 80mm thermal printable Abholschein.
- Realtime order chat (WebSocket) between Mitarbeiter/Techniker.
- 3-working-day SLA alarm surfaced on dashboard.
- Seeded: 5 branches, 10 users (pwd Repair2026!), 44 spare parts.

## Implemented (2026-08-03)
- JWT auth, RBAC, DSGVO PII masking, orders lifecycle, media (upload + live camera), WebSocket chat, inventory, users, branches, stats/dashboard, SLA, QR gen + scan, German UI.
- **Iteration 2**: Detailed cost breakdown (Diagnosegebühr/Arbeitslohn/Ersatzteilkosten) with auto 19% MwSt totals; cost-estimate status (Wartet/Bestätigt/Abgelehnt); Mitarbeiter manual status change incl. "Warten auf Ersatzteil"; live camera capture (Foto/Video via getUserMedia) on create + detail; Abholschein print + jsPDF download with QR & totals; used-parts linkage with automatic inventory Lagerabzug (add/remove restores stock); admin revenue metric + revenue-by-branch chart (recharts); Techniker "Warten auf Ersatzteil" flow.
- Demo seed: 8 orders (5 abgeholt with revenue €854.54, 1 SLA breach, 2 assigned to Techniker Chris), 44 spare parts, 5 branches, 10 users.
- Tested: iteration_1 (25/25) + iteration_2 (16/16 new) all passing; full frontend E2E across all 3 roles.
- **Iteration 3**: Order list columns Filiale/Mitarbeiter/Techniker; Performance-Analyse dashboard (/analyse, admin) mit Umsatz & Bearbeitungszeiten pro Mitarbeiter/Techniker; WhatsApp Floating-Button (wa.me Click-to-Chat, kein API-Key) mit Kommunikationsverlauf pro Auftrag; Techniker Accept/Reject-Buttons; Reparatur-Medien via Live-Kamera PFLICHT vor Status „Fertig"; strenge RBAC (Mitarbeiter nur eigene Filiale, Filialfeld read-only); Audit-Log aller Status-/Kosten-/Ersatzteil-/WhatsApp-Änderungen mit Zeitstempel & Bearbeiter; Bugfix: Bon/PDF-Datum dynamisch in Europe/Berlin (Auftragsdatum + Live-Druckdatum). Tested: 54/54 backend + full frontend E2E (iteration_3).

## Backlog / Remaining (P1/P2)
- P1: Email/SMS customer notification when repair ready.
- P1: PDF export of Abholschein (currently browser print).
- P2: Branch-level analytics charts (recharts).
- P2: Audit log view for admin (system-wide activity).
- P2: Inventory auto-decrement when parts used on an order.

## Next Tasks
- Gather feedback on order workflow; consider notifications and inventory-order linkage.

## Iteration 4 (2026-08-12) — Production feature pack (all preserved + added)
- **External Parts Procurement & Tracking** (`purchases.py` rewritten; was crashing): per-Auftrag CRUD with Part Name, external URL, order timestamp, expected/actual arrival, status (ANGEFRAGT→BESTELLT→UNTERWEGS→ANGEKOMMEN→EINGEBAUT/STORNIERT); ANGEKOMMEN auto-stamps arrival; admin alerts + audit; price hidden from Techniker. New `OrderPurchasesTab.jsx`.
- **Conditional IMEI**: IMEI mandatory unless "Gerät defekt / IMEI nicht lesbar" toggle; persistent reminder badge across Orders list + OrderDetail; `PATCH /orders/{id}/imei` late fill-in.
- **Digital Signatures + Legal Waiver**: canvas `SignaturePad.jsx`; intake signature at OrderCreate with German liability waiver (data loss / uncollected items / pre-existing damage); intake + pickup signatures on OrderDetail; both rendered on Abholschein print + PDF. `POST /orders/{id}/signature`.
- **Real-time Admin Notifications**: `notify.py` + `/notifications` (5s polling); `NotificationBell.jsx` with unread badge, toast, and Web Audio beep. Every Mitarbeiter/Techniker action (create/assign/accept/reject/status/costs/parts/media/whatsapp/imei/signature/procurement) notifies admin; admin's own actions excluded by design.
- **Strict Techniker Cost Privacy**: `serialize_order` strips cost/fees/estimated_price and used-part prices for role=techniker (cost_hidden=true); frontend hides cost section + prices; global search excludes customer_name for techniker.
- **Warranty Tracking**: warranty_months (default 6) → warranty_start/until set on ABGEHOLT; under_warranty + warranty_days_left computed; Garantie badges in list/detail/search.
- **Automated Status Notifications**: German auto-messages logged to communications on status change (WhatsApp-style, "System (automatisch)").
- **Global Search** (`/search`, `GlobalSearch.jsx`): by auftragsnummer / IMEI / phone (+name for non-techniker), role-scoped, in top bar.
- Tested: backend 48/48, frontend 5/5 across all 3 roles. No existing functionality removed.

## Iteration 5 (2026-08-13) — Verification pass + Invoice completion
- **Verified (testing_agent, iteration_5.json)** the previously-untested backlog: reassign-after-ABGELEHNT, i18n DE/EN/AR switcher, Global Procurement Dashboard (/beschaffung), Procurement Arrival Alerts on admin dashboard, GoBD per-branch invoice numbering (RE-YYYY-XXXX-##### idempotent), and dynamic branch branding.
- **Completed Invoice.jsx gaps** (were coded incompletely): invoice header now uses live branch data from GET /branches (name/address/phone/email/tax + optional logo), "Ort, Datum" auto-filled with branch city + invoice date (DD.MM.YYYY), embedded customer signature image (pickup/intake), and a real SECOND printable page + PDF page with the FULL extended AGB (§1–§8) and DSGVO (points 1–6). testids: invoice-shop-name, invoice-branch-address, invoice-logo, invoice-ort-datum, invoice-customer-signature, invoice-legal-page2, invoice-agb-full, invoice-dsgvo-full.
- **Bug fixed (HIGH, privacy)**: serialize_order now strips intake_signature/pickup_signature for role=techniker (were leaking base64 biometric PII). Verified via curl.
- Result: backend 9/9, frontend invoice UI 100%. No functionality removed.

## Iteration 6 (2026-08-15) — Comms + Device Lock + Reklamation + Terminology + Validation
- **Customer Communication (real + graceful fallback)**: new `messaging.py` (Twilio SMS+WhatsApp via `messages.create`, Resend email) with E.164 normalization; `GET /communication/status` + `POST /orders/{id}/notify` (logs to communications with channel+status, audit, notification). Channels return `not_configured` and still log until keys are added. New `CommunicationPanel.jsx` (3 channels, templates, email subject, not-configured hint). Twilio/Resend env keys added (empty) to backend/.env.
- **Device Lock modes**: `device_lock_type` (none/pattern/pin/password) + `device_passcode`. New `PatternLock.jsx` 3×3 drawer (drag + tap, dash-joined sequence) and `PatternDisplay` read-only viz on OrderDetail. PIN/Password use text inputs.
- **Terminology (UI only)**: 'Arbeitslohn'→'Arbeitskosten', 'Ersatzteilkosten'/'Ersatzteile'→'Materialkosten' in OrderCreate, OrderDetail, Invoice (PDF + HTML). DB keys labor_cost/parts_cost unchanged.
- **Strict validation**: OrderCreate `validate()` blocks save until branch, model, IMEI (conditional), issue, customer name+phone AND all three pricing fields are filled; inline errors + toast.
- **Reklamation**: `open-reklamation` button on ABGEHOLT orders → navigates to new-order with prefilled device+customer, pricing 0, reclamation banner; backend stores is_reclamation/reclamation_of/reclamation_of_number, adds REKLAMATION audit + notification; reclamation badges on list + detail.
- **Fertig view**: quick-filter tabs on Orders page incl. `filter-tab-fertig`.
- Bug fixed: notify endpoint `insert_one` mutated response dict with ObjectId (500) → popped `_id`. Verified.
- Tested: backend 12/12, frontend 40/42 (2 false-alarm assertions). No functionality removed.
- NOTE: Twilio + Resend keys are EMPTY in backend/.env; comms are logged but not delivered until the user adds credentials.

## Iteration 7 (2026-08-15) — Status/Terminology, Printing, QC Inspection, Activity, Reklamation, Nginx
- **Status label**: 'Angenommen' → **'Diagnose'** everywhere (key `ANGENOMMEN` unchanged) — DE/EN/AR + constants.
- **Komplett-Druck**: `ContractPrint.jsx` full contract (customer+device+Haftungsausschluss+AGB, signatures) via `open-contract` in OrderDetail; **quick-print** icon per row in Orders table (`quick-print-<nr>`, stopPropagation).
- **Technician QC inspection**: `InspectionForm.jsx` (Laden&Akku, Audio, Netzwerk, Sensoren, Tasten — each OK/Nicht OK/N.V.+note; Display-Typ, Akku-Gesundheit %, Notizen). Backend `POST /orders/{id}/inspection`; **FERTIG now gated** on inspection + repair media.
- **Global Activity feed**: `GET /activity` (admin) + `/aktivitaet` page + nav link.
- **Reklamation dashboard**: `GET /reklamationen` + `ReklamationPanel.jsx` on admin dashboard (is_reclamation OR under_warranty).
- **i18n**: expanded DE/EN/AR namespaces (inspection/print/reklamation/activity) + RTL for Arabic; new components fully trilingual.
- **Nginx SPA**: `/app/frontend/nginx.conf` with `try_files $uri /index.html` for deployment (fixes 404-on-refresh).
- Tested: backend 10/10, frontend 100%. 
- REMAINING i18n: legacy hardcoded-German admin screens (Inventory, Users, Analytics, Procurement) and many OrderDetail/OrderCreate body strings still need full EN/AR conversion — dedicated follow-up pass.

## Iteration 8 (2026-08-15) — Reklamation filter + Billing adjustments
- **Reklamation filter**: added a 'Reklamation' quick-tab beside ALLE/DIAGNOSE/IN BEARBEITUNG/FERTIG/ABGEHOLT and as an option in the 'Alle Status' dropdown; both load orders via `GET /reklamationen` (is_reclamation OR under_warranty).
- **Billing**: pricing is now OPTIONAL (removed mandatory validation) — Diagnosekosten & Versuchszeit filled after the repair attempt; 'Materialkosten' relabeled to **'Versuchszeit'** in OrderCreate, OrderDetail and Invoice; diagnosis field labeled 'Diagnosekosten'.
- **Payment status**: new `diagnosis_payment_status` (PAID/OPEN/NA = Bezahlt/Offen/Nicht zutreffend) on OrderCreate + editable on OrderDetail via `PATCH /orders/{id}/costs`; stored + serialized (default OPEN). Invalid value → 400.
- Verified: backend via curl (optional pricing create, payment PAID→OPEN patch, invalid 400); frontend via screenshots (Reklamation tab shows 15 items with DIAGNOSE labels; cost section shows optional Diagnosekosten/Versuchszeit + payment select).

## Iteration 9 (2026-08-16) — FULL app-wide i18n (EN/DE/AR) sweep + Arabic RTL
- **Complete multilingual coverage**: every user-facing screen now translates via the language switcher (localStorage `rb_lang`). Expanded `de/en/ar.json` with new namespaces: `dashboard, mad, oc, inv, usr, ana, proc, palerts, purch, scan, notif, comm, chat, wa, sig, cam, pstatus, toast` + extended `detail/costs/orders/login`.
- **Converted to i18n** (were hardcoded German): Dashboard, MitarbeiterDashboard, OrderCreate, Inventory, Users, Analytics, Procurement, Scan pages; NotificationBell, CommunicationPanel, ProcurementAlerts, OrderPurchasesTab, OrderChat, WhatsAppFab, SignaturePad, CameraCapture, PatternLock components; finished OrderDetail (remaining toasts, signature labels, warranty days, status-history labels, cost-status badge) and Orders (Alle tab + badge titles) and Login demo-accounts panel.
- **Constants labels** (STATUS_LABELS/ROLE_LABELS/PURCHASE_STATUS_LABELS) now resolved via `t('status.*' / 'roles.*' / 'pstatus.*')` at call sites; constants kept as fallback.
- **Arabic RTL**: verified `html[dir=rtl]` toggles and sidebar/layout mirror on Dashboard, Orders, OrderDetail.
- **Verified**: testing_agent iteration_8.json = frontend 100% (zero raw i18n keys, zero German leftovers on EN/AR across all pages, RTL confirmed). Backend untouched.
- **INTENTIONALLY kept German** (legal/business documents): printed Invoice.jsx, Abholschein.jsx, ContractPrint.jsx AGB/DSGVO text, and the on-screen LIABILITY_WAIVER body on OrderCreate (translating a binding liability waiver is a legal decision — pending user confirmation).

## Iteration 15 (2026-08-16) — Admin-only single-order deletion
- **Backend**: new `DELETE /api/orders/{order_id}` protected by `require_roles("admin")`. Deletes the order + cascades related records (purchases, chat_messages, communications, notifications, audit_log, files by order_id). Verified: mitarbeiter/technician → 403, no-token → 401, admin deletes (8→7) returning message+auftragsnummer, non-existent → 404.
- **Frontend**: admin-only "Auftrag löschen" button in the OrderDetail header (`delete-order-button`, gated by `user.role === "admin"` — hidden for mitarbeiter/technician). Opens a confirmation modal (`delete-order-modal`) showing the order number + irreversible warning; on confirm calls DELETE and navigates back to /auftraege. New `detail.delete*` i18n keys in DE/EN/AR.
- Verified via curl (security + cascade) and screenshot (admin sees button+modal; technician does not).

## Iteration 14 (2026-08-16) — Scoped reset, type-to-confirm, checklist "All OK"
- **Scoped admin reset**: `POST /api/admin/reset-test-data` now takes `ResetOptions {orders, counters, inventory}`. Only selected data is wiped (users/branches always kept; inventory only if chosen). Empty selection → 400. Dashboard DangerZone modal now has 3 checkboxes (orders on, counters on, inventory off by default). Verified: counters-only reset kept orders(8) & inventory(44); non-admin 403.
- **Type-to-confirm**: reset modal has a mandatory `reset-confirm-input`; the confirm button is disabled until the admin types exactly "LÖSCHEN" (verified wrong word stays disabled, correct enables). New `danger` i18n keys (scope labels + typeToConfirm) in DE/EN/AR.
- **Technician checklist "Alles i.O."**: prominent `insp-all-ok` button in InspectionForm marks all 12 items OK in one tap; items stay individually toggleable. New `inspection.allOk/allOkHint` keys. Verified: 12/12 items marked OK.

## Iteration 13 (2026-08-16) — Role/DSGVO refinements
- **Reset scope confirmed (item 1)**: `POST /api/admin/reset-test-data` already clears only operational/test data (orders, purchases, chat, communications, notifications, audit_log, files) + resets counters, while preserving core structures (users, branches, inventory). No change required — matches "fresh production launch, not total deletion."
- **Streamlined technician checklist (item 2)**: removed 6 granular items from `InspectionForm.jsx` CATEGORIES — speaker (Lautsprecher), bluetooth, gps, proximity (Näherungssensor), gyro (Gyroskop/Lage), housing (Gehäuse/Rahmen). Checklist reduced 18 → 12 items (charging 3, audio 2, network 2, sensors 2, buttons 3). Verified via screenshot (12 insp-item nodes).
- **Sticker/DSGVO isolation (item 3)**: the QR/order sticker button (`open-label`) is now gated to `canManage` (admin + mitarbeiter) only — technicians NO longer see it (verified). Technician OrderDetail already shows a DSGVO notice instead of customer data, and the on-page QR encodes only `auftragsnummer` (no PII/financials). Full data separation confirmed.

## Iteration 12 (2026-08-16) — Admin-only "Clear test data" (production launch)
- **Backend**: `POST /api/admin/reset-test-data` protected by `require_roles("admin")`. Wipes transactional collections (orders, purchases, chat_messages, communications, notifications, audit_log, files) and resets `counters` (order + invoice sequences). Master data (users, branches, inventory) preserved. Returns per-collection deleted counts + total.
- **Frontend**: admin-only `DangerZone` on the Dashboard (`Dashboard.jsx`), gated by `user?.role === "admin"` (hidden for mitarbeiter/technician). Red-styled card + `reset-test-data-button` → confirmation modal (`reset-confirm-modal`) with explicit irreversible warning before triggering; on success reloads the dashboard.
- **i18n**: new `danger` namespace in de/en/ar.
- **Verified**: curl — mitarbeiter/technician → 403, no-token → 401, admin → 200 (deleted 480 docs, counters reset, orders→0), backend restart re-seeds demo data (seed is empty-guarded). Screenshot — admin sees Danger Zone + modal; technician does not.

## Iteration 11 (2026-08-16) — Tech workflow, real-time alerts, QR labels, legal
- **Technician status flow (strict technical phases)**: new status `WARTEN_FREIGABE` ("Nach Diagnose / Freigabe"). Techs get a dedicated `tech-status-select` with exactly Diagnose → Nach Diagnose/Freigabe → In Bearbeitung → Fertig. Backend `TECH_ALLOWED_STATUS` blocks administrative/final states — tech setting ABGEHOLT → 403 (verified), WARTEN_FREIGABE → 200. Admin manual dropdown also gained WARTEN_FREIGABE. Added customer auto-message for WARTEN_FREIGABE.
- **Real-time notifications to Reception + Admin**: `/notifications` (list/read/clear) now allow admin + mitarbeiter; reception is **branch-scoped** via `_notif_scope_ids` (order_id ∈ their branch). FERTIG produces a distinct alert ("✓ Reparatur fertig – abholbereit", kind=FERTIG). NotificationBell now mounts for reception in Layout; it already has 5s polling, a Web-Audio "ding", unread badge, and click-to-open order. Verified: reception unread scoped (3) vs admin (4).
- **Technician detail declutter**: costs + customer PII already hidden (DSGVO note); view focuses on device/fault, parts, condition media, repair docs, QR, history.
- **Legal**: added a **Wasser-/Feuchtigkeitsschutz** clause to the shared `LIABILITY_WAIVER` (rendered in the comprehensive ContractPrint). Abholschein pickup slip now shows the shop-protection clauses as 5 **centered bullet points** (`WAIVER_BULLETS`) in both the on-screen slip and the jsPDF export.
- **QR/barcode sticker**: new `LabelPrint.jsx` — compact 50×30mm adhesive label (order code + QR via qrcode.react, brand/model, no customer info) with an `Etikett` button in Order Detail for techs & reception + a dedicated `#geraete-label` print rule.
- **Verified**: testing_agent iteration_9.json → backend 100% (6/6), frontend 100%. NOTE: stack is FastAPI + MongoDB (user referenced Node/PostgreSQL — implemented natively, no migration). Invoice.jsx already uses live branch branding (no placeholder text); the full Haftungsausschluss lives in ContractPrint.

## Iteration 10 (2026-08-16) — Orders quick-print visibility + strict OrderCreate validation
- **Quick Print (Orders.jsx)**: the row-level ContractPrint trigger is now a clearly labeled, prominent accent button (`Printer` icon + `t("common.print")`) with a new "Aktion"/Action column header. Visible for admin & mitarbeiter on every order row; opens the full contract (Vertrag) modal directly from the table. Verified: 63 buttons visible, modal opens with customer/device/AGB/signatures.
- **Strict validation (OrderCreate.jsx)**: added `noValidate` to the form so our JS `validate()` is the single authoritative gate (was previously short-circuited by native one-at-a-time browser tooltips). Now blocks submit until device model, fault description, customer name and phone (+ IMEI or 'not readable', + lock value when a lock type is chosen) are filled — shows ALL inline errors at once, a toast, and auto-scrolls/focuses the first missing field. For a **Reklamation**, a fault description left as only the auto-prefix ("Reklamation zu {nr}:") is also rejected. Verified via screenshot: empty submit blocked, 5 inline errors + toast shown.

