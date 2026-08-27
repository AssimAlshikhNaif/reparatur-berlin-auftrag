import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { MagnifyingGlass, X, ShieldCheck, Warning } from "@phosphor-icons/react";
import { STATUS_LABELS } from "@/lib/constants";

export default function GlobalSearch({ compact = false }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      setOpen(true); // <--- فتح النافذة فوراً عند بدء البحث لإظهار حالة التحميل أو لا توجد نتائج
      try {
        const { data } = await api.get("/search", { params: { q: term } });
        setResults(data);
      } catch (e) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => timer.current && clearTimeout(timer.current);
  }, [q]);

  const go = (id) => {
    setOpen(false);
    setQ("");
    setResults([]);
    navigate(`/auftrag/${id}`);
  };

  return (
    <div className={`relative w-full ${compact ? "sm:w-[220px]" : "md:max-w-md"} shrink`}>
      <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 h-9 shadow-sm">
        <MagnifyingGlass size={15} className="text-muted-foreground shrink-0" />
        <input
          data-testid="global-search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={t("common.search")}
          className="flex-1 min-w-0 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
        />
        {q && (
          <button 
            type="button"
            onClick={(e) => { 
              e.stopPropagation();
              setQ(""); 
              setResults([]); 
              setOpen(false); 
            }} 
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div 
            data-testid="global-search-results"
            className="absolute left-0 right-0 mt-2 max-h-[60vh] overflow-y-auto z-50 bg-card border border-border rounded-xl shadow-2xl"
          >
            {loading ? (
              <div className="text-xs font-mono text-muted-foreground/70 py-6 text-center">{t("common.searching")}</div>
            ) : results.length === 0 ? (
              <div className="text-xs font-mono text-muted-foreground/70 py-6 text-center">{t("common.noResults")}</div>
            ) : (
              results.map((o) => (
                <button 
                  key={o.id} 
                  type="button"
                  onClick={() => go(o.id)}
                  className="w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/80 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm text-foreground">{o.auftragsnummer}</span>
                    <div className="flex items-center gap-1.5">
                      {o.under_warranty && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border border-emerald-700 text-emerald-300 bg-emerald-950">
                          <ShieldCheck size={10} /> Garantie
                        </span>
                      )}
                      {o.imei_reminder && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border border-amber-700 text-amber-300 bg-amber-950">
                          <Warning size={10} /> IMEI
                        </span>
                      )}
                      <span className="text-[9px] font-mono uppercase text-muted-foreground">
                        {t(`status.${o.status}`, STATUS_LABELS[o.status] || o.status)}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {o.device_brand} {o.device_model}
                    {o.customer_name ? ` · ${o.customer_name}` : ""}
                    {o.imei ? ` · IMEI ${o.imei}` : ""}
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}