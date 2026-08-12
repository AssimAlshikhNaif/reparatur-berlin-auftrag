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
