import { QRCodeCanvas } from "qrcode.react";
import { jsPDF } from "jspdf";
import { Printer, X, FilePdf } from "@phosphor-icons/react";
import { berlinDateTime, berlinNow } from "@/lib/datetime";
import { fileUrl } from "@/lib/api";
import { WAIVER_BULLETS } from "@/lib/constants";

export default function Abholschein({ order, branchName, branchInfo, onClose }) {
  const printTs = berlinNow();

  const resolvedBranchName = branchInfo?.name || order?.branch_name || order?.branch?.name || branchName || "Reparatur Berlin";

  const getBranchLogo = () => {
    const rawLogo = branchInfo?.logo_url || branchInfo?.logo || order?.branch?.logo_url || order?.branch?.logo;
    if (rawLogo) {
      return rawLogo.startsWith("http") || rawLogo.startsWith("/") || rawLogo.startsWith("blob:") || rawLogo.startsWith("data:image") ? rawLogo : fileUrl(rawLogo);
    }
    const branchLogosMap = {
      "Praxis Smartphone": "/logos/handy_laptop_praxi-removebg-preview.png",
      "Phone Store Mobile": "/logos/phone-store-mobile.png",
      "A 10 center": "/logos/linden A10.png",
    };
    return branchLogosMap[resolvedBranchName] || "";
  };

  const shopLogo = getBranchLogo();

  const currentShop = {
    name: resolvedBranchName,
    email: branchInfo?.email || order?.branch?.email || "",
    whatsapp: branchInfo?.whatsapp || order?.branch?.whatsapp || "",
    logo_url: shopLogo,
  };

  const feeD = Number(order?.cost?.diagnosis_fee ?? order?.diagnosis_fee) || 0;
  const feeL = Number(order?.cost?.labor_cost ?? order?.labor_cost) || 0;
  const feeP = Number(order?.cost?.parts_cost ?? order?.parts_cost) || 0;
  
  const billingMode = order?.diagnosis_payment_status || "OPEN"; 

  // 1. حساب الإجمالي (Gesamt / Brutto) كأصل للمبلغ المدخل بناءً على الحالة
  let grossVal = 0;
  if (billingMode === "OPEN" || billingMode === "diag_and_repair") {
    grossVal = feeD + feeL + feeP;
  } else if (billingMode === "PAID" || billingMode === "repair_only") {
    grossVal = feeL + feeP;
  } else if (billingMode === "NA" || billingMode === "diag_only") {
    grossVal = feeD;
  }
  
  // إذا لم تكن التكاليف مفصلة ولكن الـ gross موجود في الـ order
  if (grossVal === 0 && order?.cost?.gross) {
    grossVal = Number(order.cost.gross) || 0;
  }
  grossVal = Number(grossVal.toFixed(2));

  // 2. استخراج النيتو والضريبة بالطريقة العكسية (القسمة على 1.19)
  const liveNet = Number((grossVal / 1.19).toFixed(2));
  const liveTax = Number((grossVal - liveNet).toFixed(2));
  const nettoVal = liveNet;
  const taxVal = liveTax;

  const anzahlungVal = Number(order?.cost?.anzahlung ?? order?.anzahlung) || 0;
  const restVal = Number(Math.max(0, grossVal - anzahlungVal).toFixed(2));
  
  const isDiagPaid = order?.is_diagnosis_paid_at_intake === true;
  const diagLabel = billingMode === "PAID" || billingMode === "repair_only" ? "ERLASSEN" : isDiagPaid ? "BEZAHLT" : "NICHT BEZAHLT";
  const payStatus = grossVal > 0 && restVal <= 0 ? "Bezahlt" : anzahlungVal > 0 ? "Teilweise" : "Nicht bezahlt";

  // طباعة المعاينة عبر نافذة منبثقة
  const handlePrint = () => {
    const canvas = document.querySelector("#abholschein canvas");
    const qrDataUrl = canvas ? canvas.toDataURL("image/png") : null;

    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) {
      alert("Bitte erlauben Sie Pop-ups für den Druck.");
      return;
    }
    const tempContainer = document.createElement("div");
    tempContainer.innerHTML = document.getElementById("abholschein").innerHTML;

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
        * { box-sizing: border-box; }
        body {
          font-family: 'Courier New', Courier, monospace;
          width: 80mm;
          margin: 0;
          padding: 0;
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
      <div style="width: 80mm; margin: 0; padding: 0;">
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

  // توليد وتحميل PDF
  const downloadPdf = async () => {
    const canvas = document.querySelector("#abholschein canvas");
    const qrData = canvas ? canvas.toDataURL("image/png") : null;
    const doc = new jsPDF({ unit: "mm", format: [80, 210] });
    let y = 8;

    if (shopLogo) {
      try {
        const img = new Image();
        img.src = shopLogo;
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
        });

        if (img.width && img.height) {
          const maxW = 35;
          const maxH = 14;
          let imgW = maxW;
          let imgH = (img.height * maxW) / img.width;

          if (imgH > maxH) {
            imgH = maxH;
            imgW = (img.width * maxH) / img.height;
          }

          const xPos = (80 - imgW) / 2;
          doc.addImage(shopLogo, "PNG", xPos, y, imgW, imgH);
          y += imgH + 3;
        }
      } catch (e) {
        // الاستمرار في التوليد إذا تعذر تحميل اللوغو
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

    if (order?.cost || grossVal > 0) {
      doc.setFont("courier", "normal");
      line("Netto:", nettoVal.toFixed(2) + " EUR");
      line("MwSt 19%:", taxVal.toFixed(2) + " EUR");
      doc.setFont("courier", "bold");
      line("GESAMT:", grossVal.toFixed(2) + " EUR");
      doc.setFont("courier", "normal");

      if (anzahlungVal > 0) {
        line("Anzahlung:", `-${anzahlungVal.toFixed(2)} EUR`);
      }

      if (feeD > 0 || billingMode === "NA" || billingMode === "OPEN") {
        line("Diagnose-Geb.:", diagLabel);
      }

      doc.setFont("courier", "bold");
      line("Restbetrag:", `${restVal.toFixed(2)} EUR`);
      doc.setFont("courier", "normal");
      line("Status:", payStatus);
    }

    y += 2; doc.setFont("courier", "bold"); doc.setFontSize(7);
    doc.text("HAFTUNGSAUSSCHLUSS", 40, y, { align: "center" }); y += 3;
    doc.setFont("courier", "normal"); doc.setFontSize(6);
    WAIVER_BULLETS.forEach((b) => {
      const wb = doc.splitTextToSize("- " + b, 72);
      doc.text(wb, 4, y); y += wb.length * 2.6 + 0.6;
    });

    y += 2;
    const noticeText = order?.status === "ANGENOMMEN"
      ? "* Hinweis: Der genannte Betrag ist ein unverbindlicher Kostenvoranschlag. Zusätzliche Reparaturkosten werden erst nach Rücksprache berechnet."
      : "* Vielen Dank für Ihren Auftrag! Alle Beträge inkl. 19% MwSt.";
    const noticeWrapped = doc.splitTextToSize(noticeText, 72);
    doc.text(noticeWrapped, 4, y); y += noticeWrapped.length * 3 + 2;

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
              {shopLogo && (
                <img src={shopLogo} alt="Logo" style={{ maxHeight: "35px", maxWidth: "110px", objectFit: "contain", margin: "0 auto 4px", display: "block" }} />
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

            {(order?.cost || grossVal > 0) && (
              <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginTop: "2mm", fontSize: "10px", lineHeight: 1.6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Netto:</span><span>{nettoVal.toFixed(2)} €</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>MwSt. 19%:</span><span>{taxVal.toFixed(2)} €</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "11px" }}><span>GESAMT:</span><span>{grossVal.toFixed(2)} €</span></div>

                {anzahlungVal > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#0066cc" }}><span>Anzahlung:</span><span>-{anzahlungVal.toFixed(2)} €</span></div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1mm" }}>
                  <span>Diagnose-Gebühr:</span>
                  <span data-testid="abholschein-diagnose-status" style={{ fontWeight: 700, color: diagLabel === "NICHT BEZAHLT" ? "#cc0000" : "#008800" }}>
                    {diagLabel}
                  </span>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "11px", borderTop: "1px solid #000", marginTop: "1mm", paddingTop: "1mm" }}>
                  <span>Restbetrag:</span><span>{restVal.toFixed(2)} €</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", marginTop: "1mm" }}>
                  <span>Zahlungsstatus:</span><span>{payStatus}</span>
                </div>
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

            <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginTop: "2mm", fontSize: "7.5px", lineHeight: 1.4, textAlign: "center" }}>
              {order?.status === "ANGENOMMEN" ? (
                <span>* Der genannte Betrag ist ein unverbindlicher Kostenvoranschlag. Zusätzliche Reparaturkosten werden erst nach Absprache berechnet.</span>
              ) : (
                <span>* Vielen Dank für Ihren Auftrag! Alle Beträge inkl. 19% MwSt.</span>
              )}
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