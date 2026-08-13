export const ROLE_LABELS = {
  admin: "Administrator",
  mitarbeiter: "Mitarbeiter",
  techniker: "Techniker",
};

export const STATUS_LABELS = {
  ANGENOMMEN: "Angenommen",
  ZUGEWIESEN: "Zugewiesen",
  AKZEPTIERT: "Akzeptiert",
  IN_BEARBEITUNG: "In Bearbeitung",
  WARTEN_ERSATZTEIL: "Warten auf Ersatzteil",
  FERTIG: "Fertig",
  ABGEHOLT: "Abgeholt",
  ABGELEHNT: "Abgelehnt",
};

// tailwind classes for status badges
export const STATUS_STYLES = {
  ANGENOMMEN: "bg-zinc-800 text-zinc-200 border-zinc-600",
  ZUGEWIESEN: "bg-blue-950 text-blue-300 border-blue-700",
  AKZEPTIERT: "bg-indigo-950 text-indigo-300 border-indigo-700",
  IN_BEARBEITUNG: "bg-amber-950 text-amber-300 border-amber-600",
  WARTEN_ERSATZTEIL: "bg-orange-950 text-orange-300 border-orange-600",
  FERTIG: "bg-emerald-950 text-emerald-300 border-emerald-600",
  ABGEHOLT: "bg-zinc-900 text-zinc-400 border-zinc-700",
  ABGELEHNT: "bg-red-950 text-red-300 border-red-700",
};

export const COST_STATUS_LABELS = {
  WARTET: "Wartet auf Freigabe",
  BESTAETIGT: "Bestätigt",
  ABGELEHNT: "Abgelehnt",
};

export const COST_STATUS_STYLES = {
  WARTET: "bg-amber-950 text-amber-300 border-amber-600",
  BESTAETIGT: "bg-emerald-950 text-emerald-300 border-emerald-600",
  ABGELEHNT: "bg-red-950 text-red-300 border-red-700",
};

export const DEVICE_BRANDS = ["Apple", "Samsung", "Google", "Xiaomi", "Huawei", "OnePlus", "Sonstige"];

// ===== External parts procurement =====
export const PURCHASE_STATUS_LABELS = {
  ANGEFRAGT: "Angefragt",
  BESTELLT: "Bestellt",
  UNTERWEGS: "Unterwegs",
  ANGEKOMMEN: "Angekommen",
  EINGEBAUT: "Eingebaut",
  STORNIERT: "Storniert",
};

export const PURCHASE_STATUS_STYLES = {
  ANGEFRAGT: "bg-zinc-800 text-zinc-200 border-zinc-600",
  BESTELLT: "bg-blue-950 text-blue-300 border-blue-700",
  UNTERWEGS: "bg-amber-950 text-amber-300 border-amber-600",
  ANGEKOMMEN: "bg-emerald-950 text-emerald-300 border-emerald-600",
  EINGEBAUT: "bg-indigo-950 text-indigo-300 border-indigo-700",
  STORNIERT: "bg-red-950 text-red-300 border-red-700",
};

export const PURCHASE_STATUS_ORDER = [
  "ANGEFRAGT", "BESTELLT", "UNTERWEGS", "ANGEKOMMEN", "EINGEBAUT", "STORNIERT",
];

// ===== Legal liability waiver (shown below the intake signature) =====
export const LIABILITY_WAIVER = `Haftungsausschluss & Einverständniserklärung:

1. Datenverlust: Der Kunde wurde darauf hingewiesen, seine Daten vor der Reparatur zu sichern. Die Werkstatt übernimmt keinerlei Haftung für den Verlust von Daten (Kontakte, Fotos, Apps etc.) während oder infolge der Reparatur.

2. Nicht abgeholte Geräte: Reparierte oder nicht reparierbare Geräte, die nicht innerhalb von 90 Tagen nach Benachrichtigung abgeholt werden, können kostenpflichtig eingelagert, verwertet oder entsorgt werden.

3. Vorschäden: Der Kunde bestätigt, dass bereits bestehende (Vor-)Schäden (z. B. Wasserschaden, Sturzschäden, Vorreparaturen) den Reparaturerfolg beeinträchtigen können. Für Folgeschäden, die auf solche Vorschäden zurückzuführen sind, wird keine Haftung übernommen.

4. Mit meiner Unterschrift bestätige ich, das Gerät zur Reparatur übergeben sowie die obenstehenden Bedingungen gelesen und akzeptiert zu haben.`;

export const PICKUP_WAIVER = `Übernahmebestätigung:

Mit meiner Unterschrift bestätige ich den Erhalt des oben genannten Geräts in ordnungsgemäßem Zustand. Die durchgeführten Arbeiten wurden mir erläutert und der Endbetrag wurde beglichen bzw. anerkannt.`;

// ===== Invoice (Rechnung) configuration =====
export const SHOP_INFO = {
  name: "Reparatur Berlin GmbH",
  addressLine1: "Musterstraße 12",
  addressLine2: "10115 Berlin",
  phone: "+49 30 1234567",
  email: "info@reparatur-berlin.de",
  taxNumber: "USt-IdNr.: DE123456789",
  steuernummer: "Steuernr.: 30/123/45678",
  website: "www.reparatur-berlin.de",
};

export const INVOICE_WARRANTY = `Gewährleistung: Auf durchgeführte Reparaturen gewähren wir 6 Monate Gewährleistung gemäß den gesetzlichen Bestimmungen. Ausgenommen sind Folgeschäden durch unsachgemäße Behandlung, Sturz- oder Feuchtigkeitsschäden sowie Verschleißteile. Für Datenverluste wird keine Haftung übernommen (Datensicherung ist Sache des Kunden).

Der Rechnungsbetrag wurde bei Abholung vollständig beglichen. Vielen Dank für Ihren Auftrag!`;


