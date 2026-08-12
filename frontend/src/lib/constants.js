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
