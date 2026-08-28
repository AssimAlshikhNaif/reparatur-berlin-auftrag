import { useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { toast } from "sonner";
import { ClipboardText, CheckCircle, XCircle, MinusCircle, FloppyDisk, SpinnerGap, CaretDown, CaretUp } from "@phosphor-icons/react";

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

export default function InspectionForm({ order, readOnly: externalReadOnly = false, onSaved, inspectionType = "end" }) {
  const { t } = useTranslation();
  
  const existing = inspectionType === "intake" ? (order.intake_inspection || {}) : (order.inspection || {});
  const hasSavedData = Boolean(existing.checklist && Object.keys(existing.checklist).length > 0);
  const isReadOnly = externalReadOnly || hasSavedData;
  
  const [checklist, setChecklist] = useState(existing.checklist || {});
  const [displayType, setDisplayType] = useState(existing.display_type || "");
  const [batteryHealth, setBatteryHealth] = useState(existing.battery_health || "");
  const [notes, setNotes] = useState(existing.notes || "");
  const [busy, setBusy] = useState(false);

  // حالة فتح وإغلاق الأقسام (افتراضياً القسم الأول مفتوح وباقي الأقسام مغلقة لتوفير مساحة على الهاتف)
  const [openSections, setOpenSections] = useState({
    charging: true,
    audio: false,
    network: false,
    sensors: false,
    buttons: false,
  });

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const setStatus = (item, v) => setChecklist((c) => ({ ...c, [item]: { ...(c[item] || {}), status: v } }));
  const setNote = (item, note) => setChecklist((c) => ({ ...c, [item]: { ...(c[item] || {}), note } }));

  const markAllOk = () => setChecklist((c) => {
    const next = { ...c };
    CATEGORIES.forEach((cat) => cat.items.forEach((item) => {
      next[item] = { ...(next[item] || {}), status: "OK" };
    }));
    return next;
  });
  const allItems = CATEGORIES.flatMap((cat) => cat.items);
  const allAreOk = allItems.every((item) => checklist[item]?.status === "OK");

  const save = async () => {
    setBusy(true);
    try {
      await api.post(`/orders/${order.id}/inspection`, {
        checklist, 
        display_type: displayType, 
        battery_health: batteryHealth, 
        notes,
        inspection_type: inspectionType 
      });
      toast.success(t("inspection.saved"));
      onSaved && onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Fehler");
    } finally { setBusy(false); }
  };

  return (
    <div data-testid={`inspection-form-${inspectionType}`} className="space-y-4">
      {!isReadOnly && (
        <div className="flex items-center justify-between gap-3 border border-emerald-800/50 bg-emerald-950/20 rounded-lg px-3 py-2.5">
          <span className="text-xs text-emerald-200/90">{t("inspection.allOkHint")}</span>
          <button type="button" data-testid={`insp-all-ok-${inspectionType}`} onClick={markAllOk}
            className={`flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider px-4 py-2 rounded-lg border transition-colors ${allAreOk ? "border-emerald-600 bg-emerald-700 text-white" : "border-emerald-600 text-emerald-300 hover:bg-emerald-700 hover:text-white"}`}>
            <CheckCircle size={15} weight="fill" /> {t("inspection.allOk")}
          </button>
        </div>
      )}

      {/* الأقسام بنظام القوائم المنسدلة (Accordions) */}
      <div className="space-y-2.5">
        {CATEGORIES.map((cat) => {
          const isOpen = openSections[cat.key];
          // حساب كم عنصر تم فحصه أو كم عنصر إجمالي في القسم
          const checkedCount = cat.items.filter(item => checklist[item]?.status).length;

          return (
            <div key={cat.key} className="border border-border/70 rounded-xl overflow-hidden bg-card/40">
              {/* زر عنوان القسم */}
              <button
                type="button"
                onClick={() => toggleSection(cat.key)}
                className="w-full px-4 py-3 flex items-center justify-between bg-muted/30 hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-accent">
                    {t(`inspection.cat.${cat.key}`)}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-background border border-border text-muted-foreground font-mono">
                    {checkedCount}/{cat.items.length}
                  </span>
                </div>
                {isOpen ? <CaretUp size={16} className="text-muted-foreground" /> : <CaretDown size={16} className="text-muted-foreground" />}
              </button>

              {/* محتوى القسم يظهر عند فتحه فقط */}
              {isOpen && (
                <div className="p-3 space-y-2 border-t border-border/50 bg-background/20">
                  {cat.items.map((item) => {
                    const cur = checklist[item] || {};
                    return (
                      <div key={item} data-testid={`insp-item-${inspectionType}-${item}`} className="flex flex-col sm:flex-row sm:items-center gap-2 border border-border/50 rounded-lg px-3 py-2 bg-background">
                        <span className="text-sm text-foreground/90 flex-1">{t(`inspection.item.${item}`)}</span>
                        <div className="flex items-center gap-1.5">
                          {STATUSES.map((s) => {
                            const active = cur.status === s.v;
                            const Icon = s.icon;
                            return (
                              <button key={s.v} type="button" disabled={isReadOnly}
                                data-testid={`insp-${inspectionType}-${item}-${s.v}`}
                                onClick={() => setStatus(item, s.v)}
                                className={`flex items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded border transition-colors ${active ? s.cls : "border-border text-muted-foreground hover:text-foreground"} ${isReadOnly ? "cursor-default" : ""}`}>
                                <Icon size={12} weight={active ? "fill" : "regular"} /> {t(`inspection.${s.labelKey}`)}
                              </button>
                            );
                          })}
                        </div>
                        {!isReadOnly && (
                          <input data-testid={`insp-note-${inspectionType}-${item}`} value={cur.note || ""} onChange={(e) => setNote(item, e.target.value)}
                            placeholder={t("inspection.notePlaceholder")}
                            className="sm:w-36 bg-background border border-border px-2 py-1 text-xs rounded outline-none focus:border-accent" />
                        )}
                        {isReadOnly && cur.note ? <span className="sm:w-36 text-xs text-muted-foreground truncate">{cur.note}</span> : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{t("inspection.displayType")}</label>
          <select data-testid={`insp-display-type-${inspectionType}`} value={displayType} disabled={isReadOnly} onChange={(e) => setDisplayType(e.target.value)}
            className="w-full bg-background border border-border px-2 py-2 text-sm rounded-lg outline-none focus:border-accent">
            <option value="">—</option>
            {DISPLAY_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{t("inspection.batteryHealth")}</label>
          <input data-testid={`insp-battery-health-${inspectionType}`} type="number" min="0" max="100" value={batteryHealth} disabled={isReadOnly}
            onChange={(e) => setBatteryHealth(e.target.value)} placeholder="z.B. 89"
            className="w-full bg-background border border-border px-2 py-2 text-sm rounded-lg outline-none focus:border-accent font-mono" />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{t("inspection.notes")}</label>
        <textarea data-testid={`insp-notes-${inspectionType}`} value={notes} disabled={isReadOnly} onChange={(e) => setNotes(e.target.value)} rows={2}
          placeholder={t("inspection.notesPlaceholder")}
          className="w-full bg-background border border-border px-3 py-2 text-sm rounded-lg outline-none focus:border-accent" />
      </div>

      {!isReadOnly && (
        <button data-testid={`insp-save-${inspectionType}`} onClick={save} disabled={busy}
          className="flex items-center gap-2 bg-primary text-primary-foreground font-head font-semibold text-sm uppercase tracking-wider px-5 py-2.5 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50">
          {busy ? <SpinnerGap size={16} className="animate-spin" /> : <FloppyDisk size={16} />} {t("inspection.save")}
        </button>
      )}
    </div>
  );
}