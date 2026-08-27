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
  const [mobileExpanded, setMobileExpanded] = useState(false); // حالة فتح البحث على الموبايل
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
      setOpen(true);
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
    setMobileExpanded(false);
    navigate(`/auftrag/${id}`);
  };

  return (
    <div className="relative">
      {/* زر الأيقونة للموبايل / أو الشريط العادي للشاشات الكبيرة */}
      <div className="flex items-center">
        {/* زر المكبرة يظهر فقط عندما يكون البحث مغلقاً على الموبايل */}
        {!mobileExpanded && (
          <button
            type="button"
            onClick={() => setMobileExpanded(true)}
            className="md:hidden flex items-center justify-center bg-card border border-border rounded-lg w-9 h-9 text-foreground hover:bg-muted transition-colors cursor-pointer"
            title={t("common.search")}
          >
            <MagnifyingGlass size={16} />
          </button>
        )}

        {/* حاوية البحث (تظهر دائماً على اللابتوب، وتظهر عند النقر على الموبايل) */}
        <div className={`${mobileExpanded ? "absolute right-0 top-[-6px] z-50 bg-card p-1 shadow-xl border border-border rounded-lg flex w-[260px]" : "hidden md:flex"} items-center gap-2 bg-background border border-border rounded-lg px-3 h-9 shadow-sm ${compact ? "w-[180px] sm:w-[220px]" : "w-full max-w-md"}`}>
          <MagnifyingGlass size={15} className="text-muted-foreground shrink-0" />
          <input
            data-testid="global-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            placeholder={t("common.search")}
            autoFocus={mobileExpanded}
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
              className="text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
          {mobileExpanded && (
            <button
              type="button"
              onClick={() => {
                setMobileExpanded(false);
                setQ("");
                setOpen(false);
              }}
              className="text-muted-foreground hover:text-foreground ml-1 cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>
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
                  className="w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/80 transition-colors cursor-pointer"
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