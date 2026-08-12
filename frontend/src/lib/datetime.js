// Alle Datums-/Zeitangaben werden dynamisch in der Zeitzone Europe/Berlin erzeugt.
export function berlinDateTime(iso) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function berlinDate(iso) {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" });
}

export function berlinNow() {
  return berlinDateTime();
}
