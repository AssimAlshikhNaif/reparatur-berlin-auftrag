# Laga Electronics Management System (LEMS)

Ein integriertes System zur Verwaltung von Reparaturen, Lagerbeständen und Kundenaufträgen, speziell entwickelt für Laga Elektronik. Das System nutzt eine robuste Python-basierte Backend-Architektur, eine MongoDB-Datenbank und ein reaktionsschnelles React-Frontend.

## 🚀 Hauptfunktionen

- **Filialverwaltung:** Rollenbasierte Verwaltung für fünf Standorte.
- **Auftragsverfolgung (Tracking):** Statusverfolgung von der Annahme bis zur Übergabe (inklusive Gerätekennung und Passcodes).
- **Lagerverwaltung:** Automatische Bestandsführung für Ersatzteile mit dedizierten Endpunkten zur Bestandsaktualisierung.
- **Finanzielle Transparenz:** Automatisierte Kostenkalkulation.
- **Visuelle Dokumentation:** Integration von Kamera-Capturing für den Gerätezustand.
- **Kommunikation:** Direkte WhatsApp-Integration für Kunden.
- **Audit-Log:** Nachvollziehbarer Verlauf aller Vorgänge pro Auftrag.

## 🛠 Tech-Stack

- **Backend:** Python (FastAPI / Flask / Express-like setup), MongoDB.
- **Frontend:** React, Tailwind CSS, Phosphor Icons, React Router.
- **Deployment:** Hetzner Cloud.

## ⚙️ Installation & Einrichtung

### Voraussetzungen

- Python (v3.9+)
- Node.js (v18+)
- MongoDB (lokal oder Cloud Cluster wie MongoDB Atlas)

### Backend einrichten

1. **Verzeichnis wechseln:**

   ```bash
   cd backend

   ```

   1- Virtuelle Umgebung erstellen und Abhängigkeiten installieren:
   python -m venv venv
   source venv/bin/activate # Windows: venv\Scripts\activate
   pip install -r requirements.txt

2-
Server starten:
python server.py
3-
Frontend einrichten
Verzeichnis wechseln:
cd ../frontend
Abhängigkeiten installieren:
npm install
Frontend starten:
npm run dev
Auftrags-LifecycleAnnahme:
Erfassung von IMEI, Kundendaten und Geräte-Passcode.Zuweisung:
Techniker-Zuweisung pro Auftrag.Diagnose & Reparatur:
Dokumentation mit Fotos und Ersatzteilverbrauch.Übergabe: Finalisierung und Abschluss des Auftrags.🔒 BenutzerrollenRolleZuständigkeitAdminVollzugriff, Systemkonfiguration.MitarbeiterAuftragsmanagement, Kundenkontakt.TechnikerTechnische Reparatur, Fotodokumentation.
