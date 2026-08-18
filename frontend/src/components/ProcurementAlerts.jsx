import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { toast } from "sonner";
import { Truck, Warning, Clock, ArrowSquareOut } from "@phosphor-icons/react";
import { PURCHASE_STATUS_LABELS, PURCHASE_STATUS_ORDER } from "@/lib/constants";
import { berlinDateTime } from "@/lib/datetime";

/**
 * Live "Parts Due Today / Overdue" procurement alert list.
 * Shows external parts whose expected arrival is today or in the past and that
 * have not yet arrived, with a quick inline status update.
 */
export default function ProcurementAlerts({ compact = false }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/purchases/alerts");
      setItems(data);
    } catch (e) {
      // techniker or error -> just render nothing
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30000); // live refresh every 30s
    return () => clearInterval(iv);
  }, [load]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/purchases/${id}`, { status });
      toast.success(t("toast.statusUpdated"));
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || t("toast.updateError"));
    }
  };

  if (loading || items.length === 0) return null;

  const overdue = items.filter((i) => i.due_category === "OVERDUE").length;
  const today = items.filter((i) => i.due_category === "TODAY").length;

  return (
    <div className="px-6 md:px-8">
      <div data-testid="procurement-alerts" className="border border-amber-800/60 bg-amber-950/15 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-amber-800/40 bg-amber-950/25">
          <div className="flex items-center gap-2">
            <Truck size={18} className="text-amber-400" />
            <h2 className="font-head font-semibold text-sm tracking-tight text-amber-100">{t("palerts.title")}</h2>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
            {overdue > 0 && <span data-testid="alerts-overdue-count" className="px-2 py-0.5 rounded border border-red-600 bg-red-950 text-red-300">{t("palerts.overdue", { n: overdue })}</span>}
            {today > 0 && <span data-testid="alerts-today-count" className="px-2 py-0.5 rounded border border-amber-600 bg-amber-950 text-amber-300">{t("palerts.today", { n: today })}</span>}
          </div>
        </div>
        <div className="divide-y divide-amber-900/30">
          {items.map((p) => (
            <div key={p.id} data-testid={`alert-row-${p.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider rounded border shrink-0 ${
                p.due_category === "OVERDUE" ? "border-red-600 bg-red-950 text-red-300" : "border-amber-600 bg-amber-950 text-amber-300"
              }`}>
                {p.due_category === "OVERDUE" ? <><Warning size={11} weight="fill" /> {t("palerts.daysOverdue", { d: p.days_overdue })}</> : <><Clock size={11} weight="fill" /> {t("palerts.todayLabel")}</>}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-foreground truncate">
                  <span className="font-medium">{p.part_name}</span>
                  <span className="text-muted-foreground"> · {p.device_brand} {p.device_model}</span>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {t("palerts.expected")} {p.expected_arrival ? berlinDateTime(p.expected_arrival) : "—"}
                  {p.customer_name ? ` · ${p.customer_name}` : ""}
                </div>
              </div>
              {p.auftragsnummer && (
                <button onClick={() => navigate(`/auftrag/${p.order_id}`)}
                  className="font-mono text-xs text-accent hover:underline flex items-center gap-1 shrink-0">
                  {p.auftragsnummer} <ArrowSquareOut size={12} />
                </button>
              )}
              <select
                data-testid={`alert-status-${p.id}`}
                value={p.status}
                onChange={(e) => updateStatus(p.id, e.target.value)}
                className="bg-background border border-border px-2 py-1 text-[11px] rounded outline-none focus:border-accent font-mono uppercase shrink-0">
                {PURCHASE_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{t(`pstatus.${s}`, PURCHASE_STATUS_LABELS[s])}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
