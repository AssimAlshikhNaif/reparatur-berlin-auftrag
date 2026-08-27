import { QRCodeCanvas } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { Printer, X } from "@phosphor-icons/react";

export default function LabelPrint({ order, onClose }) {
  const { t } = useTranslation();

  const handlePrint = () => {
    // 1. توليد الـ Data URL للـ QR Code مباشرة من عنصر مؤقت
    const canvas = document.getElementById("label-qr-canvas");
    if (!canvas) return;
    const qrDataUrl = canvas.toDataURL("image/png");

    // 2. إنشاء طابعة إطار مخفية (Hidden Iframe) لضمان التوافق التام مع المتصفحات
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Label - ${order.auftragsnummer}</title>
          <style>
            @page {
              size: 50mm 30mm;
              margin: 0;
            }
            body, html {
              margin: 0;
              padding: 0;
              width: 50mm;
              height: 30mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background-color: #ffffff;
              font-family: monospace;
            }
            .label-box {
              width: 50mm;
              height: 30mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              gap: 1.5mm;
              background: #ffffff;
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            .label-box img {
              width: 22mm;
              height: 22mm;
              object-fit: contain;
            }
            .label-text {
              font-size: 12px;
              font-weight: bold;
              color: #000000;
              letter-spacing: 0.5px;
              white-space: nowrap;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="label-box">
            <img src="${qrDataUrl}" alt="QR" />
            <div class="label-text">${order.auftragsnummer}</div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() {
                  window.frameElement.remove();
                }, 500);
              }, 200);
            };
          </script>
        </body>
      </html>
    `);
    doc.close();
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

        {/* معاينة حقيقية للملصق داخل النافذة */}
        <div className="p-6 flex justify-center bg-card">
          <div style={{ width: "50mm", height: "30mm", padding: "1mm", background: "#ffffff", color: "#000000", fontFamily: "monospace", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5mm", border: "1px solid #ccc" }}>
            <div style={{ flexShrink: 0, lineHeight: 0, background: "#ffffff" }}>
              <QRCodeCanvas 
                id="label-qr-canvas"
                value={order.auftragsnummer} 
                size={120} 
                level="M" 
                includeMargin={false} 
                bgColor="#ffffff" 
                fgColor="#000000" 
              />
            </div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#000000", letterSpacing: "0.5px", whiteSpace: "nowrap", textAlign: "center" }} data-testid="label-order-number">
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