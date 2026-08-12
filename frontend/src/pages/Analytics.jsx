import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { UsersThree, Wrench, CurrencyEur, Clock, CheckCircle, TrendUp } from "@phosphor-icons/react";

function KpiCard({ title, value, subtext, icon: Icon }) {
  return (
    <div className="bg-card border border-border/80 p-5 rounded-xl shadow-sm">
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
  const [data, setData] = useState(null);

  useEffect(() => { api.get("/analytics").then((r) => setData(r.data)); }, []);

  if (!data) return <div className="p-8 font-mono text-muted-foreground animate-pulse">Lade Analyse…</div>;

  const mitarbeiter = data.mitarbeiter.filter((m) => m.created > 0);
  const techniker = data.techniker;

  // الحسابات المجمعة للـ KPI Cards
  const totalRevenue = mitarbeiter.reduce((acc, m) => acc + Number(m.revenue), 0);
  const totalCreated = mitarbeiter.reduce((acc, m) => acc + m.created, 0);
  const totalResolved = techniker.reduce((acc, t) => acc + t.resolved, 0);
  const avgTechTime = (techniker.reduce((acc, t) => acc + (t.avg_hours || 0), 0) / (techniker.length || 1)).toFixed(1);

  return (
    <div className="space-y-8 pb-12">
      <PageHeader label="Auswertung" title="Performance-Analyse" />

      {/* 1. Kpi Overview Cards */}
      <div className="px-6 md:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Gesamtumsa tz" value={`${totalRevenue.toFixed(2)} €`} subtext="Aus abgeschlossenen Aufträgen" icon={CurrencyEur} />
        <KpiCard title="Erstellte Aufträge" value={totalCreated} subtext="Von allen Mitarbeitern" icon={TrendUp} />
        <KpiCard title="Gelöste Fälle" value={totalResolved} subtext="Von Techniker-Team" icon={CheckCircle} />
        <KpiCard title="Ø Reparaturzeit" value={`${avgTechTime} h`} subtext="Durchschnittliche Dauer" icon={Clock} />
      </div>

      {/* 2. Mitarbeiter Section */}
      <div className="px-6 md:px-8">
        <div className="border border-border/80 rounded-xl bg-card p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2">
            <UsersThree size={20} className="text-accent" />
            <h2 className="font-head font-semibold text-base">Mitarbeiter · Umsatz & Leistung</h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Chart */}
            <div className="lg:col-span-5 h-64" data-testid="mitarbeiter-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mitarbeiter} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="#71717a" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                  <YAxis stroke="#71717a" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    contentStyle={{ background: "#09090B", border: "1px solid #3f3f46", borderRadius: "8px", fontFamily: "IBM Plex Mono", fontSize: "12px" }}
                    formatter={(v) => [`${Number(v).toFixed(2)} €`, "Umsatz"]}
                  />
                  <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="lg:col-span-7 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    <th className="pb-3 font-medium">Mitarbeiter</th>
                    <th className="pb-3 font-medium text-center">Erstellt</th>
                    <th className="pb-3 font-medium text-center">Abgeholt</th>
                    <th className="pb-3 font-medium text-right">Umsatz</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {mitarbeiter.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 font-medium text-foreground">{m.name}</td>
                      <td className="py-3 text-center font-mono text-muted-foreground">{m.created}</td>
                      <td className="py-3 text-center font-mono text-emerald-400">{m.delivered}</td>
                      <td className="py-3 text-right font-mono font-semibold text-foreground">{Number(m.revenue).toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Techniker Section */}
      <div className="px-6 md:px-8">
        <div className="border border-border/80 rounded-xl bg-card p-6 shadow-sm space-y-6">
          <div className="flex items-center gap-2">
            <Wrench size={20} className="text-accent" />
            <h2 className="font-head font-semibold text-base">Techniker · Effizienz & Auslastung</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {techniker.map((t) => {
              const rate = t.assigned > 0 ? Math.round((t.resolved / t.assigned) * 100) : 0;
              return (
                <div key={t.id} className="border border-border/60 rounded-lg p-4 bg-background/50 hover:border-border transition-colors space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold flex items-center justify-center">
                        {t.name[0]}
                      </div>
                      <span className="font-head font-semibold text-sm text-foreground">{t.name}</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-accent">{rate}% Gelöst</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                    <div className="bg-accent h-full rounded-full transition-all duration-500" style={{ width: `${rate}%` }} />
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-xs">
                    <div className="bg-card p-2 rounded border border-border/40">
                      <div className="text-[10px] text-muted-foreground uppercase">Zugewiesen</div>
                      <div className="text-foreground font-bold mt-0.5">{t.assigned}</div>
                    </div>
                    <div className="bg-card p-2 rounded border border-border/40">
                      <div className="text-[10px] text-muted-foreground uppercase">Gelöst</div>
                      <div className="text-emerald-400 font-bold mt-0.5">{t.resolved}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between font-mono text-xs text-muted-foreground pt-1 border-t border-border/40">
                    <span>Ø Zeit: <strong className="text-foreground">{t.avg_hours ?? "—"} h</strong></span>
                    <span>Umsatz: <strong className="text-foreground">{Number(t.revenue).toFixed(2)} €</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}