import { QRCodeCanvas } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { Printer, X } from "@phosphor-icons/react";

export default function LabelPrint({ order, onClose }) {
  const { t } = useTranslation();

  const handlePrint = () => {
    const canvas = document.getElementById("label-qr-canvas");
    if (!canvas) return;
    const qrDataUrl = canvas.toDataURL("image/png");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Label-${order.auftragsnummer}</title>
          <style>
            @page {
              size: 50mm 30mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body, html {
              width: 50mm;
              height: 30mm;
              background: #ffffff;
              font-family: monospace;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .label-sheet {
              width: 50mm;
              height: 30mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background: #ffffff;
              padding: 1mm;
            }
            .label-sheet img {
              width: 18mm;
              height: 18mm;
              object-fit: contain;
              margin-bottom: 1mm;
            }
            .label-text {
              font-size: 11px;
              font-weight: bold;
              color: #000000;
              letter-spacing: 0.5px;
              white-space: nowrap;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="label-sheet">
            <img src="${qrDataUrl}" alt="QR" />
            <div class="label-text">${order.auftragsnummer}</div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 300);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border w-full max-w-sm shadow-lg rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-head font-semibold text-sm">{t("label.title")}</h3>
          <div className="flex items-center gap-2">
            <button 
              data-testid="label-print-button" 
              onClick={handlePrint}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-xs font-head font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors">
              <Printer size={14} /> {t("common.print")}
            </button>
            <button 
              data-testid="label-close-button" 
              onClick={onClose}
              className="flex items-center gap-2 border border-border text-foreground text-xs font-head font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
              <X size={14} /> {t("common.close")}
            </button>
          </div>
        </div>

        {/* معاينة الملصق بالمقاس الحقيقي داخل النافذة */}
        <div className="p-6 flex justify-center bg-card">
          <div style={{ width: "50mm", height: "30mm", padding: "1mm", background: "#ffffff", color: "#000000", fontFamily: "monospace", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1mm", border: "1px solid #ccc" }}>
            <div style={{ flexShrink: 0, lineHeight: 0, background: "#ffffff" }}>
              <QRCodeCanvas 
                id="label-qr-canvas"
                value={order.auftragsnummer} 
                size={85} 
                level="M" 
                includeMargin={false} 
                bgColor="#ffffff" 
                fgColor="#000000" 
              />
            </div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#000000", letterSpacing: "0.5px", whiteSpace: "nowrap", textAlign: "center" }} data-testid="label-order-number">
              {order.auftragsnummer}
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