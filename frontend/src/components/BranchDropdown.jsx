import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Buildings, CaretDown } from "@phosphor-icons/react";
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

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((prev) => !prev);
  };

  const goToBranch = (e, b) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    navigate(`/auftraege?branch_id=${b._id}&branch_name=${encodeURIComponent(b.name)}`);
  };

  return (
    <div className="relative inline-block" ref={boxRef}>
      <button
        type="button"
        data-testid="branch-dropdown-toggle"
        onClick={handleToggle}
        onTouchEnd={handleToggle}
        className="flex items-center gap-1.5 border border-border rounded-lg px-3 h-9 text-sm text-foreground bg-card hover:bg-muted transition-colors shrink-0 cursor-pointer"
      >
        <Buildings size={15} />
        <span className="inline">{t("branches.title", "Filialen")}</span>
        <CaretDown size={11} className="text-muted-foreground" />
      </button>

      {open && (
        <div
          data-testid="branch-dropdown-list"
          className="fixed sm:absolute start-3 sm:start-auto sm:end-0 top-16 sm:top-auto sm:mt-2 w-[calc(100vw-24px)] sm:w-64 max-h-[60vh] overflow-y-auto z-[99999] bg-card border border-border rounded-xl shadow-2xl"
        >
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
                onClick={(e) => goToBranch(e, b)}
                onTouchEnd={(e) => goToBranch(e, b)}
                className="w-full text-start px-4 py-3 text-sm hover:bg-muted/50 border-b border-border/50 last:border-b-0 transition-colors truncate cursor-pointer"
              >
                {b.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}