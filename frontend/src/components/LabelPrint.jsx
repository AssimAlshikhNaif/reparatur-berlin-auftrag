import { useEffect } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { Printer, X } from "@phosphor-icons/react";

export default function LabelPrint({ order, onClose }) {
  const { t } = useTranslation();

  useEffect(() => {
    const after = () => { if (onClose) onClose(); };
    window.addEventListener("afterprint", after);
    return () => window.removeEventListener("afterprint", after);
  }, [onClose]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #geraete-label, #geraete-label * {
            visibility: visible !important;
          }
          #geraete-label {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 50mm !important;
            height: 30mm !important;
            margin: 0 !important;
            padding: 1.5mm !important;
            border: none !important;
            box-sizing: border-box !important;
          }
          @page {
            size: 50mm 30mm;
            margin: 0;
          }
        }
      `}} />

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
            {/* 50mm x 30mm sticker - Vertical layout (QR on top, Text below centered) */}
            <div id="geraete-label" style={{ width: "50mm", height: "30mm", padding: "1.5mm", background: "#fff", color: "#000", fontFamily: "'IBM Plex Mono', monospace", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "2mm", border: "1px solid #000" }}>
              <div style={{ flexShrink: 0, lineHeight: 0 }}>
                <QRCodeCanvas value={order.auftragsnummer} size={65} level="M" includeMargin={false} />
              </div>
              <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.5px", whiteSpace: "nowrap", textAlign: "center" }} data-testid="label-order-number">{order.auftragsnummer}</div>
            </div>
          </div>
          <div className="px-4 py-3 border-t border-border text-[11px] font-mono text-muted-foreground text-center">
            {t("label.hint")}
          </div>
        </div>
      </div>
    </>
  );
}