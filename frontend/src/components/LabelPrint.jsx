import { useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { Printer, X } from "@phosphor-icons/react";

// Compact adhesive sticker: Order code + QR (no customer info) — safe to stick
// on devices or spare-part boxes to prevent mix-ups.
export default function LabelPrint({ order, onClose }) {
  const { t } = useTranslation();

  useEffect(() => {
    const after = () => { if (onClose) onClose(); };
    window.addEventListener("afterprint", after);
    return () => window.removeEventListener("afterprint", after);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border w-full max-w-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-head font-semibold text-sm">{t("label.title")}</h3>
          <div className="flex items-center gap-2">
            <button data-testid="label-print-button" onClick={() => window.print()}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-xs font-head font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors">
              <Printer size={14} /> {t("common.print")}
            </button>
            <button data-testid="label-close-button" onClick={onClose}
              className="flex items-center gap-2 border border-border text-foreground text-xs font-head font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
              <X size={14} /> {t("common.close")}
            </button>
          </div>
        </div>

        <div className="p-6 flex justify-center bg-card">
          {/* 50mm x 30mm sticker */}
          <div id="geraete-label" style={{ width: "50mm", height: "30mm", padding: "2mm", background: "#fff", color: "#000", fontFamily: "'IBM Plex Mono', monospace", display: "flex", alignItems: "center", gap: "2mm", border: "1px solid #000" }}>
            <div style={{ flexShrink: 0, lineHeight: 0 }}>
              <QRCodeCanvas value={order.auftragsnummer} size={92} level="M" includeMargin={false} />
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, letterSpacing: "0.5px", whiteSpace: "nowrap" }}>{order.auftragsnummer}</div>
              <div style={{ fontSize: "9px", marginTop: "1mm", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{order.device_brand} {order.device_model}</div>
              <div style={{ fontSize: "7px", marginTop: "0.5mm", color: "#333" }}>REPARATUR BERLIN</div>
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-border text-[11px] font-mono text-muted-foreground text-center">
          {t("label.hint")}
        </div>
      </div>
    </div>
  );
}
