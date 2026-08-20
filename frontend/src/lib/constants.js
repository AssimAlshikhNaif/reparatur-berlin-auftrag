export const ROLE_LABELS = {
  admin: "Administrator",
  mitarbeiter: "Mitarbeiter",
  techniker: "Techniker",
};

export const STATUS_LABELS = {
  ANGENOMMEN: "Diagnose",
  ZUGEWIESEN: "Zugewiesen",
  AKZEPTIERT: "Akzeptiert",
  WARTEN_FREIGABE: "Nach Diagnose / Freigabe",
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
  WARTEN_FREIGABE: "bg-purple-950 text-purple-300 border-purple-600",
  IN_BEARBEITUNG: "bg-amber-950 text-amber-300 border-amber-600",
  WARTEN_ERSATZTEIL: "bg-orange-950 text-orange-300 border-orange-600",
  FERTIG: "bg-emerald-950 text-emerald-300 border-emerald-600",
  ABGEHOLT: "bg-zinc-900 text-zinc-400 border-zinc-700",
  ABGELEHNT: "bg-red-950 text-red-300 border-red-700",
};

// Technician technical-phase flow (exact order shown in the tech status control)
export const TECH_STATUS_FLOW = ["ANGENOMMEN", "WARTEN_FREIGABE", "IN_BEARBEITUNG", "FERTIG"];

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

// Diagnosegebühr payment status
export const PAYMENT_STATUS_LABELS = {
  PAID: "Bezahlt",
  OPEN: "Offen",
  NA: "Nicht zutreffend",
};
export const PAYMENT_STATUS_STYLES = {
  PAID: "bg-emerald-950 text-emerald-300 border-emerald-600",
  OPEN: "bg-amber-950 text-amber-300 border-amber-600",
  NA: "bg-zinc-900 text-zinc-300 border-zinc-600",
};

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
export const LIABILITY_WAIVER = "Haftungsausschluss & Einverständniserklärung: \n" +

"1. Datenverlust: Der Kunde wurde darauf hingewiesen, seine Daten vor der Reparatur zu sichern. Die Werkstatt übernimmt keinerlei Haftung für den Verlust von Daten (Kontakte, Fotos, Apps etc.) während oder infolge der Reparatur.\n" +

"2. Nicht abgeholte Geräte: Reparierte oder nicht reparierbare Geräte, die nicht innerhalb von 90 Tagen nach Benachrichtigung abgeholt werden, werden kostenpflichtig eingelagert. Für die Lagerung berechnen wir eine Gebühr von 1,50 € pro Tag. Sobald die aufgelaufenen Lagerkosten den wirtschaftlichen Wert des Gerätes erreichen, wird das Gerät verkauft.\n" +

"3. Vorschäden: Der Kunde bestätigt, dass bereits bestehende (Vor-)Schäden (z. B. Wasserschaden, Sturzschäden, Vorreparaturen) den Reparaturerfolg beeinträchtigen können. Für Folgeschäden, die auf solche Vorschäden zurückzuführen sind, wird keine Haftung übernommen.\n" +

"4. Wasser und Feuchtigkeit: Generell raten wir nach der Reparatur dringend davon ab, das Gerät mit Wasser in Berührung zu bringen. Durch das Öffnen des Gerätes und die von uns verwendeten Kleber kann nicht mehr sichergestellt werden, dass das Gerät weiterhin wasserdicht ist. Für Schäden, die nach der Reparatur durch Wasser, Feuchtigkeit oder andere Flüssigkeiten entstehen, übernehmen wir keine Haftung.\n" +

"5. Bestätigung: Mit meiner Unterschrift bestätige ich, das Gerät zur Reparatur übergeben sowie die obenstehenden Bedingungen gelesen und akzeptiert zu haben.";

// Concise shop-protection bullet points for the compact Abholschein (pickup slip)
export const WAIVER_BULLETS = [
  "Datenverlust: Keine Haftung – Datensicherung ist Sache des Kunden.",
  "Nicht abgeholte Geräte: Kostenpflichtige Lagerung (1,50 €/Tag) nach 90 Tagen; Verkauf bei Erreichen des Gerätewerts.",
  "Vorschäden: Keine Haftung für Folgen bestehender Wasser-/Sturzschäden.",
  "Wasser und Feuchtigkeit: Nach der Reparatur kann die Wasserdichtigkeit nicht mehr garantiert werden – keine Haftung für Folgeschäden.",
  "Bestätigung: Mit Unterschrift Geräteübergabe & Bedingungen akzeptiert.",
];

export const PICKUP_WAIVER = `Übernahmebestätigung:

Mit meiner Unterschrift bestätige ich den Erhalt des oben genannten Geräts in ordnungsgemäßem Zustand. Die durchgeführten Arbeiten wurden mir erläutert und der Endbetrag wurde beglichen bzw. anerkannt.`;

