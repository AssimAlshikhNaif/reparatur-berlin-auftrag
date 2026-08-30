import { QRCodeCanvas } from "qrcode.react";
import { useTranslation } from "react-i18next";
import { Printer, Download, X } from "@phosphor-icons/react";

export default function LabelPrint({ order, onClose }) {
  const { t } = useTranslation();

  // استخراج اسم الفرع من الطلب
  const branchName = order.branch_name || order.branch || "";

  // تنزيل الملصق كصورة PNG مع اسم الفرع
  const handleDownloadImage = () => {
    const canvas = document.getElementById("label-qr-canvas");
    if (!canvas) return;
    
    const tempCanvas = document.createElement("canvas");
    const ctx = tempCanvas.getContext("2d");
    tempCanvas.width = 400; // 50mm approx
    tempCanvas.height = 240; // 30mm approx

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // كتابة اسم الفرع في الأعلى إذا وجد
    if (branchName) {
      ctx.fillStyle = "#000000";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText(branchName, tempCanvas.width / 2, 28);
    }

    const qrImg = new Image();
    qrImg.src = canvas.toDataURL("image/png");
    qrImg.onload = () => {
      const qrSize = 115;
      const xQR = (tempCanvas.width - qrSize) / 2;
      const yQR = branchName ? 35 : 15;
      ctx.drawImage(qrImg, xQR, yQR, qrSize, qrSize);

      ctx.fillStyle = "#000000";
      ctx.font = "bold 22px monospace";
      ctx.textAlign = "center";
      ctx.fillText(order.auftragsnummer, tempCanvas.width / 2, 205);

      const link = document.createElement("a");
      link.download = `Label-${order.auftragsnummer}.png`;
      link.href = tempCanvas.toDataURL("image/png");
      link.click();
    };
  };

  const handlePrint = () => {
    const canvas = document.getElementById("label-qr-canvas");
    if (!canvas) return;
    const qrDataUrl = canvas.toDataURL("image/png");
    
    const printWindow = window.open("", "_blank", "width=400,height=400");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Label-${order.auftragsnummer}</title>
          <style>
            @page {
              size: 30mm 50mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
            }
            body {
              width: 30mm;
              height: 50mm;
              margin: 0;
              padding: 0;
              background: white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: monospace;
              overflow: hidden;
            }
            .label-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              width: 50mm;
              height: 30mm;
              transform: rotate(90deg);
              transform-origin: center center;
              gap: 1px;
            }
            .branch-text {
              font-size: 9px;
              font-weight: bold;
              color: black;
              text-align: center;
              line-height: 1;
            }
            img {
              width: 13mm;
              height: 13mm;
              object-fit: contain;
            }
            .text {
              font-size: 11px;
              font-weight: bold;
              color: black;
              text-align: center;
              line-height: 1;
              letter-spacing: 0.5px;
            }
          </style>
        </head>
        <body>
          <div class="label-container">
            ${branchName ? `<div class="branch-text">${branchName}</div>` : ''}
            <img src="${qrDataUrl}" />
            <div class="text">${order.auftragsnummer}</div>
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
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
              onClick={handleDownloadImage}
              className="flex items-center gap-1 bg-emerald-600 text-white text-xs font-head font-semibold uppercase px-2.5 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors"
              title="تنزيل كصورة لطابعة Phomemo">
              <Download size={14} /> PNG
            </button>
            <button 
              onClick={handlePrint}
              className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-head font-semibold uppercase px-2.5 py-1.5 rounded-lg hover:bg-blue-600 transition-colors">
              <Printer size={14} /> {t("common.print")}
            </button>
            <button 
              onClick={onClose}
              className="flex items-center gap-1 border border-border text-foreground text-xs font-head font-semibold uppercase px-2.5 py-1.5 rounded-lg hover:bg-muted transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* المعاينة الحقيقية للملصق */}
        <div className="p-6 flex justify-center bg-card">
          <div style={{ width: "50mm", height: "30mm", padding: "1mm", background: "#ffffff", color: "#000000", fontFamily: "monospace", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1px", border: "1px solid #ccc" }}>
            {branchName && (
              <div style={{ fontSize: "9px", fontWeight: 700, color: "#000000", textAlign: "center", lineHeight: 1 }}>
                {branchName}
              </div>
            )}
            <div style={{ flexShrink: 0, lineHeight: 0, background: "#ffffff" }}>
              <QRCodeCanvas 
                id="label-qr-canvas"
                value={order.auftragsnummer} 
                size={70} 
                level="M" 
                includeMargin={false} 
                bgColor="#ffffff" 
                fgColor="#000000" 
              />
            </div>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#000000", letterSpacing: "0.5px", whiteSpace: "nowrap", textAlign: "center" }}>
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