import { QRCodeCanvas } from "qrcode.react";
import { jsPDF } from "jspdf";
import { Printer, X, FilePdf } from "@phosphor-icons/react";
import { berlinDateTime, berlinNow } from "@/lib/datetime";
import { WAIVER_BULLETS } from "@/lib/constants";

export default function Abholschein({ order, branchName, branchInfo, onClose }) {
  const printTs = berlinNow();

 // 1. خريطة تربط كل فرع باللوغو الخاص به حسب اسمه الصحيح
const branchLogos = {
  "Praxis Smartphone": "/logos/handy_laptop_praxi-removebg-preview.png",
  // أضف أي فرع آخر هنا مستقبلاً بهذه الطريقة:
  // "اسم الفرع الثاني": "/logos/اسم_صورة_الفرع_الثاني.png"
};

const resolvedBranchName = branchInfo?.name || branchName || "Smartphone Apotheke";

// 2. كود المتجر الذي سيختار اللوغو تلقائياً للفرع الحالي
const currentShop = {
  name: resolvedBranchName,
  email: branchInfo?.email || "info@smartphone-apotheke.de",
  whatsapp: branchInfo?.whatsapp || "+491782931142",
  logo_url: branchLogos[resolvedBranchName] || "/logos/logo-icon.png",
};

  // دالة ذكية لتحديد رابط اللوغو تلقائياً (تعمل محلياً ومع سيرفر Hetzner دون تعديل)
  const getFullLogoUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}${url.startsWith("/") ? "" : "/"}${url}`;
  };

  const shopLogo = getFullLogoUrl(currentShop.logo_url);

  // حل جذري للطباعة: فتح نافذة مستقلة نظيفة 100% تحتوي على الإيصال وحده دون أي شوائب أو تكرار
  const handlePrint = () => {
    // التقاط الـ QR Code وتحويله إلى صورة Base64 لضمان ظهوره في النافذة الجديدة
    const canvas = document.querySelector("#abholschein canvas");
    const qrDataUrl = canvas ? canvas.toDataURL("image/png") : null;

    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) {
      alert("Bitte erlauben Sie Pop-ups für den Druck.");
      return;
    }

    // استنساخ محتوى الإيصال وتعديل الـ QR Code بداخله ليصبح صورة حقيقية
    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = document.getElementById("abholschein").innerHTML;
    
    // البحث عن مكان الـ QR واستبداله بالصورة إن وجد
    const qrContainer = tempContainer.querySelector("canvas")?.parentElement;
    if (qrContainer && qrDataUrl) {
      qrContainer.innerHTML = `<img src="${qrDataUrl}" alt="QR Code" style="width: 120px; height: 120px; display: block; margin: 0 auto;" />`;
    }

    const receiptHTML = tempContainer.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Abholschein - ${order?.auftragsnummer || ""}</title>
          <style>
            * {
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 80mm;
              margin: 0 auto;
              padding: 2mm;
              background: #fff;
              color: #000;
            }
            @page {
              size: 80mm auto;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div style="width: 80mm; margin: 0 auto;">
            ${receiptHTML}
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const downloadPdf = () => {
    const canvas = document.querySelector("#abholschein canvas");
    const qrData = canvas ? canvas.toDataURL("image/png") : null;
    const doc = new jsPDF({ unit: "mm", format: [80, 210] });
    let y = 8;

    // إضافة اللوجو في الـ PDF إذا كان متوفراً ودعم السيرفر
    if (shopLogo) {
      try {
        doc.addImage(shopLogo, "PNG", 25, y, 30, 12);
        y += 14;
      } catch (e) {
        // تجاهل الخطأ في حال تعذر تحميل الصورة
      }
    }

    doc.setFont("courier", "bold"); doc.setFontSize(11);
    doc.text(currentShop.name.toUpperCase(), 40, y, { align: "center" }); y += 5;
    
    doc.setFont("courier", "normal"); doc.setFontSize(7);
    if (currentShop.whatsapp) {
      doc.text(`WhatsApp: ${currentShop.whatsapp}`, 40, y, { align: "center" }); 
      y += 3.5;
    }
    if (currentShop.email) {
      doc.text(`E-Mail: ${currentShop.email}`, 40, y, { align: "center" }); 
      y += 3.5;
    }

    doc.setFont("courier", "bold"); doc.setFontSize(9);
    doc.text("ABHOLSCHEIN", 40, y, { align: "center" }); y += 4;
    
    if (qrData) { doc.addImage(qrData, "PNG", 27, y, 26, 26); y += 28; }
    
    doc.setFont("courier", "bold"); doc.setFontSize(11);
    doc.text(order?.auftragsnummer || "", 40, y, { align: "center" }); y += 6;
    
    doc.setFont("courier", "normal"); doc.setFontSize(8);
    const line = (l, r) => { doc.text(l, 4, y); doc.text(r, 76, y, { align: "right" }); y += 4; };
    line("Auftrag:", order?.created_at ? berlinDateTime(order.created_at) : "—");
    line("Druck:", printTs);
    line("Geraet:", `${order?.device_brand || ""} ${order?.device_model || ""}`);
    if (order?.imei) line("IMEI:", String(order.imei));
    if (order?.warranty_months) line("Garantie:", `${order.warranty_months} Monate`);
    
    y += 2; doc.setFont("courier", "bold"); doc.text("KUNDE", 4, y); y += 4;
    doc.setFont("courier", "normal");
    doc.text(String(order?.customer_name || ""), 4, y); y += 4;
    doc.text(String(order?.customer_phone || ""), 4, y); y += 5;
    
    doc.setFont("courier", "bold"); doc.text("FEHLER", 4, y); y += 4;
    doc.setFont("courier", "normal");
    const wrapped = doc.splitTextToSize(order?.issue_description || "", 72);
    doc.text(wrapped, 4, y); y += wrapped.length * 4 + 2;
    
    if (order?.cost) {
      doc.setFont("courier", "normal");
      line("Netto:", `${Number(order.cost.net || 0).toFixed(2)} EUR`);
      line("MwSt 19%:", `${Number(order.cost.tax || 0).toFixed(2)} EUR`);
      doc.setFont("courier", "bold");
      line("GESAMT:", `${Number(order.cost.gross || 0).toFixed(2)} EUR`);
    }
    
    y += 2; doc.setFont("courier", "bold"); doc.setFontSize(7);
    doc.text("HAFTUNGSAUSSCHLUSS", 40, y, { align: "center" }); y += 3;
    doc.setFont("courier", "normal"); doc.setFontSize(6);
    WAIVER_BULLETS.forEach((b) => {
      const wb = doc.splitTextToSize("- " + b, 72);
      doc.text(wb, 4, y); y += wb.length * 2.6 + 0.6;
    });
    
    y += 2;
    doc.setFontSize(8);
    if (order?.intake_signature) {
      try { doc.addImage(order.intake_signature, "PNG", 4, y, 40, 14); } catch (e) { /* ignore */ }
      y += 15;
    } else {
      y += 6;
    }
    doc.setLineWidth(0.2); doc.line(4, y, 50, y); y += 3;
    doc.text("Unterschrift Kunde", 4, y); y += 5;
    doc.save(`${order?.auftragsnummer || "auftrag"}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-background border border-border max-w-md w-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-head font-semibold text-sm">Abholschein · 80mm</h3>
          <div className="flex items-center gap-2">
            <button data-testid="print-receipt-button" onClick={handlePrint}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-xs font-head font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors">
              <Printer size={14} /> Drucken
            </button>
            <button data-testid="download-pdf-button" onClick={downloadPdf}
              className="flex items-center gap-2 border border-border text-foreground text-xs font-head font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
              <FilePdf size={14} /> PDF
            </button>
            <button data-testid="close-receipt-button" onClick={onClose} aria-label="Schließen" className="text-muted-foreground hover:text-foreground">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-6 flex justify-center bg-card max-h-[80vh] overflow-y-auto">
          <div id="abholschein" style={{ width: "80mm", padding: "4mm", fontFamily: "'Courier New', Courier, monospace", background: "#ffffff", color: "#000000" }}>

            {order.status === "STORNIERT" && (
              <div data-testid="print-canceled-banner" style={{
                textAlign: "center", border: "2px solid #c00", color: "#c00",
                fontWeight: 700, fontSize: "13px", letterSpacing: "2px",
                padding: "2mm", marginBottom: "3mm", transform: "rotate(-2deg)",
              }}>
                STORNIERT
                {order.cancel_reason && (
                  <div style={{ fontWeight: 400, fontSize: "8px", letterSpacing: "normal", marginTop: "1mm" }}>
                    Grund: {order.cancel_reason}
                  </div>
                )}
              </div>
            )}
            
            <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: "3mm", marginBottom: "3mm" }}>
              {/* عرض اللوغو ديناميكياً على السيرفر ومحلياً */}
              {shopLogo && (
                <img src={shopLogo} alt="Logo" style={{ maxHeight: "40px", maxWidth: "120px", objectFit: "contain", margin: "0 auto 4px", display: "block" }} />
              )}
              <div style={{ fontWeight: 700, fontSize: "12px", letterSpacing: "1px" }}>{currentShop.name}</div>
              {currentShop.whatsapp && <div style={{ fontSize: "8px" }}>WhatsApp: {currentShop.whatsapp}</div>}
              {currentShop.email && <div style={{ fontSize: "8px" }}>{currentShop.email}</div>}
              <div style={{ fontSize: "9px", marginTop: "2px", fontWeight: "bold" }}>ABHOLSCHEIN</div>
            </div>

            <div style={{ textAlign: "center", margin: "2mm 0" }}>
              <QRCodeCanvas value={order?.auftragsnummer || ""} size={120} level="M" includeMargin={false} />
              <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "2mm" }}>{order?.auftragsnummer}</div>
            </div>

            <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginTop: "2mm", fontSize: "10px", lineHeight: 1.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Auftrag:</span><span>{order?.created_at ? berlinDateTime(order.created_at) : "—"}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Druckdatum:</span><span>{printTs}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Gerät:</span><span>{order?.device_brand} {order?.device_model}</span></div>
              {order?.imei ? <div style={{ display: "flex", justifyContent: "space-between" }}><span>IMEI:</span><span>{order.imei}</span></div> : (order?.imei_unreadable ? <div style={{ display: "flex", justifyContent: "space-between" }}><span>IMEI:</span><span>nicht lesbar</span></div> : null)}
              {order?.warranty_months ? <div style={{ display: "flex", justifyContent: "space-between" }}><span>Garantie:</span><span>{order.warranty_months} Monate</span></div> : null}
            </div>

            <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginTop: "2mm", fontSize: "10px", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, marginBottom: "1mm" }}>KUNDE</div>
              <div>{order?.customer_name}</div>
              <div>{order?.customer_phone}</div>
            </div>

            <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginTop: "2mm", fontSize: "10px", lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, marginBottom: "1mm" }}>FEHLER</div>
              <div>{order?.issue_description}</div>
            </div>

            {order?.cost && (
              <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginTop: "2mm", fontSize: "10px", lineHeight: 1.6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Netto:</span><span>{Number(order.cost.net || 0).toFixed(2)} €</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>MwSt. 19%:</span><span>{Number(order.cost.tax || 0).toFixed(2)} €</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "11px" }}><span>GESAMT:</span><span>{Number(order.cost.gross || 0).toFixed(2)} €</span></div>
              </div>
            )}

            <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginTop: "2mm", fontSize: "7px", lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, marginBottom: "1.5mm", fontSize: "8px", textAlign: "center", letterSpacing: "0.5px" }}>HAFTUNGSAUSSCHLUSS</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, maxWidth: "72mm" }}>
                {WAIVER_BULLETS.map((b, i) => (
                  <li key={i} style={{ display: "flex", gap: "1.5mm", marginBottom: "1mm", textAlign: "left", alignItems: "flex-start" }}>
                    <span style={{ fontWeight: 700, flexShrink: 0 }}>•</span><span style={{ wordBreak: "break-word" }}>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ paddingTop: "6mm", marginTop: "2mm", fontSize: "9px" }}>
              {order?.intake_signature ? (
                <img src={order.intake_signature} alt="Unterschrift" style={{ maxHeight: "16mm", display: "block" }} />
              ) : null}
              <div style={{ borderTop: "1px solid #000", width: "50mm", marginTop: "1mm", paddingTop: "1mm" }}>
                Unterschrift Kunde{order?.intake_signed_name ? ` (${order.intake_signed_name})` : ""}
              </div>
            </div>

            <div style={{ borderTop: "1px dashed #000", paddingTop: "3mm", marginTop: "3mm", fontSize: "8px", textAlign: "center", lineHeight: 1.5 }}>
              Bitte diesen Schein zur Abholung vorlegen.<br />
              Aufbewahrungspflicht des Kunden.<br />
              Vielen Dank für Ihren Auftrag!
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button data-testid="footer-print-button" onClick={handlePrint}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-xs font-head font-semibold uppercase tracking-wider px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
            <Printer size={14} /> Drucken
          </button>
          <button data-testid="footer-close-button" onClick={onClose}
            className="flex items-center gap-2 border border-border text-foreground text-xs font-head font-semibold uppercase tracking-wider px-4 py-2 rounded-lg hover:bg-muted transition-colors">
            <X size={14} /> Schließen
          </button>
        </div>
      </div>
    </div>
  );
}