// ===== Invoice (Rechnung) configuration =====
export const SHOP_INFO = {
  name: "smartphone Apotheke",
  addressLine1: "Frankfurter Alle 95 ",
  addressLine2: "10247 Berlin",
  phone: "+49 177 9777771",
  email: "info@smartphone-apotheke.de",
  taxNumber: "USt-IdNr.: DE355296654",
  steuernummer: "Steuernr.: 30/123/45678",
  website: "www.smartphone-apotheke.de",
};


export const INVOICE_WARRANTY = `Gewährleistung: Auf durchgeführte Reparaturen gewähren wir 6 Monate Gewährleistung gemäß den gesetzlichen Bestimmungen. Ausgenommen sind Folgeschäden durch unsachgemäße Behandlung, Sturz- oder Feuchtigkeitsschäden sowie Verschleißteile. Für Datenverluste wird keine Haftung übernommen (Datensicherung ist Sache des Kunden).

Der Rechnungsbetrag wurde bei Abholung vollständig beglichen. Vielen Dank für Ihren Auftrag!`;

export const AGB_TEXT = `AGB (Auszug): Es gelten unsere Allgemeinen Geschäftsbedingungen. Nicht abgeholte Geräte werden nach 90 Tagen kostenpflichtig eingelagert (1,50 € pro Tag); bei Erreichen des Gerätewerts wird das Gerät verkauft. Kostenvoranschläge sind unverbindlich; Mehrkosten werden vor Ausführung abgestimmt.`;

export const DSGVO_CONSENT = `Datenschutz (DSGVO): Ihre personenbezogenen Daten werden ausschließlich zur Auftragsabwicklung gemäß Art. 6 Abs. 1 lit. b DSGVO verarbeitet und nicht an Dritte weitergegeben. Mit Ihrer Unterschrift willigen Sie in die Verarbeitung dieser Daten zum Zweck der Reparaturabwicklung ein.`;

export const AGB_FULL = `Allgemeine Geschäftsbedingungen (AGB)

§1 Geltungsbereich: Diese AGB gelten für alle Reparaturaufträge zwischen dem Kunden und der Werkstatt.

§2 Kostenvoranschlag: Kostenvoranschläge sind unverbindlich. Ergeben sich während der Reparatur Mehrkosten, werden diese vor Ausführung mit dem Kunden abgestimmt.

§3 Datensicherung: Der Kunde ist für die Sicherung seiner Daten selbst verantwortlich. Für den Verlust von Daten wird keine Haftung übernommen.

§4 Gewährleistung: Auf durchgeführte Arbeiten gewähren wir 6 Monate Gewährleistung. Ausgenommen sind Verschleiß, Sturz- und Feuchtigkeitsschäden sowie Folgeschäden bestehender Vorschäden.

§5 Abholung & Lagerung: Nicht innerhalb von 90 Tagen nach Benachrichtigung abgeholte Geräte werden kostenpflichtig eingelagert. Für die Lagerung berechnen wir eine Gebühr von 1,50 € pro Tag. Sobald die aufgelaufenen Lagerkosten den wirtschaftlichen Wert des Gerätes erreichen, wird das Gerät verkauft.

§6 Eigentumsvorbehalt: Bis zur vollständigen Bezahlung bleibt das reparierte Gerät bzw. verbaute Ersatzteile Eigentum der Werkstatt.

§7 Zahlung: Der Rechnungsbetrag ist bei Abholung sofort und ohne Abzug fällig.

§8 Gerichtsstand: Es gilt deutsches Recht; Gerichtsstand ist Berlin, soweit gesetzlich zulässig.`;

export const DSGVO_FULL = `Datenschutzerklärung (DSGVO)

1. Verantwortlicher: Die im Kopf dieser Rechnung genannte Filiale ist verantwortliche Stelle im Sinne der DSGVO.

2. Zwecke der Verarbeitung: Wir verarbeiten personenbezogene Daten (Name, Kontaktdaten, Geräte-/IMEI-Daten) ausschließlich zur Durchführung des Reparaturauftrags gemäß Art. 6 Abs. 1 lit. b DSGVO sowie zur Erfüllung gesetzlicher Aufbewahrungspflichten (Art. 6 Abs. 1 lit. c DSGVO).

3. Speicherdauer: Auftrags- und Rechnungsdaten werden gemäß den handels- und steuerrechtlichen Fristen (GoBD/AO/HGB) für bis zu 10 Jahre aufbewahrt.

4. Weitergabe: Eine Weitergabe an Dritte erfolgt nur, soweit dies zur Auftragsabwicklung (z.B. Ersatzteilbestellung) erforderlich oder gesetzlich vorgeschrieben ist.

5. Ihre Rechte: Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit sowie Widerspruch. Beschwerden können Sie bei der zuständigen Aufsichtsbehörde einreichen.

6. Einwilligung: Mit Ihrer Unterschrift bestätigen Sie die Kenntnisnahme dieser Datenschutzhinweise.`;




