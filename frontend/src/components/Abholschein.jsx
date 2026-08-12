import { QRCodeCanvas } from "qrcode.react";
import { jsPDF } from "jspdf";
import { Printer, X, FilePdf } from "@phosphor-icons/react";
import { berlinDateTime, berlinNow } from "@/lib/datetime";

const WAIVER_SLIP = "Haftungsausschluss: Keine Haftung fuer Datenverlust (Datensicherung ist Kundensache), fuer nicht innerhalb 90 Tagen abgeholte Geraete sowie fuer Folgen bestehender Vorschaeden (z.B. Wasser-/Sturzschaden). Mit Unterschrift Geraeteuebergabe u. Bedingungen akzeptiert.";

export default function Abholschein({ order, branchName, onClose }) {
  const printTs = berlinNow();
  const downloadPdf = () => {
    const canvas = document.querySelector("#abholschein canvas");
    const qrData = canvas ? canvas.toDataURL("image/png") : null;
    const doc = new jsPDF({ unit: "mm", format: [80, 210] });
    let y = 8;
    doc.setFont("courier", "bold"); doc.setFontSize(12);
    doc.text("REPARATUR BERLIN", 40, y, { align: "center" }); y += 5;
    doc.setFont("courier", "normal"); doc.setFontSize(8);
    doc.text(branchName, 40, y, { align: "center" }); y += 4;
    doc.text("ABHOLSCHEIN", 40, y, { align: "center" }); y += 4;
    if (qrData) { doc.addImage(qrData, "PNG", 27, y, 26, 26); y += 28; }
    doc.setFont("courier", "bold"); doc.setFontSize(11);
    doc.text(order.auftragsnummer, 40, y, { align: "center" }); y += 6;
    doc.setFont("courier", "normal"); doc.setFontSize(8);
    const line = (l, r) => { doc.text(l, 4, y); doc.text(r, 76, y, { align: "right" }); y += 4; };
    line("Auftrag:", berlinDateTime(order.created_at));
    line("Druck:", berlinNow());
    line("Geraet:", `${order.device_brand} ${order.device_model}`);
    if (order.imei) line("IMEI:", String(order.imei));
    if (order.warranty_months) line("Garantie:", `${order.warranty_months} Monate`);
    y += 2; doc.setFont("courier", "bold"); doc.text("KUNDE", 4, y); y += 4;
    doc.setFont("courier", "normal");
    doc.text(String(order.customer_name || ""), 4, y); y += 4;
    doc.text(String(order.customer_phone || ""), 4, y); y += 5;
    doc.setFont("courier", "bold"); doc.text("FEHLER", 4, y); y += 4;
    doc.setFont("courier", "normal");
    const wrapped = doc.splitTextToSize(order.issue_description || "", 72);
    doc.text(wrapped, 4, y); y += wrapped.length * 4 + 2;
    if (order.cost) {
      doc.setFont("courier", "normal");
      line("Netto:", `${Number(order.cost.net).toFixed(2)} EUR`);
      line("MwSt 19%:", `${Number(order.cost.tax).toFixed(2)} EUR`);
      doc.setFont("courier", "bold");
      line("GESAMT:", `${Number(order.cost.gross).toFixed(2)} EUR`);
    }
    // Liability waiver
    y += 2; doc.setFont("courier", "bold"); doc.setFontSize(7);
    doc.text("HAFTUNGSAUSSCHLUSS", 4, y); y += 3;
    doc.setFont("courier", "normal"); doc.setFontSize(6);
    const wv = doc.splitTextToSize(WAIVER_SLIP, 72);
    doc.text(wv, 4, y); y += wv.length * 2.6 + 3;
    // Signature
    doc.setFontSize(8);
    if (order.intake_signature) {
      try { doc.addImage(order.intake_signature, "PNG", 4, y, 40, 14); } catch (e) { /* ignore */ }
      y += 15;
    } else {
      y += 6;
    }
    doc.setLineWidth(0.2); doc.line(4, y, 50, y); y += 3;
    doc.text("Unterschrift Kunde", 4, y); y += 5;
    doc.save(`${order.auftragsnummer}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-background border border-border max-w-md w-full">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-head font-semibold text-sm">Abholschein · 80mm</h3>
          <div className="flex items-center gap-2">
            <button data-testid="print-receipt-button" onClick={() => window.print()}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-xs font-head font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-blue-600 hover:text-primary-foreground transition-colors">
              <Printer size={14} /> Drucken
            </button>
            <button data-testid="download-pdf-button" onClick={downloadPdf}
              className="flex items-center gap-2 border border-border text-foreground text-xs font-head font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
              <FilePdf size={14} /> PDF
            </button>
            <button data-testid="close-receipt-button" onClick={onClose} className="text-muted-foreground hover:text-primary-foreground">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Preview area (dark) wrapping the printable white slip */}
        <div className="p-6 flex justify-center bg-card">
          <div id="abholschein" style={{ width: "80mm", padding: "4mm", fontFamily: "'IBM Plex Mono', monospace", background: "#ffffff", color: "#000000" }}>
            <div style={{ textAlign: "center", borderBottom: "1px dashed #000", paddingBottom: "3mm", marginBottom: "3mm" }}>
              <div style={{ fontWeight: 700, fontSize: "13px", letterSpacing: "1px" }}>REPARATUR BERLIN</div>
              <div style={{ fontSize: "9px" }}>{branchName}</div>
              <div style={{ fontSize: "9px" }}>ABHOLSCHEIN</div>
            </div>

            <div style={{ textAlign: "center", margin: "2mm 0" }}>
              <QRCodeCanvas value={order.auftragsnummer} size={120} level="M" includeMargin={false} />
              <div style={{ fontSize: "13px", fontWeight: 700, marginTop: "2mm" }}>{order.auftragsnummer}</div>
            </div>

            <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginTop: "2mm", fontSize: "10px", lineHeight: 1.6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Auftrag:</span><span>{berlinDateTime(order.created_at)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Druckdatum:</span><span>{printTs}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Gerät:</span><span>{order.device_brand} {order.device_model}</span></div>
              {order.imei ? <div style={{ display: "flex", justifyContent: "space-between" }}><span>IMEI:</span><span>{order.imei}</span></div> : (order.imei_unreadable ? <div style={{ display: "flex", justifyContent: "space-between" }}><span>IMEI:</span><span>nicht lesbar</span></div> : null)}
              {order.warranty_months ? <div style={{ display: "flex", justifyContent: "space-between" }}><span>Garantie:</span><span>{order.warranty_months} Monate</span></div> : null}
            </div>

            <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginTop: "2mm", fontSize: "10px", lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, marginBottom: "1mm" }}>KUNDE</div>
              <div>{order.customer_name}</div>
              <div>{order.customer_phone}</div>
            </div>

            <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginTop: "2mm", fontSize: "10px", lineHeight: 1.5 }}>
              <div style={{ fontWeight: 700, marginBottom: "1mm" }}>FEHLER</div>
              <div>{order.issue_description}</div>
            </div>

            {order.cost && (
              <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginTop: "2mm", fontSize: "10px", lineHeight: 1.6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Netto:</span><span>{Number(order.cost.net).toFixed(2)} €</span></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span>MwSt. 19%:</span><span>{Number(order.cost.tax).toFixed(2)} €</span></div>
                <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "11px" }}><span>GESAMT:</span><span>{Number(order.cost.gross).toFixed(2)} €</span></div>
              </div>
            )}

            <div style={{ borderTop: "1px dashed #000", paddingTop: "2mm", marginTop: "2mm", fontSize: "7px", lineHeight: 1.45 }}>
              <div style={{ fontWeight: 700, marginBottom: "1mm", fontSize: "8px" }}>HAFTUNGSAUSSCHLUSS</div>
              <div>{WAIVER_SLIP}</div>
            </div>

            <div style={{ paddingTop: "6mm", marginTop: "2mm", fontSize: "9px" }}>
              {order.intake_signature ? (
                <img src={order.intake_signature} alt="Unterschrift" style={{ maxHeight: "16mm", display: "block" }} />
              ) : null}
              <div style={{ borderTop: "1px solid #000", width: "50mm", marginTop: "1mm", paddingTop: "1mm" }}>
                Unterschrift Kunde{order.intake_signed_name ? ` (${order.intake_signed_name})` : ""}
              </div>
            </div>

            <div style={{ borderTop: "1px dashed #000", paddingTop: "3mm", marginTop: "3mm", fontSize: "8px", textAlign: "center", lineHeight: 1.5 }}>
              Bitte diesen Schein zur Abholung vorlegen.<br />
              Aufbewahrungspflicht des Kunden.<br />
              Vielen Dank für Ihren Auftrag!
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
