import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import ProcurementAlerts from "@/components/ProcurementAlerts";
import { toast } from "sonner";
import { ShoppingCart, Link as LinkIcon, MagnifyingGlass, Funnel, ArrowSquareOut } from "@phosphor-icons/react";
import { PURCHASE_STATUS_LABELS, PURCHASE_STATUS_STYLES, PURCHASE_STATUS_ORDER } from "@/lib/constants";
import { berlinDateTime } from "@/lib/datetime";

function StatusPill({ status }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded-lg ${PURCHASE_STATUS_STYLES[status] || "bg-muted text-foreground/80 border-border"}`}>
      {t(`pstatus.${status}`, PURCHASE_STATUS_LABELS[status] || status)}
    </span>
  );
}

export default function Procurement() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isTech = user.role === "techniker";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/purchases/all");
      setItems(data);
    } catch (e) {
      toast.error(e.response?.data?.detail || t("toast.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/purchases/${id}`, { status });
      toast.success(t("toast.statusUpdated"));
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || t("toast.updateError"));
    }
  };

  const updateArrival = async (id, field, value) => {
    if (!value) return;
    try {
      await api.patch(`/purchases/${id}`, { [field]: value });
      toast.success(t("toast.arrivalUpdated"));
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || t("toast.updateError"));
    }
  };

  const filtered = items.filter((p) => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (p.part_name || "").toLowerCase().includes(s) ||
      (p.auftragsnummer || "").toLowerCase().includes(s) ||
      (p.customer_name || "").toLowerCase().includes(s) ||
      (p.device_model || "").toLowerCase().includes(s) ||
      (p.device_brand || "").toLowerCase().includes(s)
    );
  });

  const openCount = items.filter((p) => !["ANGEKOMMEN", "EINGEBAUT", "STORNIERT"].includes(p.status)).length;

  return (
    <div>
      <PageHeader label={t("proc.label")} title={t("proc.title")}>
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
          <ShoppingCart size={16} className="text-accent" />
          <span data-testid="procurement-open-count">{openCount} {t("proc.open")}</span> · {items.length} {t("proc.total")}
        </div>
      </PageHeader>

      <div className="pt-4">
        <ProcurementAlerts />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 px-6 md:px-8 py-4 border-b border-border/60">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            data-testid="procurement-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("proc.searchPlaceholder")}
            className="w-full bg-background border border-border pl-9 pr-3 py-2 text-sm rounded-lg outline-none focus:border-accent transition-colors font-mono"
          />
        </div>
        <div className="relative">
          <Funnel size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <select
            data-testid="procurement-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background border border-border pl-9 pr-8 py-2 text-sm rounded-lg outline-none focus:border-accent font-mono appearance-none"
          >
            <option value="">{t("proc.allStatus")}</option>
            {PURCHASE_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{t(`pstatus.${s}`, PURCHASE_STATUS_LABELS[s])}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-8 font-mono text-muted-foreground">{t("proc.loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center font-mono text-muted-foreground text-sm">{t("proc.empty")}</div>
        ) : (
          <table className="w-full text-sm" data-testid="procurement-table">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-6 md:px-8 py-3 font-medium">{t("proc.colOrder")}</th>
                <th className="px-4 py-3 font-medium">{t("proc.colDeviceCustomer")}</th>
                <th className="px-4 py-3 font-medium">{t("proc.colPart")}</th>
                <th className="px-4 py-3 font-medium">{t("proc.colLink")}</th>
                <th className="px-4 py-3 font-medium">{t("proc.colOrdered")}</th>
                <th className="px-4 py-3 font-medium">{t("proc.colExpected")}</th>
                <th className="px-4 py-3 font-medium">{t("proc.colArrived")}</th>
                {!isTech && <th className="px-4 py-3 font-medium">{t("proc.colPrice")}</th>}
                <th className="px-4 py-3 font-medium">{t("proc.colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} data-testid={`procurement-row-${p.id}`} className="border-b border-border/40 hover:bg-muted/40 transition-colors align-top">
                  <td className="px-6 md:px-8 py-3 whitespace-nowrap">
                    {p.auftragsnummer ? (
                      <button onClick={() => navigate(`/auftrag/${p.order_id}`)}
                        className="font-mono text-accent hover:underline flex items-center gap-1">
                        {p.auftragsnummer} <ArrowSquareOut size={12} />
                      </button>
                    ) : <span className="text-muted-foreground/60">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-foreground/90">{p.device_brand} {p.device_model}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{p.customer_name || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-foreground/90 max-w-[220px]">
                    {p.part_name}
                    {p.notes ? <div className="font-mono text-[10px] text-muted-foreground truncate">{p.notes}</div> : null}
                  </td>
                  <td className="px-4 py-3">
                    {p.supplier_url ? (
                      <a href={p.supplier_url} target="_blank" rel="noreferrer" data-testid={`procurement-link-${p.id}`}
                        className="text-accent hover:underline flex items-center gap-1 text-xs"><LinkIcon size={12} /> {t("proc.openLink")}</a>
                    ) : <span className="text-muted-foreground/60">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{p.order_timestamp ? berlinDateTime(p.order_timestamp) : "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input type="datetime-local" defaultValue={p.expected_arrival ? p.expected_arrival.slice(0, 16) : ""}
                      onBlur={(e) => updateArrival(p.id, "expected_arrival", e.target.value)}
                      className="bg-background border border-border px-2 py-1 text-[11px] rounded outline-none focus:border-accent font-mono" />
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{p.actual_arrival ? berlinDateTime(p.actual_arrival) : "—"}</td>
                  {!isTech && <td className="px-4 py-3 font-mono text-foreground/90 whitespace-nowrap">{p.price != null ? `${Number(p.price).toFixed(2)} €` : "—"}</td>}
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1.5">
                      <StatusPill status={p.status} />
                      <select
                        data-testid={`procurement-status-${p.id}`}
                        value={p.status}
                        onChange={(e) => updateStatus(p.id, e.target.value)}
                        className="bg-background border border-border px-2 py-1 text-[11px] rounded outline-none focus:border-accent font-mono uppercase">
                        {PURCHASE_STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>{t(`pstatus.${s}`, PURCHASE_STATUS_LABELS[s])}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
