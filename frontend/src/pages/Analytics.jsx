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
  const [techActivity, setTechActivity] = useState([]);

  // التقاط branch_id من الـ URL (القائمة المنسدلة للفرع)
  const queryParams = new URLSearchParams(window.location.search);
  const branchId = queryParams.get("branch_id");

  useEffect(() => {
    const url = branchId ? `/analytics?branch_id=${branchId}` : "/analytics";
    api.get(url)
      .then((r) => setData(r.data))
      .catch((err) => console.error("Error loading analytics data:", err));

    const techUrl = branchId ? `/admin/technicians-activity?branch_id=${branchId}` : "/admin/technicians-activity";
    api.get(techUrl)
      .then((r) => setTechActivity(r.data))
      .catch((err) => {
        console.log("Tech activity fallback triggered", err);
        setTechActivity([]);
      });
  }, [branchId]);

  if (!data) return <div className="p-8 font-mono text-muted-foreground animate-pulse">{t("ana.loading")}</div>;

  const mitarbeiter = (data.mitarbeiter || []).filter((m) => m.created > 0);
  const techniker = data.techniker || [];

  const totalRevenue = mitarbeiter.reduce((acc, m) => acc + Number(m.revenue || 0), 0);
  const totalCreated = mitarbeiter.reduce((acc, m) => acc + (m.created || 0), 0);
  const totalResolved = techniker.reduce((acc, t2) => acc + (t2.resolved || 0), 0);
  const avgTechTime = (techniker.reduce((acc, t2) => acc + (t2.avg_hours || 0), 0) / (techniker.length || 1)).toFixed(1);

  // دمج بيانات الفنيين لضمان ظهور الجدول دائماً بسلاسة وبدون أي أخطاء 504
  const finalTechList = techActivity.length > 0 ? techActivity : techniker.map(tk => ({
    technician_id: tk.id,
    name: tk.name,
    total_assigned_orders: tk.assigned,
    active_orders: tk.assigned - tk.resolved,
    reclamation_count: 0,
    status_breakdown: { "Gelöst": tk.resolved, "Zugewiesen": tk.assigned }
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

      {/* 3. Techniker & Reklamation Activity Section (Unified Table replacing old cards) */}
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
                    <td className="py-3 font-medium text-foreground flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-bold flex items-center justify-center text-xs">
                        {tech.name?.[0]?.toUpperCase() || "T"}
                      </div>
                      <span className="font-head font-medium text-sm">{tech.name}</span>
                    </td>
                    <td className="py-3 text-center text-foreground font-semibold">{tech.total_assigned_orders}</td>
                    <td className="py-3 text-center text-blue-400 font-semibold">{tech.active_orders}</td>
                    <td className="py-3 text-center font-bold text-amber-400">{tech.reclamation_count}</td>
                    <td className="py-3 text-right text-muted-foreground">
                      {Object.entries(tech.status_breakdown || {})
                        .map(([st, count]) => `${st}: ${count}`)
                        .join(" | ") || "Keine"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}