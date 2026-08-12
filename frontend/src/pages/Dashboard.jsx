import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, SlaBadge } from "@/components/StatusBadge";
import { STATUS_LABELS } from "@/lib/constants";
import MitarbeiterDashboard from "@/pages/MitarbeiterDashboard";
import { toast } from "sonner";
import {
  Wrench, Warning, Package, ClockCountdown, ArrowRight, CheckCircle, Receipt, Storefront
} from "@phosphor-icons/react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      try {
        setLoading(true);
        const [s, orders] = await Promise.all([
          api.get("/stats"),
          api.get("/orders", { params: { sla: true } }),
        ]);

        if (isMounted) {
          setStats(s.data || {});
          setSlaOrders(orders.data || []);
        }
      } catch (err) {
        console.error("Dashboard-Ladefehler:", err);
        toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Fehler beim Laden des Dashboards");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboardData();

    return () => {
      isMounted = false;
    };
  }, [setStats, setSlaOrders]);

  if (loading || !stats) {
    return (
      <div className="p-8 font-mono text-muted-foreground animate-pulse text-sm">
        Lade Dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <PageHeader label={`Übersicht · ${user?.name || "Benutzer"}`} title="Dashboard" />

      {/* Metrics grid */}
      <div className="px-6 md:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric testid="metric-total" label="Aufträge gesamt" value={stats.total_orders ?? 0} icon={Wrench} />
        <Metric testid="metric-active" label="Aktive Aufträge" value={stats.active_orders ?? 0} icon={ClockCountdown} accent="text-accent" />
        <Metric testid="metric-sla" label="SLA-Verstöße" value={stats.sla_breached ?? 0} icon={Warning} accent={stats.sla_breached > 0 ? "text-red-500" : "text-muted-foreground/70"} />
        {user?.role === "admin" ? (
          <Metric testid="metric-revenue" label="Umsatz (abgeholt)" value={`${Number(stats.revenue ?? 0).toFixed(0)} €`} icon={Receipt} accent="text-emerald-500" />
        ) : (
          <Metric testid="metric-done" label="Abgeholt" value={stats.by_status?.ABGEHOLT ?? 0} icon={CheckCircle} accent="text-emerald-500" />
        )}
      </div>

      {/* Revenue chart section */}
      {user?.role === "admin" && stats.revenue_by_branch?.length > 0 && (
        <div className="px-6 md:px-8">
          <div className="border border-border/80 rounded-xl bg-card p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Storefront size={20} className="text-accent" />
                <h2 className="font-head font-semibold text-base">Umsatz & Reparaturen je Filiale</h2>
              </div>
              <span className="font-mono text-xs text-muted-foreground bg-secondary/50 px-3 py-1 rounded-full border border-border/40">
                {stats.completed_repairs ?? 0} abgeschlossene Reparaturen
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
                    formatter={(v, n) => [n === "revenue" ? `${Number(v).toFixed(2)} €` : v, n === "revenue" ? "Umsatz" : "Aufträge"]}
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
            <h2 className="font-head font-semibold text-base">SLA-Alarme · 3 Werktage</h2>
          </div>
          {!slaOrders || slaOrders.length === 0 ? (
            <div className="text-sm text-muted-foreground font-mono border border-dashed border-border/60 rounded-lg py-12 text-center">
              Keine SLA-Verstöße. Alle Aufträge im Zeitrahmen.
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
            <h2 className="font-head font-semibold text-base mb-4">Status-Verteilung</h2>
            <div className="space-y-3">
              {Object.keys(STATUS_LABELS).map((st) => {
                const count = stats.by_status?.[st] ?? 0;
                const total = stats.total_orders || 1;
                const pct = Math.min(100, Math.round((count / total) * 100));
                return (
                  <div key={st} data-testid={`dist-${st}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-muted-foreground">{STATUS_LABELS[st]}</span>
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
                <h3 className="font-head font-semibold text-sm">Nachbestellung nötig</h3>
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
    </div>
  );
}