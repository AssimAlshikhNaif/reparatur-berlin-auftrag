import { useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { toast } from "sonner";
import { ClipboardText, CheckCircle, XCircle, MinusCircle, FloppyDisk, SpinnerGap } from "@phosphor-icons/react";

const CATEGORIES = [
  { key: "charging", items: ["charge_port", "battery", "wireless_charge"] },
  { key: "audio", items: ["earpiece", "mic"] },
  { key: "network", items: ["wifi", "mobile"] },
  { key: "sensors", items: ["fingerprint", "faceid"] },
  { key: "buttons", items: ["power_btn", "volume_btn", "cameras"] },
];
const DISPLAY_TYPES = ["Original", "In-Cell", "OLED", "Service-Pack"];
const STATUSES = [
  { v: "OK", labelKey: "statusOK", cls: "border-emerald-600 text-emerald-300 bg-emerald-950", icon: CheckCircle },
  { v: "NOK", labelKey: "statusNOK", cls: "border-red-600 text-red-300 bg-red-950", icon: XCircle },
  { v: "NV", labelKey: "statusNV", cls: "border-zinc-600 text-zinc-300 bg-zinc-900", icon: MinusCircle },
];

export default function InspectionForm({ order, readOnly = false, onSaved }) {
  const { t } = useTranslation();
  const existing = order.inspection || {};
  const [checklist, setChecklist] = useState(existing.checklist || {});
  const [displayType, setDisplayType] = useState(existing.display_type || "");
  const [batteryHealth, setBatteryHealth] = useState(existing.battery_health || "");
  const [notes, setNotes] = useState(existing.notes || "");
  const [busy, setBusy] = useState(false);

  const setStatus = (item, v) => setChecklist((c) => ({ ...c, [item]: { ...(c[item] || {}), status: v } }));
  const setNote = (item, note) => setChecklist((c) => ({ ...c, [item]: { ...(c[item] || {}), note } }));

  const save = async () => {
    setBusy(true);
    try {
      await api.post(`/orders/${order.id}/inspection`, {
        checklist, display_type: displayType, battery_health: batteryHealth, notes,
      });
      toast.success(t("inspection.saved"));
      onSaved && onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Fehler");
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="inspection-form" className="space-y-5">
      {CATEGORIES.map((cat) => (
        <div key={cat.key}>
          <div className="text-[11px] font-mono uppercase tracking-wider text-accent mb-2">{t(`inspection.cat.${cat.key}`)}</div>
          <div className="space-y-2">
            {cat.items.map((item) => {
              const cur = checklist[item] || {};
              return (
                <div key={item} data-testid={`insp-item-${item}`} className="flex flex-col sm:flex-row sm:items-center gap-2 border border-border/60 rounded-lg px-3 py-2">
                  <span className="text-sm text-foreground/90 flex-1">{t(`inspection.item.${item}`)}</span>
                  <div className="flex items-center gap-1.5">
                    {STATUSES.map((s) => {
                      const active = cur.status === s.v;
                      const Icon = s.icon;
                      return (
                        <button key={s.v} type="button" disabled={readOnly}
                          data-testid={`insp-${item}-${s.v}`}
                          onClick={() => setStatus(item, s.v)}
                          className={`flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded border transition-colors ${active ? s.cls : "border-border text-muted-foreground hover:text-foreground"} ${readOnly ? "cursor-default" : ""}`}>
                          <Icon size={12} weight={active ? "fill" : "regular"} /> {t(`inspection.${s.labelKey}`)}
                        </button>
                      );
                    })}
                  </div>
                  {!readOnly && (
                    <input data-testid={`insp-note-${item}`} value={cur.note || ""} onChange={(e) => setNote(item, e.target.value)}
                      placeholder={t("inspection.notePlaceholder")}
                      className="sm:w-40 bg-background border border-border px-2 py-1 text-xs rounded outline-none focus:border-accent" />
                  )}
                  {readOnly && cur.note ? <span className="sm:w-40 text-xs text-muted-foreground truncate">{cur.note}</span> : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{t("inspection.displayType")}</label>
          <select data-testid="insp-display-type" value={displayType} disabled={readOnly} onChange={(e) => setDisplayType(e.target.value)}
            className="w-full bg-background border border-border px-2 py-2 text-sm rounded-lg outline-none focus:border-accent">
            <option value="">—</option>
            {DISPLAY_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{t("inspection.batteryHealth")}</label>
          <input data-testid="insp-battery-health" type="number" min="0" max="100" value={batteryHealth} disabled={readOnly}
            onChange={(e) => setBatteryHealth(e.target.value)} placeholder="z.B. 89"
            className="w-full bg-background border border-border px-2 py-2 text-sm rounded-lg outline-none focus:border-accent font-mono" />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{t("inspection.notes")}</label>
        <textarea data-testid="insp-notes" value={notes} disabled={readOnly} onChange={(e) => setNotes(e.target.value)} rows={2}
          placeholder={t("inspection.notesPlaceholder")}
          className="w-full bg-background border border-border px-3 py-2 text-sm rounded-lg outline-none focus:border-accent" />
      </div>

      {!readOnly && (
        <button data-testid="insp-save" onClick={save} disabled={busy}
          className="flex items-center gap-2 bg-primary text-primary-foreground font-head font-semibold text-sm uppercase tracking-wider px-5 py-2.5 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50">
          {busy ? <SpinnerGap size={16} className="animate-spin" /> : <FloppyDisk size={16} />} {t("inspection.save")}
        </button>
      )}
    </div>
  );
}
