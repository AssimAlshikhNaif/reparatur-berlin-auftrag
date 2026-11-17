import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { UsersThree, Wrench, CurrencyEur, Clock, CheckCircle, TrendUp } from "@phosphor-icons/react";

function KpiCard({ title, value, subtext, icon: Icon }) {
  return (
    <div className="bg-card border border-border/85 p-5 rounded-xl shadow-sm hover:border-accent/50 transition-all">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">{title}</span>
        <div className="p-2 rounded-lg bg-accent/10 text-accent">
          <Icon size={20} />
        </div>
      </div>
      <div className="font-mono text-2xl font-bold text-foreground">{value}</div>
      {subtext && <div className="text-[11px] font-mono text-muted-foreground mt-1">{subtext}</div>}
    </div>
  );
}

export default function Analytics() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [selectedTechForOrders, setSelectedTechForOrders] = useState(null);

  // التقاط branch_id من الـ URL (القائمة المنسدلة للفرع)
  const queryParams = new URLSearchParams(window.location.search);
  const branchId = queryParams.get("branch_id");

  useEffect(() => {
    const url = branchId ? `/analytics?branch_id=${branchId}` : "/analytics";
    api.get(url)
      .then((r) => setData(r.data))
      .catch((err) => console.error("Error loading analytics data:", err));
  }, [branchId]);

  if (!data) return <div className="p-8 font-mono text-muted-foreground animate-pulse">{t("ana.loading")}</div>;

  const mitarbeiter = (data.mitarbeiter || []).filter((m) => m.created > 0);
  const techniker = data.techniker || [];

  const totalRevenue = mitarbeiter.reduce((acc, m) => acc + Number(m.revenue || 0), 0);
  const totalCreated = mitarbeiter.reduce((acc, m) => acc + (m.created || 0), 0);
  const totalResolved = techniker.reduce((acc, t2) => acc + (t2.resolved || 0), 0);
  const avgTechTime = (techniker.reduce((acc, t2) => acc + (t2.avg_hours || 0), 0) / (techniker.length || 1)).toFixed(1);

  // الاعتماد المباشر على بيانات الـ techniker القادمة من الباك إند مع قائمة الطلبات الحقيقية
  const finalTechList = techniker.map(tk => ({
    technician_id: tk.id,
    name: tk.name,
    total_assigned_orders: tk.assigned,
    active_orders: tk.active_orders || (tk.assigned - tk.resolved),
    reclamation_count: tk.reclamation_count || 0,
    status_breakdown: tk.status_breakdown || {},
    orders_list: tk.orders_list || []
  }));

  return (
    <div className="space-y-8 pb-12">
      <PageHeader label={t("ana.label")} title={t("ana.title")} />

      {/* 1. KPI Overview Cards */}
      <div className="px-6 md:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title={t("ana.kpiRevenue")} value={`${totalRevenue.toFixed(2)} €`} subtext={t("ana.kpiRevenueSub")} icon={CurrencyEur} />
        <KpiCard title={t("ana.kpiCreated")} value={totalCreated} subtext={t("ana.kpiCreatedSub")} icon={TrendUp} />
        <KpiCard title={t("ana.kpiResolved")} value={totalResolved} subtext={t("ana.kpiResolvedSub")} icon={CheckCircle} />
        <KpiCard title={t("ana.kpiAvgTime")} value={`${avgTechTime} h`} subtext={t("ana.kpiAvgTimeSub")} icon={Clock} />
      </div>

      {/* 2. Mitarbeiter Section */}
      <div className="px-6 md:px-8">
        <div className="border border-border/80 rounded-xl bg-card p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UsersThree size={20} className="text-accent" />
              <h2 className="font-head font-semibold text-base">{t("ana.staffTitle")}</h2>
            </div>
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded">Mitarbeiter Performance</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Bar Chart with safe container height */}
            <div className="lg:col-span-6 h-72 w-full min-h-[280px]" data-testid="mitarbeiter-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mitarbeiter} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                  <YAxis stroke="#71717a" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    contentStyle={{ background: "#09090B", border: "1px solid #3f3f46", borderRadius: "8px", fontFamily: "IBM Plex Mono", fontSize: "12px" }}
                    formatter={(v) => [`${Number(v).toFixed(2)} €`, t("ana.revenue")]}
                  />
                  <Bar dataKey="revenue" fill="#3B82F6" radius={[6, 6, 0, 0]} maxBarSize={45} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="lg:col-span-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="pb-3 font-medium">{t("ana.colStaff")}</th>
                    <th className="pb-3 font-medium text-center">{t("ana.colCreated")}</th>
                    <th className="pb-3 font-medium text-center">{t("ana.colCollected")}</th>
                    <th className="pb-3 font-medium text-right">{t("ana.colRevenue")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {mitarbeiter.map((m) => (
                    <tr key={m.id || m.name} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 font-medium text-foreground flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-accent/10 text-accent font-bold font-mono text-xs flex items-center justify-center">
                          {m.name?.[0]?.toUpperCase() || "M"}
                        </div>
                        {m.name}
                      </td>
                      <td className="py-3 text-center font-mono text-muted-foreground">{m.created}</td>
                      <td className="py-3 text-center font-mono text-emerald-400">{m.delivered}</td>
                      <td className="py-3 text-right font-mono font-semibold text-foreground">{Number(m.revenue || 0).toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Techniker & Reklamation Activity Section */}
      <div className="px-6 md:px-8">
        <div className="border border-border/80 rounded-xl bg-card p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench size={20} className="text-accent" />
              <h2 className="font-head font-semibold text-base">{t("ana.techTitle")} & Reklamation Aktivität</h2>
            </div>
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded">Techniker Übersicht</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  <th className="pb-3 font-medium">Techniker</th>
                  <th className="pb-3 font-medium text-center">Gesamt Aufträge</th>
                  <th className="pb-3 font-medium text-center">Aktiv</th>
                  <th className="pb-3 font-medium text-center text-amber-400">Reklamationen</th>
                  <th className="pb-3 font-medium text-right">Status Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40 font-mono text-xs">
                {finalTechList.map((tech) => (
                  <tr key={tech.technician_id || tech.name} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-center text-xs">
                          {tech.name?.[0]?.toUpperCase() || "T"}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-head font-medium text-sm text-foreground">{tech.name}</span>
                          <button 
                            onClick={() => setSelectedTechForOrders(tech)}
                            className="text-[11px] text-accent hover:underline text-left mt-0.5 font-mono flex items-center gap-1 cursor-pointer"
                          >
                            <span>Aufträge anzeigen ({tech.orders_list?.length || 0})</span>
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-center text-foreground font-semibold">{tech.total_assigned_orders}</td>
                    <td className="py-3 text-center text-blue-400 font-semibold">{tech.active_orders}</td>
                    <td className="py-3 text-center font-bold text-amber-400">{tech.reclamation_count}</td>
                    <td className="py-3 text-right">
                      <div className="flex flex-wrap gap-1 justify-end items-center">
                        {Object.entries(tech.status_breakdown || {})
                          .filter(([_, count]) => count > 0)
                          .map(([st, count]) => (
                            <span 
                              key={st}
                              className={`px-2 py-0.5 text-[10px] rounded font-mono ${
                                st === 'BEREIT IN WERKSTATT' ? 'bg-yellow-500/25 text-yellow-300 border border-yellow-500/30' :
                                st === 'WARTEN ERSATZTEIL' ? 'bg-orange-500/25 text-orange-300 border border-orange-500/30' :
                                st === 'IN BEARBEITUNG' ? 'bg-blue-500/25 text-blue-300 border border-blue-500/30' :
                                st === 'DIAGNOSE' ? 'bg-purple-500/25 text-purple-300 border border-purple-500/30' :
                                st === 'WARTEN FREIGABE' ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/30' :
                                'bg-zinc-800 text-zinc-300 border border-zinc-700'
                              }`}
                            >
                              {st}: {count}
                            </span>
                          ))}
                          {Object.entries(tech.status_breakdown || {}).filter(([_, count]) => count > 0).length === 0 && (
                            <span className="text-muted-foreground">Keine</span>
                          )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal لعارض طلبات الفني المختار */}
      {selectedTechForOrders && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <h3 className="font-head font-semibold text-lg text-foreground">
                Aufträge von: {selectedTechForOrders.name}
              </h3>
              <button 
                onClick={() => setSelectedTechForOrders(null)}
                className="text-muted-foreground hover:text-foreground font-mono text-sm"
              >
                ✕ Schließen
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {selectedTechForOrders.orders_list && selectedTechForOrders.orders_list.filter(ord => !['ABGEHOLT', 'FERTIG'].includes(ord.status)).length > 0 ? (
  selectedTechForOrders.orders_list
    .filter(ord => !['ABGEHOLT', 'FERTIG'].includes(ord.status))
    .map((ord) => (
      <div 
        key={ord.id}
        className="flex items-center justify-between p-3 rounded-lg bg-muted/40 hover:bg-muted/70 border border-border/40 transition-colors"
      >
        <div>
          <div className="font-mono font-semibold text-sm text-foreground">
            {(ord.auftrag_nr || ord.auftragsnummer || ord.order_number || ord.id || "N/A").toString()}
          </div>
          <div className="text-xs text-muted-foreground">{ord.device}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 text-[10px] rounded font-mono bg-accent/10 text-accent border border-accent/20">
            {ord.status}
          </span>
          <button
            onClick={() => window.open(`/auftrag/${ord.id}`, '_blank')}
            className="px-3 py-1.5 text-xs font-mono bg-accent text-accent-foreground rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
          >
            Öffnen ↗
          </button>
        </div>
      </div>
    ))
) : (
  <div className="text-center py-8 font-mono text-sm text-muted-foreground">
    Keine aktiven Aufträge gefunden.
  </div>
)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}