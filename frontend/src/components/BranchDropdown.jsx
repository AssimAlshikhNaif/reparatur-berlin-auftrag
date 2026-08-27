import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Buildings, CaretDown, X } from "@phosphor-icons/react";
import api from "@/lib/api";

export default function BranchDropdown() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [branches, setBranches] = useState([]);
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    api.get("/branches").then((r) => setBranches(r.data)).catch(() => {});
  }, []);

  const handleToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
    setOpen((prev) => !prev);
  };

  const goToBranch = (b) => {
    setOpen(false);
    const branchId = b._id || b.id; // التحقق من الحقلين لضمان عدم إرسال undefined
    navigate(`/auftraege?branch_id=${branchId}&branch_name=${encodeURIComponent(b.name)}`);
  };

  return (
    <div className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        data-testid="branch-dropdown-toggle"
        onClick={handleToggle}
        className="flex items-center justify-center gap-1.5 border border-border rounded-lg px-2.5 sm:px-3 h-9 text-xs sm:text-sm text-foreground bg-card hover:bg-muted transition-colors shrink-0 cursor-pointer select-none"
      >
        <Buildings size={15} />
        <span className="inline">{t("branches.title", "Filialen")}</span>
        <CaretDown size={11} className="text-muted-foreground" />
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[999999] flex items-center justify-center sm:block">
            {/* خلفية معتمة تغطي الشاشة لإغلاق القائمة عند النقر خارجها */}
            <div
              className="fixed inset-0 bg-black/60 sm:bg-transparent"
              onClick={() => setOpen(false)}
            />

            {/* صندوق القائمة */}
            <div
              data-testid="branch-dropdown-list"
              style={{
                /* على الموبايل تظهر بالمنتصف، على اللابتوب تظهر تحت الزر تماماً */
                ...(window.innerWidth >= 640
                  ? {
                      position: "absolute",
                      top: `${coords.top + 6}px`,
                      left: `${Math.max(10, coords.left - 120)}px`,
                      width: "260px",
                    }
                  : {}),
              }}
              className="relative sm:absolute w-[90%] max-w-sm sm:w-64 max-h-[70vh] overflow-y-auto bg-card border border-border rounded-2xl sm:rounded-xl shadow-2xl p-2 sm:p-0 z-[1000000]"
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-border sm:hidden mb-1">
                <span className="font-bold text-sm">{t("branches.title", "Filialen")}</span>
                <button type="button" onClick={() => setOpen(false)} className="p-1 cursor-pointer">
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
          </div>,
          document.body
        )}
    </div>
  );
}