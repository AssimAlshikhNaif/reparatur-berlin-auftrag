import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, SlaBadge } from "@/components/StatusBadge";
import { toast } from "sonner";
import {
  Wrench,
  ClockCountdown,
  CheckCircle,
  Package,
  PlusCircle,
  QrCode,
  WhatsappLogo,
  ArrowRight,
} from "@phosphor-icons/react";

function KpiCard({ label, value, icon: Icon, tone, testid }) {
  const tones = {
    blue: "border-primary/40 bg-primary/10 text-primary",
    emerald: "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
    amber: "border-amber-500/40 bg-amber-500/10 text-amber-500",
    slate: "border-border bg-muted/40 text-muted-foreground",
  };

  return (
    <div data-testid={testid} className="bg-card border border-border rounded-lg p-5 flex flex-col gap-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        <span className={`w-9 h-9 rounded-lg border flex items-center justify-center ${tones[tone] || tones.slate}`}>
          <Icon size={18} weight="bold" />
        </span>
      </div>
      <div className="font-mono text-4xl tracking-tighter text-foreground">{value}</div>
    </div>
  );
}

export default function MitarbeiterDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    api.get("/orders")
      .then((r) => {
        if (isMounted) {
          setOrders(r.data || []);
        }
      })
      .catch((err) => {
        console.error("Fehler beim Laden der Aufträge:", err);
        toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Fehler beim Laden der Aufträge");
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const count = (fn) => orders.filter(fn).length;
  
  const kpis = {
    total: orders.length,
    inProgress: count((o) => o.status === "IN_BEARBEITUNG"),
    ready: count((o) => o.status === "FERTIG"),
    waiting: count((o) => o.status === "WARTEN_ERSATZTEIL" || o.cost?.status === "WARTET"),
  };

  const active = orders.filter((o) => !["ABGEHOLT", "ABGELEHNT"].includes(o.status)).slice(0, 12);

  return (
    <div className="pb-12">
      <PageHeader label={`Filiale · ${user?.name || "Mitarbeiter"}`} title="Mitarbeiter-Dashboard" />

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 md:p-8">
        <KpiCard testid="kpi-total" label="Gesamt" value={kpis.total} icon={Wrench} tone="slate" />
        <KpiCard testid="kpi-inprogress" label="In Bearbeitung" value={kpis.inProgress} icon={ClockCountdown} tone="blue" />
        <KpiCard testid="kpi-ready" label="Bereit zur Abholung" value={kpis.ready} icon={CheckCircle} tone="emerald" />
        <KpiCard testid="kpi-waiting" label="Wartet (Freigabe/Teile)" value={kpis.waiting} icon={Package} tone="amber" />
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 px-6 md:px-8 pb-6">
        <button
          data-testid="qa-new-order"
          onClick={() => navigate("/auftrag/neu")}
          className="flex items-center gap-2 bg-primary text-primary-foreground font-head font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
        >
          <PlusCircle size={18} weight="bold" /> Neuer Auftrag
        </button>
        <button
          data-testid="qa-scan"
          onClick={() => navigate("/scannen")}
          className="flex items-center gap-2 border border-border text-foreground font-head font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-muted transition-colors"
        >
          <QrCode size={18} /> QR Scannen
        </button>
        <button
          data-testid="qa-whatsapp"
          onClick={() => window.open("https://web.whatsapp.com", "_blank", "noopener,noreferrer")}
          className="flex items-center gap-2 border border-[#25D366]/50 text-[#25D366] font-head font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-[#25D366]/10 transition-colors"
        >
          <WhatsappLogo size={18} weight="fill" /> WhatsApp Chat
        </button>
      </div>

      {/* Live table */}
      <div className="px-6 md:px-8 pb-10">
        <div className="bg-card border border-border rounded-lg overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-head font-semibold text-lg tracking-tight">Aktive Aufträge · Ihre Filiale</h2>
            <button
              data-testid="see-all-orders"
              onClick={() => navigate("/auftraege")}
              className="text-xs font-mono uppercase tracking-wider text-primary hover:underline"
            >
              Alle anzeigen →
            </button>
          </div>
          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 font-mono text-muted-foreground text-center text-sm">Lade Aufträge…</div>
            ) : active.length === 0 ? (
              <div className="p-10 text-center font-mono text-muted-foreground text-sm">Keine aktiven Aufträge.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/20">
                    <th className="px-5 py-3 font-medium">Auftragsnr.</th>
                    <th className="px-4 py-3 font-medium">Gerät</th>
                    <th className="px-4 py-3 font-medium">Kunde</th>
                    <th className="px-4 py-3 font-medium">Techniker</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {active.map((o) => (
                    <tr
                      key={o.id}
                      data-testid={`ma-order-${o.auftragsnummer}`}
                      onClick={() => navigate(`/auftrag/${o.id}`)}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-5 py-3 font-mono text-foreground font-semibold whitespace-nowrap">{o.auftragsnummer}</td>
                      <td className="px-4 py-3 text-foreground/80 whitespace-nowrap">{o.device_brand} {o.device_model}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{o.customer_name}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{o.assigned_techniker_name || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={o.status} />
                          {o.sla_breached && <SlaBadge days={o.working_days_open} />}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <ArrowRight size={16} className="text-primary inline" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}