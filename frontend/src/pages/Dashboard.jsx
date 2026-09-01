import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, SlaBadge } from "@/components/StatusBadge";
import ProcurementAlerts from "@/components/ProcurementAlerts";
import ReklamationPanel from "@/components/ReklamationPanel";
import { STATUS_LABELS } from "@/lib/constants";
import MitarbeiterDashboard from "@/pages/MitarbeiterDashboard";
import { toast } from "sonner";
import {
  Wrench, Warning, Package, ClockCountdown, ArrowRight, CheckCircle, Receipt, Storefront,
  TrashSimple, SpinnerGap, X, ShieldWarning
} from "@phosphor-icons/react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

function DangerZone({ onReset }) {
  const { t } = useTranslation();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState({ orders: true, counters: true, inventory: false });
  const [confirmText, setConfirmText] = useState("");

  const CONFIRM_WORD = "LÖSCHEN";
  const anySelected = opts.orders || opts.counters || opts.inventory;
  const canDelete = anySelected && confirmText.trim().toUpperCase() === CONFIRM_WORD;

  const openModal = () => { setConfirmText(""); setConfirm(true); };
  const closeModal = () => { if (!busy) setConfirm(false); };
  const toggle = (k) => setOpts((o) => ({ ...o, [k]: !o[k] }));

  const doReset = async () => {
    if (!canDelete) return;
    setBusy(true);
    try {
      const { data } = await api.post("/admin/reset-test-data", opts);
      toast.success(`${t("danger.success")} (${data.total ?? 0})`);
      setConfirm(false);
      onReset && onReset();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || t("danger.error"));
    } finally {
      setBusy(false);
    }
  };

  const OPTIONS = [
    { key: "orders", label: t("danger.optOrders"), desc: t("danger.optOrdersDesc") },
    { key: "counters", label: t("danger.optCounters"), desc: t("danger.optCountersDesc") },
    { key: "inventory", label: t("danger.optInventory"), desc: t("danger.optInventoryDesc") },
  ];

  return (
    <div className="px-6 md:px-8">
      <div data-testid="danger-zone" className="border border-red-900/50 bg-red-950/10 rounded-xl p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-red-500/10 text-red-400 shrink-0">
            <ShieldWarning size={20} weight="fill" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-head font-semibold text-base text-red-200">{t("danger.title")}</h2>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{t("danger.desc")}</p>
          </div>
          <button
            data-testid="reset-test-data-button"
            onClick={openModal}
            className="flex items-center gap-2 shrink-0 border border-red-700 bg-red-950/40 text-red-300 text-xs font-head font-semibold uppercase tracking-wider px-4 py-2.5 rounded-lg hover:bg-red-700 hover:text-white transition-colors"
          >
            <TrashSimple size={16} weight="bold" /> {t("danger.button")}
          </button>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div data-testid="reset-confirm-modal" className="bg-card border border-red-900/60 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-red-300">
              <ShieldWarning size={22} weight="fill" />
              <h3 className="font-head font-semibold text-lg">{t("danger.confirmTitle")}</h3>
            </div>

            {/* Scoped options */}
            <div className="space-y-2">
              <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{t("danger.scopeTitle")}</div>
              {OPTIONS.map((o) => (
                <label key={o.key} data-testid={`reset-opt-${o.key}`}
                  className={`flex items-start gap-3 border rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${opts[o.key] ? "border-red-700/70 bg-red-950/20" : "border-border hover:bg-muted/40"}`}>
                  <input type="checkbox" data-testid={`reset-opt-checkbox-${o.key}`} checked={opts[o.key]} onChange={() => toggle(o.key)}
                    className="mt-0.5 accent-red-600 w-4 h-4" />
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground">{o.label}</span>
                    <span className="block text-[11px] font-mono text-muted-foreground">{o.desc}</span>
                  </span>
                </label>
              ))}
              {!anySelected && <p className="text-[11px] font-mono text-amber-400">{t("danger.selectOne")}</p>}
            </div>

            <p className="text-xs text-muted-foreground border-t border-border/50 pt-3">{t("danger.confirmText")}</p>

            {/* Type-to-confirm */}
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                {t("danger.typeToConfirm", { word: CONFIRM_WORD })}
              </label>
              <input
                data-testid="reset-confirm-input"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_WORD}
                autoComplete="off"
                className="w-full bg-background border border-border px-3 py-2 text-sm rounded-lg outline-none focus:border-red-600 font-mono tracking-widest uppercase"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                data-testid="reset-confirm-button"
                onClick={doReset}
                disabled={busy || !canDelete}
                className="flex-1 flex items-center justify-center gap-2 bg-red-700 text-white font-head font-semibold text-sm uppercase tracking-wider py-2.5 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? <><SpinnerGap size={16} className="animate-spin" /> {t("danger.button")}</> : <><TrashSimple size={16} /> {t("danger.confirm")}</>}
              </button>
              <button
                data-testid="reset-cancel-button"
                onClick={closeModal}
                disabled={busy}
                className="px-6 border border-border rounded-lg text-xs font-mono uppercase tracking-wider text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1.5"
              >
                <X size={14} /> {t("danger.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, icon: Icon, accent, testid }) {
  return (
    <div data-testid={testid} className="bg-card border border-border/80 p-6 rounded-xl flex flex-col justify-between shadow-sm hover:border-border transition-colors">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        <div className={`p-2 rounded-lg bg-secondary/50 ${accent || "text-muted-foreground/70"}`}>
          <Icon size={20} weight="regular" />
        </div>
      </div>
      <div className="font-mono text-3xl font-bold tracking-tight text-foreground mt-4">{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [slaOrders, setSlaOrders] = useState([]);

  if (user?.role === "mitarbeiter") return <MitarbeiterDashboard />;

  return (
    <AdminTechDashboard
      user={user}
      navigate={navigate}
      stats={stats}
      setStats={setStats}
      slaOrders={slaOrders}
      setSlaOrders={setSlaOrders}
    />
  );
}

function AdminTechDashboard({ user, navigate, stats, setStats, slaOrders, setSlaOrders }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);

useEffect(() => {
  let isMounted = true;

  async function loadDashboardData() {
    try {
      setLoading(true);
      
      // 1. جلب الإحصائيات الأساسية أولاً لتفتح الصفحة فوراً
      const statsRes = await api.get("/stats");
      if (isMounted) {
        setStats(statsRes.data || {});
        setLoading(false); // إيقاف شاشة التحميل فوراً لتفتح الداشبورد كالصاروخ!
      }

      // 2. جلب طلبات الـ SLA في الخلفية بشكل مستقل تماماً
      api.get("/orders", { params: { sla: true } })
        .then((res) => {
          if (isMounted) setSlaOrders(Array.isArray(res.data) ? res.data : []);
        })
        .catch((err) => {
          console.warn("SLA orders load failed:", err);
          if (isMounted) setSlaOrders([]);
        });

    } catch (err) {
      console.error("Dashboard-Ladefehler:", err);
      if (isMounted) {
        toast.error(formatApiErrorDetail(err.response?.data?.detail) || t("dashboard.loadError"));
        setLoading(false);
      }
    }
  }

  loadDashboardData();

  return () => {
    isMounted = false;
  };
}, [setStats, setSlaOrders, t]);
  if (loading) {
    return (
      <div className="p-8 font-mono text-muted-foreground animate-pulse text-sm">
        {t("dashboard.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <PageHeader label={`${t("dashboard.overview")} · ${user?.name || t("dashboard.user")}`} title={t("dashboard.title")} />

      {/* Metrics grid */}
      <div className="px-6 md:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric testid="metric-total" label={t("dashboard.metricTotal")} value={stats.total_orders ?? 0} icon={Wrench} />
        <Metric testid="metric-active" label={t("dashboard.metricActive")} value={stats.active_orders ?? 0} icon={ClockCountdown} accent="text-accent" />
        <Metric testid="metric-sla" label={t("dashboard.metricSla")} value={stats.sla_breached ?? 0} icon={Warning} accent={stats.sla_breached > 0 ? "text-red-500" : "text-muted-foreground/70"} />
        {user?.role === "admin" ? (
          <Metric testid="metric-revenue" label={t("dashboard.metricRevenue")} value={`${Number(stats.revenue ?? 0).toFixed(0)} €`} icon={Receipt} accent="text-emerald-500" />
        ) : (
          <Metric testid="metric-done" label={t("dashboard.metricDone")} value={stats.by_status?.ABGEHOLT ?? 0} icon={CheckCircle} accent="text-emerald-500" />
        )}
      </div>

      {/* Procurement arrival alerts (admin & staff) */}
      {(user?.role === "admin" || user?.role === "mitarbeiter") && <ProcurementAlerts />}

      {/* Reklamationen & Garantie overview (admin & staff) */}
      {(user?.role === "admin" || user?.role === "mitarbeiter") && <ReklamationPanel />}

      {/* Revenue chart section */}
      {user?.role === "admin" && stats.revenue_by_branch?.length > 0 && (
        <div className="px-6 md:px-8">
          <div className="border border-border/80 rounded-xl bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Storefront size={20} className="text-accent" />
                <h2 className="font-head font-semibold text-base">{t("dashboard.revenueByBranch")}</h2>
              </div>
              <span className="font-mono text-xs text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full border border-border/40">
                {t("dashboard.completedRepairs", { n: stats.completed_repairs ?? 0 })}
              </span>
            </div>
            <div className="h-64 pt-2" data-testid="revenue-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.revenue_by_branch} margin={{ top: 10, right: 10, left: -10, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="branch" stroke="#71717a" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} interval={0} angle={-12} textAnchor="end" />
                  <YAxis stroke="#71717a" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    contentStyle={{ background: "#09090B", border: "1px solid #3f3f46", borderRadius: "8px", fontFamily: "IBM Plex Mono", fontSize: 12 }}
                    formatter={(v, n) => [n === "revenue" ? `${Number(v).toFixed(2)} €` : v, n === "revenue" ? t("dashboard.revenue") : t("dashboard.ordersWord")]}
                  />
                  <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Lower grid */}
      <div className="px-6 md:px-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SLA alerts */}
        <div className="lg:col-span-2 border border-border/80 rounded-xl bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <Warning size={20} weight="fill" className="text-red-500" />
            <h2 className="font-head font-semibold text-base">{t("dashboard.slaTitle")}</h2>
          </div>
          {!slaOrders || slaOrders.length === 0 ? (
            <div className="text-sm text-muted-foreground font-mono border border-dashed border-border/60 rounded-lg py-12 text-center">
              {t("dashboard.noSla")}
            </div>
          ) : (
            <div className="space-y-2">
              {slaOrders.map((o) => (
                <button
                  key={o.id}
                  data-testid={`sla-row-${o.auftragsnummer}`}
                  onClick={() => navigate(`/auftrag/${o.id}`)}
                  className="w-full rounded-lg flex items-center justify-between gap-3 border border-red-900/40 bg-red-950/20 px-4 py-3 text-left hover:bg-red-950/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-semibold text-foreground">{o.auftragsnummer}</div>
                    <div className="text-xs text-muted-foreground truncate">{o.device_brand} {o.device_model} · {o.issue_description}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <SlaBadge days={o.working_days_open} />
                    <StatusBadge status={o.status} />
                    <ArrowRight size={16} className="text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status distribution & Low stock */}
        <div className="border border-border/80 rounded-xl bg-card p-6 shadow-sm space-y-6">
          <div>
            <h2 className="font-head font-semibold text-base mb-4">{t("dashboard.statusDistribution")}</h2>
            <div className="space-y-3">
              {Object.keys(STATUS_LABELS).map((st) => {
                const count = stats.by_status?.[st] ?? 0;
                const total = stats.total_orders || 1;
                const pct = Math.min(100, Math.round((count / total) * 100));
                return (
                  <div key={st} data-testid={`dist-${st}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{t(`status.${st}`, STATUS_LABELS[st])}</span>
                      <span className="font-mono text-xs font-semibold text-foreground">{count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-accent transition-all rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {user?.role === "admin" && stats.low_stock_items?.length > 0 && (
            <div className="pt-4 border-t border-border/40">
              <div className="flex items-center gap-2 mb-3">
                <Package size={18} className="text-amber-500" />
                <h3 className="font-head font-semibold text-sm">{t("dashboard.reorderNeeded")}</h3>
              </div>
              <div className="space-y-2">
                {stats.low_stock_items.slice(0, 6).map((i) => (
                  <div key={i.sku} className="flex items-center justify-between text-xs font-mono bg-background/50 p-2 rounded border border-border/40">
                    <span className="text-muted-foreground truncate">{i.device_model} · {i.part_type}</span>
                    <span className="text-amber-400 font-bold ml-2 shrink-0">{i.quantity}/{i.min_stock || 3}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Admin-only danger zone: reset test data for production launch */}
      {user?.role === "admin" && <DangerZone onReset={() => window.location.reload()} />}
    </div>
  );
}
