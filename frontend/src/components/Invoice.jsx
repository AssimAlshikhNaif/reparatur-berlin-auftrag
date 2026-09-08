import { useEffect, useState } from "react";
import api from "@/lib/api";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
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
  
  const branchLogos = {
    "Praxis Smartphone": "/logos/handy_laptop_praxi-removebg-preview.png",
  };

  const resolvedBranchName = branch?.name || branchName || SHOP_INFO.name;

  const shop = {
    name: resolvedBranchName,
    address: branch?.address || `${SHOP_INFO.addressLine1}, ${SHOP_INFO.addressLine2}`,
    phone: branch?.phone || SHOP_INFO.phone,
    email: branch?.email || SHOP_INFO.email,
    taxNumber: branch?.tax_number || SHOP_INFO.taxNumber || "",
    steuernummer: branch?.steuernummer || SHOP_INFO.steuernummer || "",
    city: branch?.city || "Berlin",
    logo_url: branch?.logo_url || branchLogos[resolvedBranchName] || SHOP_INFO.logo_url || "",
  };
  const ortDatumShort = `${shop.city}, ${order.invoice_date ? berlinDate(order.invoice_date) : berlinDate()}`;
  const customerSignature = order.pickup_signature || order.intake_signature || null;

  // حساب المجموع الإجمالي (Brutto)
  const diagFee = Number(cost.diagnosis_fee || 0);
  const laborCost = Number(cost.labor_cost || 0);
  const grossTotal = diagFee + laborCost + (parts.length > 0 ? parts.reduce((acc, p) => acc + Number(p.total || 0), 0) : Number(cost.parts_cost || 0));
  
  // استخراج الصافي والضريبة عكسياً من الإجمالي (Brutto)
  const calculatedNet = grossTotal / 1.19;
  const calculatedTax = grossTotal - calculatedNet;

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

  // توليد PDF عالي الجودة باستخدام html2canvas لضمان ظهور اللوغو والتنسيقات بشكل مطابق تماماً للشاشة
  const generatePdfCanvas = async () => {
    const input = document.getElementById("rechnung");
    if (!input) return null;

    const canvas = await html2canvas(input, {
      scale: 2, // دقة عالية جداً للطباعة والـ PDF
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    return pdf;
  };

  const handlePrint = async () => {
    const pdf = await generatePdfCanvas();
    if (!pdf) return;
    pdf.autoPrint();
    window.open(pdf.output('bloburl'), '_blank');
  };

  const downloadPdf = async () => {
    const pdf = await generatePdfCanvas();
    if (!pdf) return;
    pdf.save(`Rechnung_${invoiceNo}.pdf`);
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
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {shop.logo_url ? (
                    <img src={shop.logo_url} alt="Logo" data-testid="invoice-logo"
                      style={{ height: "40px", maxWidth: "140px", objectFit: "contain" }} />
                  ) : null}
                  <div style={{ fontSize: "18px", fontWeight: 700 }} data-testid="invoice-shop-name">{shop.name}</div>
                </div>
                <div style={{ fontSize: "11px", color: "#444", marginTop: "8px", lineHeight: 1.4 }} data-testid="invoice-branch-address">
                  {shop.address}<br />
                  {shop.phone} · {shop.email}
                  {(shop.steuernummer || shop.taxNumber) && (
                    <><br />{shop.steuernummer}{shop.steuernummer && shop.taxNumber ? " · " : ""}{shop.taxNumber}</>
                  )}
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
                {diagFee > 0 && (
                  <tr><td style={cellTd}>Diagnosegebühr</td><td style={{ ...cellTd, textAlign: "center" }}>1</td><td style={{ ...cellTd, textAlign: "right" }}>{diagFee.toFixed(2)} €</td></tr>
                )}
                {laborCost > 0 && (
                  <tr><td style={cellTd}>Reparaturkosten</td><td style={{ ...cellTd, textAlign: "center" }}>1</td><td style={{ ...cellTd, textAlign: "right" }}>{laborCost.toFixed(2)} €</td></tr>
                )}
                {parts.map((p) => (
                  <tr key={p.id}><td style={cellTd}>{p.name || p.sku}</td><td style={{ ...cellTd, textAlign: "center" }}>{p.quantity}</td><td style={{ ...cellTd, textAlign: "right" }}>{Number(p.total || 0).toFixed(2)} €</td></tr>
                ))}
                {parts.length === 0 && Number(cost.parts_cost) > 0 && (
                  <tr><td style={cellTd}>Ersatzteile / Material</td><td style={{ ...cellTd, textAlign: "center" }}>1</td><td style={{ ...cellTd, textAlign: "right" }}>{Number(cost.parts_cost).toFixed(2)} €</td></tr>
                )}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
              <table style={{ fontSize: "12px", minWidth: "240px" }}>
                <tbody>
                  <tr><td style={{ padding: "3px 8px", textAlign: "right", color: "#444" }}>Nettobetrag</td><td style={{ padding: "3px 8px", textAlign: "right" }} data-testid="invoice-net">{calculatedNet.toFixed(2)} €</td></tr>
                  <tr><td style={{ padding: "3px 8px", textAlign: "right", color: "#444" }}>inkl. 19% MwSt.</td><td style={{ padding: "3px 8px", textAlign: "right" }} data-testid="invoice-tax">{calculatedTax.toFixed(2)} €</td></tr>
                  <tr style={{ borderTop: "2px solid #000" }}><td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>Gesamtbetrag</td><td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, fontSize: "14px" }} data-testid="invoice-gross">{grossTotal.toFixed(2)} €</td></tr>
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