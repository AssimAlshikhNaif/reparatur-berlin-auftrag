import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, SlaBadge } from "@/components/StatusBadge";
import ContractPrint from "@/components/ContractPrint";
import { STATUS_LABELS } from "@/lib/constants";
import { MagnifyingGlass, PlusCircle, Funnel, Warning, ShieldCheck, ArrowsClockwise, Printer } from "@phosphor-icons/react";

export default function Orders() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [printOrder, setPrintOrder] = useState(null);
  const canManage = user.role === "admin" || user.role === "mitarbeiter";

  const load = async () => {
    setLoading(true);
    if (statusFilter === "REKLAMATION") {
      try {
        const { data } = await api.get("/reklamationen");
        setOrders(data);
      } catch { setOrders([]); }
      setLoading(false);
      return;
    }
    const params = {};
    if (statusFilter) params.status = statusFilter;
    const { data } = await api.get("/orders", { params });
    setOrders(data);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [statusFilter]);

  const filtered = orders.filter((o) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      o.auftragsnummer.toLowerCase().includes(s) ||
      o.device_model?.toLowerCase().includes(s) ||
      o.device_brand?.toLowerCase().includes(s) ||
      (o.customer_name || "").toLowerCase().includes(s)
    );
  });

  return (
    <div>
      <PageHeader label={t("orders.label")} title={t("orders.title")}>
        {(user.role === "admin" || user.role === "mitarbeiter") && (
          <button
            data-testid="header-new-order"
            onClick={() => navigate("/auftrag/neu")}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-xs font-head font-semibold uppercase tracking-wider px-4 py-2.5 rounded-lg hover:bg-blue-600 hover:text-primary-foreground transition-colors"
          >
            <PlusCircle size={16} weight="bold" /> {t("orders.newOrder")}
          </button>
        )}
      </PageHeader>

      {/* Quick filter tabs */}
      <div className="flex flex-wrap items-center gap-2 px-6 md:px-8 pt-4">
        {[
          { key: "", label: "Alle" },
          { key: "ANGENOMMEN", label: "Diagnose" },
          { key: "IN_BEARBEITUNG", label: "In Bearbeitung" },
          { key: "FERTIG", label: "Fertig" },
          { key: "ABGEHOLT", label: "Abgeholt" },
          { key: "REKLAMATION", label: "Reklamation" },
        ].map((tab) => (
          <button
            key={tab.key || "all"}
            data-testid={`filter-tab-${tab.key ? tab.key.toLowerCase() : "all"}`}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 text-xs font-head font-semibold uppercase tracking-wider rounded-full border transition-colors ${
              statusFilter === tab.key
                ? (tab.key === "REKLAMATION" ? "border-amber-500 bg-amber-950/40 text-amber-200" : "border-accent bg-accent/10 text-foreground")
                : (tab.key === "REKLAMATION" ? "border-amber-700/60 text-amber-300 hover:text-amber-200" : "border-border text-muted-foreground hover:text-foreground")
            }`}
          >
            {tab.key === "REKLAMATION" ? t("reklamation.badgeReclamation") : (tab.key === "" ? t("orders.all") : t(`status.${tab.key}`, tab.label))}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 px-6 md:px-8 py-4 border-b border-border/60">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            data-testid="orders-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("orders.searchPlaceholder")}
            className="w-full bg-background border border-border pl-9 pr-3 py-2 text-sm rounded-lg outline-none focus:border-accent transition-colors font-mono"
          />
        </div>
        <div className="relative">
          <Funnel size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <select
            data-testid="orders-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-background border border-border pl-9 pr-8 py-2 text-sm rounded-lg outline-none focus:border-accent font-mono appearance-none"
          >
            <option value="">{t("orders.allStatus")}</option>
            {Object.keys(STATUS_LABELS).map((k) => (
              <option key={k} value={k}>{t(`status.${k}`, STATUS_LABELS[k])}</option>
            ))}
            <option value="REKLAMATION">{t("reklamation.badgeReclamation")}</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-8 font-mono text-muted-foreground">{t("orders.loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center font-mono text-muted-foreground text-sm">{t("orders.empty")}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-6 md:px-8 py-3 font-medium">{t("orders.colNumber")}</th>
                <th className="px-4 py-3 font-medium">{t("orders.colDevice")}</th>
                <th className="px-4 py-3 font-medium">{t("orders.colBranch")}</th>
                {user.role !== "techniker" && <th className="px-4 py-3 font-medium">{t("orders.colCustomer")}</th>}
                {user.role !== "techniker" && <th className="px-4 py-3 font-medium">{t("orders.colStaff")}</th>}
                <th className="px-4 py-3 font-medium">{t("orders.colTech")}</th>
                <th className="px-4 py-3 font-medium">{t("orders.colStatus")}</th>
                <th className="px-4 py-3 font-medium">{t("orders.colCreated")}</th>
                <th className="px-4 py-3 font-medium text-right">{t("orders.colAction")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  data-testid={`order-row-${o.auftragsnummer}`}
                  onClick={() => navigate(`/auftrag/${o.id}`)}
                  className="border-b border-border/40 cursor-pointer hover:bg-muted transition-colors"
                >
                  <td className="px-6 md:px-8 py-3 font-mono text-foreground whitespace-nowrap">{o.auftragsnummer}</td>
                  <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">{o.device_brand} {o.device_model}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{o.branch_name}</td>
                  {user.role !== "techniker" && <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{o.customer_name}</td>}
                  {user.role !== "techniker" && <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{o.created_by_name || "—"}</td>}
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{o.assigned_techniker_name || <span className="text-muted-foreground/70">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusBadge status={o.status} />
                      {o.sla_breached && <SlaBadge days={o.working_days_open} />}
                      {o.imei_reminder && (
                        <span data-testid={`list-imei-${o.auftragsnummer}`} title={t("detail.imeiMissing")} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono uppercase border border-amber-600 bg-amber-950 text-amber-300 rounded">
                          <Warning size={10} weight="fill" /> IMEI
                        </span>
                      )}
                      {o.under_warranty && (
                        <span data-testid={`list-warranty-${o.auftragsnummer}`} title={t("reklamation.badgeWarranty")} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono uppercase border border-emerald-600 bg-emerald-950 text-emerald-300 rounded">
                          <ShieldCheck size={10} weight="fill" /> {t("reklamation.badgeWarranty")}
                        </span>
                      )}
                      {o.is_reclamation && (
                        <span data-testid={`list-reclamation-${o.auftragsnummer}`} title={t("reklamation.badgeReclamation")} className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono uppercase border border-amber-600 bg-amber-950 text-amber-300 rounded">
                          <ArrowsClockwise size={10} weight="fill" /> {t("reklamation.badgeReclamation")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(o.created_at).toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {canManage && (
                      <button
                        data-testid={`quick-print-${o.auftragsnummer}`}
                        onClick={(e) => { e.stopPropagation(); setPrintOrder(o); }}
                        title={t("print.quickPrint")}
                        className="inline-flex items-center gap-1.5 border border-accent/60 text-accent bg-accent/10 rounded-lg px-3 py-1.5 mr-2 text-[11px] font-head font-semibold uppercase tracking-wider hover:bg-accent hover:text-primary-foreground transition-colors"
                      >
                        <Printer size={14} weight="bold" /> {t("common.print")}
                      </button>
                    )}
                    <span className="font-mono text-xs text-accent">{t("common.open")} →</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {printOrder && <ContractPrint order={printOrder} branchName={printOrder.branch_name} onClose={() => setPrintOrder(null)} />}
    </div>
  );
}
