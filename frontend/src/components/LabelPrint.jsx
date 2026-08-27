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
          /* إخفاء كل عناصر الصفحة تماماً عند الطباعة */
          body * {
            display: none !important;
          }
          /* إظهار عنصر الملصق فقط وتثبيته بالمقاسات الدقيقة لعدم تكرار الصفحات */
          #geraete-label, #geraete-label * {
            display: flex !important;
            visibility: visible !important;
          }
          #geraete-label {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 50mm !important;
            height: 30mm !important;
            margin: 0 !important;
            padding: 1mm !important;
            box-sizing: border-box !important;
            background: #ffffff !important;
            z-index: 999999 !important;
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
            {/* 50mm x 30mm sticker - مع خلفية بيضاء صريحة لمنع الطباعة السوداء */}
            <div id="geraete-label" style={{ width: "50mm", height: "30mm", padding: "1mm", background: "#ffffff", color: "#000000", fontFamily: "'IBM Plex Mono', monospace", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5mm" }}>
              <div style={{ flexShrink: 0, lineHeight: 0, background: "#ffffff" }}>
                <QRCodeCanvas value={order.auftragsnummer} size={70} level="M" includeMargin={false} bgColor="#ffffff" fgColor="#000000" />
              </div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#000000", letterSpacing: "0.5px", whiteSpace: "nowrap", textAlign: "center" }} data-testid="label-order-number">{order.auftragsnummer}</div>
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