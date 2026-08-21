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
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const goToBranch = (b) => {
    setOpen(false);
    navigate(`/auftraege?branch_id=${b.id}&branch_name=${encodeURIComponent(b.name)}`);
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        data-testid="branch-dropdown-toggle"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 border border-border rounded-lg px-3 h-9 text-sm text-foreground hover:bg-muted transition-colors shrink-0"
      >
        <Buildings size={15} />
        <span className="hidden md:inline">{t("branches.title", "Filialen")}</span>
        <CaretDown size={11} className="text-muted-foreground" />
      </button>

      {open && (
        <div
          data-testid="branch-dropdown-list"
          className="absolute right-0 mt-2 w-64 z-40 bg-background border border-border rounded-xl shadow-2xl overflow-hidden"
        >
          {branches.length === 0 ? (
            <div className="px-4 py-3 text-xs font-mono text-muted-foreground/70">{t("common.noResults", "Keine Ergebnisse")}</div>
          ) : (
            branches.map((b) => (
              <button
                key={b.id}
                data-testid={`branch-item-${b.id}`}
                onClick={() => goToBranch(b)}
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted/50 border-b border-border/50 last:border-b-0 transition-colors truncate"
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
