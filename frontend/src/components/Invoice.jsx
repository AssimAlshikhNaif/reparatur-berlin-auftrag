import { useEffect, useState } from "react";
import api from "@/lib/api";
import { jsPDF } from "jspdf";
import { Printer, X, FilePdf } from "@phosphor-icons/react";
import { berlinDateTime, berlinNow } from "@/lib/datetime";
import { SHOP_INFO } from "@/lib/constants";
import { berlinDate } from "@/lib/datetime";

export default function Invoice({ order: initialOrder, branchName, onClose }) {
  const [order, setOrder] = useState(initialOrder);
  const [branch, setBranch] = useState(null);
  const cost = order.cost || {};
  const parts = order.used_parts || [];
  const invoiceNo = order.invoice_number || order.auftragsnummer;
  const shop = {
    name: branch?.name || SHOP_INFO.name,
    address: branch?.address || `${SHOP_INFO.addressLine1}, ${SHOP_INFO.addressLine2}`,
    phone: branch?.phone || SHOP_INFO.phone,
    email: branch?.email || SHOP_INFO.email,
    taxNumber: branch?.tax_number || SHOP_INFO.taxNumber,
    steuernummer: branch?.steuernummer || SHOP_INFO.steuernummer,
    city: branch?.city || "Berlin",
    logo_url: branch?.logo_url || "",
  };
  const ortDatumShort = `${shop.city}, ${order.invoice_date ? berlinDate(order.invoice_date) : berlinDate()}`;
  const customerSignature = order.pickup_signature || order.intake_signature || null;

  useEffect(() => {
    let active = true;
    api.post(`/orders/${initialOrder.id}/invoice`)
      .then((r) => { if (active) setOrder(r.data); })
      .catch(() => {});
    api.get("/branches")
      .then((r) => { if (active) setBranch((r.data || []).find((b) => b.id === initialOrder.branch_id) || null); })
      .catch(() => {});
    return () => { active = false; };
  }, [initialOrder.id, initialOrder.branch_id]);

  useEffect(() => {
    const handleAfterPrint = () => { if (onClose) onClose(); };
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, [onClose]);

  const handlePrint = () => window.print();

  const downloadPdf = () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    let y = 16;

    // تضمين اللوجو في ملف الـ PDF إذا كان متوفراً
    if (shop.logo_url) {
      try {
        doc.addImage(shop.logo_url, "PNG", 14, y, 35, 14);
        y += 18;
      } catch (e) {
        // تجاهل الخطأ في حال تعذر تحميل الصورة
      }
    }

    doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text(shop.name, 14, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(shop.address, 14, y); y += 4;
    doc.text(`${shop.phone} · ${shop.email}`, 14, y); y += 4;
    doc.text(`${shop.steuernummer} · ${shop.taxNumber}`, 14, y);
    doc.setFont("helvetica", "bold"); doc.setFontSize(18);
    doc.text("RECHNUNG", 196, 16, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(`Rechnungs-Nr.: ${invoiceNo}`, 196, 22, { align: "right" });
    doc.text(`Auftrags-Nr.: ${order.auftragsnummer}`, 196, 26, { align: "right" });
    doc.text(`Datum: ${order.invoice_date ? berlinDateTime(order.invoice_date) : berlinNow()}`, 196, 30, { align: "right" });
    y += 10;
    doc.setDrawColor(200); doc.line(14, y, 196, y); y += 8;
    doc.setFont("helvetica", "bold"); doc.text("Rechnungsempfänger:", 14, y);
    doc.text("Auftragsdetails:", 110, y); y += 5;
    doc.setFont("helvetica", "normal");
    doc.text(String(order.customer_name || ""), 14, y);
    doc.text(`Filiale: ${branchName || "-"}`, 110, y); y += 4;
    doc.text(String(order.customer_phone || ""), 14, y);
    doc.text(`Gerät: ${order.device_brand || ""} ${order.device_model || ""}`, 110, y); y += 4;
    if (order.customer_address) { doc.text(String(order.customer_address), 14, y); }
    doc.text(`IMEI/SN: ${order.imei || "-"}`, 110, y); y += 10;

    // Table header
    doc.setFont("helvetica", "bold"); doc.setFillColor(240); doc.rect(14, y - 4, 182, 7, "F");
    doc.text("Position", 16, y); doc.text("Menge", 120, y); doc.text("Betrag", 194, y, { align: "right" }); y += 7;
    doc.setFont("helvetica", "normal");
    const row = (name, qty, amount) => {
      doc.text(String(name).substring(0, 60), 16, y);
      doc.text(String(qty), 120, y);
      doc.text(amount, 194, y, { align: "right" }); y += 6;
    };
    if (Number(cost.diagnosis_fee)) row("Diagnosegebühr", "1", `${Number(cost.diagnosis_fee).toFixed(2)} EUR`);
    if (Number(cost.labor_cost)) row("Arbeitskosten", "1", `${Number(cost.labor_cost).toFixed(2)} EUR`);
    parts.forEach((p) => row(p.name || p.sku, p.quantity, `${Number(p.total || 0).toFixed(2)} EUR`));
    if (!parts.length && Number(cost.parts_cost)) row("Versuchszeit", "1", `${Number(cost.parts_cost).toFixed(2)} EUR`);
    y += 2; doc.line(120, y, 196, y); y += 6;
    doc.text("Nettobetrag:", 150, y, { align: "right" }); doc.text(`${Number(cost.net || 0).toFixed(2)} EUR`, 194, y, { align: "right" }); y += 5;
    doc.text("zzgl. 19% MwSt.:", 150, y, { align: "right" }); doc.text(`${Number(cost.tax || 0).toFixed(2)} EUR`, 194, y, { align: "right" }); y += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Gesamtbetrag:", 150, y, { align: "right" }); doc.text(`${Number(cost.gross || 0).toFixed(2)} EUR`, 194, y, { align: "right" }); y += 16;

    // Ort/Datum + customer signature line
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(ortDatumShort, 14, y - 2);
    if (customerSignature) {
      try { doc.addImage(customerSignature, "PNG", 120, y - 16, 60, 16); } catch (e) { /* ignore */ }
    }
    doc.setDrawColor(0);
    doc.line(14, y + 2, 80, y + 2);
    doc.line(120, y + 2, 190, y + 2);
    doc.setFontSize(8); doc.setTextColor(90);
    doc.text("Ort, Datum", 14, y + 6);
    doc.text("Unterschrift Kunde", 120, y + 6);

    doc.save(`Rechnung_${invoiceNo}.pdf`);
  };

  const cellTh = { textAlign: "left", padding: "6px 8px", fontSize: "11px", borderBottom: "2px solid #000" };
  const cellTd = { padding: "6px 8px", fontSize: "12px", borderBottom: "1px solid #ddd" };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-background border border-border max-w-3xl w-full my-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-head font-semibold text-sm">Rechnung · {order.auftragsnummer}</h3>
          <div className="flex items-center gap-2">
            <button data-testid="invoice-print-button" onClick={handlePrint}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-xs font-head font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors">
              <Printer size={14} /> Drucken
            </button>
            <button data-testid="invoice-pdf-button" onClick={downloadPdf}
              className="flex items-center gap-2 border border-border text-foreground text-xs font-head font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
              <FilePdf size={14} /> PDF
            </button>
            <button data-testid="invoice-close-button" onClick={onClose}
              className="flex items-center gap-2 border border-border text-foreground text-xs font-head font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
              <X size={14} /> Schließen
            </button>
          </div>
        </div>

        <div className="p-6 bg-card flex justify-center">
          <div id="rechnung" style={{ width: "190mm", padding: "12mm", background: "#fff", color: "#111", fontFamily: "Arial, sans-serif" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                {shop.logo_url ? (
                  <img src={shop.logo_url} alt="Logo" data-testid="invoice-logo"
                    style={{ maxHeight: "56px", maxWidth: "120px", objectFit: "contain" }} />
                ) : null}
                <div>
                  <div style={{ fontSize: "18px", fontWeight: 700 }} data-testid="invoice-shop-name">{shop.name}</div>
                  <div style={{ fontSize: "11px", color: "#444", marginTop: "4px", lineHeight: 1.5 }} data-testid="invoice-branch-address">
                    {shop.address}<br />
                    {shop.phone} · {shop.email}<br />
                    {shop.steuernummer} · {shop.taxNumber}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "24px", fontWeight: 700, letterSpacing: "1px" }}>RECHNUNG</div>
                <div style={{ fontSize: "12px", marginTop: "6px" }} data-testid="invoice-number">Rechnungs-Nr.: {invoiceNo}</div>
                <div style={{ fontSize: "11px", color: "#444" }}>Auftrags-Nr.: {order.auftragsnummer}</div>
                <div style={{ fontSize: "12px" }}>Datum: {order.invoice_date ? berlinDateTime(order.invoice_date) : berlinNow()}</div>
              </div>
            </div>

            <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #ccc" }} />

            {/* Parties */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: "24px" }}>
              <div style={{ fontSize: "12px", lineHeight: 1.6 }}>
                <div style={{ fontWeight: 700, marginBottom: "4px" }}>Rechnungsempfänger</div>
                <div>{order.customer_name}</div>
                <div>{order.customer_phone}</div>
                {order.customer_address ? <div>{order.customer_address}</div> : null}
                {order.customer_email ? <div>{order.customer_email}</div> : null}
              </div>
              <div style={{ fontSize: "12px", lineHeight: 1.6, textAlign: "right" }}>
                <div style={{ fontWeight: 700, marginBottom: "4px" }}>Auftragsdetails</div>
                <div>Filiale: {branchName || "-"}</div>
                <div>Gerät: {order.device_brand} {order.device_model}</div>
                <div>IMEI/SN: {order.imei || "-"}</div>
                <div>Auftragsdatum: {berlinDateTime(order.created_at)}</div>
              </div>
            </div>

            {/* Line items */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }} data-testid="invoice-items">
              <thead>
                <tr>
                  <th style={cellTh}>Position / Leistung</th>
                  <th style={{ ...cellTh, textAlign: "center", width: "70px" }}>Menge</th>
                  <th style={{ ...cellTh, textAlign: "right", width: "110px" }}>Betrag</th>
                </tr>
              </thead>
              <tbody>
                {Number(cost.diagnosis_fee) > 0 && (
                  <tr><td style={cellTd}>Diagnosegebühr</td><td style={{ ...cellTd, textAlign: "center" }}>1</td><td style={{ ...cellTd, textAlign: "right" }}>{Number(cost.diagnosis_fee).toFixed(2)} €</td></tr>
                )}
                {Number(cost.labor_cost) > 0 && (
                  <tr><td style={cellTd}>Arbeitskosten</td><td style={{ ...cellTd, textAlign: "center" }}>1</td><td style={{ ...cellTd, textAlign: "right" }}>{Number(cost.labor_cost).toFixed(2)} €</td></tr>
                )}
                {parts.map((p) => (
                  <tr key={p.id}><td style={cellTd}>{p.name || p.sku}</td><td style={{ ...cellTd, textAlign: "center" }}>{p.quantity}</td><td style={{ ...cellTd, textAlign: "right" }}>{Number(p.total || 0).toFixed(2)} €</td></tr>
                ))}
                {parts.length === 0 && Number(cost.parts_cost) > 0 && (
                  <tr><td style={cellTd}>Versuchszeit</td><td style={{ ...cellTd, textAlign: "center" }}>1</td><td style={{ ...cellTd, textAlign: "right" }}>{Number(cost.parts_cost).toFixed(2)} €</td></tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
              <table style={{ fontSize: "12px", minWidth: "240px" }}>
                <tbody>
                  <tr><td style={{ padding: "3px 8px", textAlign: "right", color: "#444" }}>Nettobetrag</td><td style={{ padding: "3px 8px", textAlign: "right" }} data-testid="invoice-net">{Number(cost.net || 0).toFixed(2)} €</td></tr>
                  <tr><td style={{ padding: "3px 8px", textAlign: "right", color: "#444" }}>zzgl. 19% MwSt.</td><td style={{ padding: "3px 8px", textAlign: "right" }} data-testid="invoice-tax">{Number(cost.tax || 0).toFixed(2)} €</td></tr>
                  <tr style={{ borderTop: "2px solid #000" }}><td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>Gesamtbetrag</td><td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, fontSize: "14px" }} data-testid="invoice-gross">{Number(cost.gross || 0).toFixed(2)} €</td></tr>
                </tbody>
              </table>
            </div>

            {/* Signatures */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "36px", gap: "24px", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <div data-testid="invoice-ort-datum" style={{ fontSize: "11px", marginBottom: "18px", fontWeight: 600 }}>{ortDatumShort}</div>
                <div style={{ borderTop: "1px solid #000", paddingTop: "4px", fontSize: "10px" }}>Ort, Datum</div>
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                {customerSignature ? (
                  <img src={customerSignature} alt="Unterschrift Kunde" data-testid="invoice-customer-signature"
                    style={{ maxHeight: "48px", maxWidth: "180px", objectFit: "contain", margin: "0 auto 2px" }} />
                ) : (
                  <div style={{ height: "48px" }} />
                )}
                <div style={{ borderTop: "1px solid #000", paddingTop: "4px", fontSize: "10px" }}>Unterschrift Kunde</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}