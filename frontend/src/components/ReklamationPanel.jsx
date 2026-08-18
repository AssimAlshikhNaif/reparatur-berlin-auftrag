import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { ShieldCheck, ArrowsClockwise, ArrowRight } from "@phosphor-icons/react";

export default function ReklamationPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/reklamationen").then((r) => setItems(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <div className="px-6 md:px-8">
      <div data-testid="reklamation-panel" className="border border-amber-800/50 rounded-xl bg-amber-950/10 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <ArrowsClockwise size={20} weight="fill" className="text-amber-400" />
          <h2 className="font-head font-semibold text-base">{t("reklamation.title")}</h2>
          <span className="font-mono text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full border border-border/40">{items.length}</span>
        </div>
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground font-mono border border-dashed border-border/60 rounded-lg py-10 text-center">
            {t("reklamation.empty")}
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((o) => (
              <button key={o.id} data-testid={`reklamation-row-${o.auftragsnummer}`} onClick={() => navigate(`/auftrag/${o.id}`)}
                className="w-full rounded-lg flex items-center justify-between gap-3 border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-left hover:bg-amber-950/40 transition-colors">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-semibold text-foreground">{o.auftragsnummer}</div>
                  <div className="text-xs text-muted-foreground truncate">{o.device_brand} {o.device_model} · {o.branch_name}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {o.is_reclamation && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono uppercase border border-amber-600 bg-amber-950 text-amber-300 rounded">
                      <ArrowsClockwise size={11} weight="fill" /> {t("reklamation.badgeReclamation")}
                    </span>
                  )}
                  {o.under_warranty && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono uppercase border border-emerald-600 bg-emerald-950 text-emerald-300 rounded">
                      <ShieldCheck size={11} weight="fill" /> {t("reklamation.badgeWarranty")}{typeof o.warranty_days_left === "number" ? ` · ${o.warranty_days_left}T` : ""}
                    </span>
                  )}
                  <ArrowRight size={16} className="text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
