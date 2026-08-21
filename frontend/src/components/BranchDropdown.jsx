import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Buildings, CaretDown, X } from "@phosphor-icons/react";
import api from "@/lib/api";

export default function BranchDropdown() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    api.get("/branches").then((r) => setBranches(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("touchstart", onClickOutside);
    
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("touchstart", onClickOutside);
    };
  }, [open]);

  const goToBranch = (b) => {
    setOpen(false);
    navigate(`/auftraege?branch_id=${b._id}&branch_name=${encodeURIComponent(b.name)}`);
  };

  return (
    <div className="relative inline-block" ref={boxRef}>
      <button
        type="button"
        data-testid="branch-dropdown-toggle"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 border border-border rounded-lg px-3 h-9 text-sm text-foreground bg-card hover:bg-muted transition-colors shrink-0 cursor-pointer"
      >
        <Buildings size={15} />
        <span className="inline">{t("branches.title", "Filialen")}</span>
        <CaretDown size={11} className="text-muted-foreground" />
      </button>

      {open && (
        <>
          {/* خلفية معتمة على الموبايل لضمان ظهور القائمة بوضوح تام فوق كل العناصر */}
          <div className="fixed inset-0 bg-black/50 z-[9998] sm:hidden" onClick={() => setOpen(false)} />

          <div
            data-testid="branch-dropdown-list"
            className="fixed sm:absolute inset-x-4 sm:inset-x-auto sm:end-0 top-20 sm:top-auto sm:mt-2 max-w-sm sm:w-64 max-h-[70vh] overflow-y-auto z-[9999] bg-card border border-border rounded-2xl sm:rounded-xl shadow-2xl p-2 sm:p-0"
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-border sm:hidden">
              <span className="font-bold text-sm">{t("branches.title", "Filialen")}</span>
              <button onClick={() => setOpen(false)} className="p-1">
                <X size={18} />
              </button>
            </div>

            {branches.length === 0 ? (
              <div className="px-4 py-3 text-xs font-mono text-muted-foreground/70">
                {t("common.noResults", "Keine Ergebnisse")}
              </div>
            ) : (
              branches.map((b) => (
                <button
                  type="button"
                  key={b._id}
                  data-testid={`branch-item-${b._id}`}
                  onClick={() => goToBranch(b)}
                  className="w-full text-start px-4 py-3 text-sm hover:bg-muted/50 border-b border-border/50 last:border-b-0 transition-colors truncate rounded-lg sm:rounded-none cursor-pointer"
                >
                  {b.name}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}