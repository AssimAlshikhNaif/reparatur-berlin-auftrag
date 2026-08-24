import { useTranslation } from "react-i18next";
import { Printer, X } from "@phosphor-icons/react";
import { berlinDate } from "@/lib/datetime";
import { LIABILITY_WAIVER, AGB_FULL, DSGVO_FULL } from "@/lib/constants";

export default function ContractPrint({ order, branchName, branchInfo, onClose }) {
  const { t } = useTranslation();

  const branchLogos = {
    "Praxis Smartphone": "/logos/handy_laptop_praxi-removebg-preview.png",
  };

  const resolvedBranchName = branchInfo?.name || branchName || "Reparatur Berlin";

  const currentShop = {
    name: resolvedBranchName,
    email: branchInfo?.email || "",
    whatsapp: branchInfo?.whatsapp || "",
    address: branchInfo?.address || "Berlin",
    logo_url: branchInfo?.logo_url || branchLogos[resolvedBranchName] || "/logos/logo-icon.png",
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) {
      alert("Bitte erlauben Sie Pop-ups für den Druck.");
      return;
    }
    const contractContent = document.getElementById("vertrag").innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Reparaturvertrag - ${order?.auftragsnummer || order?.orderNumber || ""}</title>
          <style>
            @page { size: A4; margin: 10mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #111; font-size: 10.5px; line-height: 1.4; background: #fff; }
            .document-container { width: 100%; box-sizing: border-box; }
            .shop-logo { max-height: 35px !important; max-width: 120px !important; object-fit: contain; display: block; }
            .check-table { width: 100%; border-collapse: collapse; margin-top: 6px; margin-bottom: 10px; }
            .check-table th, .check-table td { border: 1px solid #ddd; padding: 5px 8px; font-size: 9.5px; }
            .check-table th { background: #f8f9fa; }
            .section-block { margin-bottom: 12px; }
            .legal-box { font-size: 9px; line-height: 1.35; text-align: justify; }
          </style>
        </head>
        <body>
          <div class="document-container">
            ${contractContent}
          </div>
          <script>
            setTimeout(() => {
              window.focus();
              window.print();
              window.close();
            }, 300);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getFlattenedChecklist = () => {
    const data = order?.inspection || order?.checklist || order?.checkpoints || order?.test_results || order?.testResults || order?.checks || {};
    
    if (Array.isArray(data)) return data;
    
    if (typeof data === 'object' && data !== null) {
      let items = [];
      Object.keys(data).forEach(categoryKey => {
        const categoryValue = data[categoryKey];
        if (Array.isArray(categoryValue)) {
          categoryValue.forEach(item => {
            items.push({
              name: item.name || item.label || item.title || categoryKey,
              status: item.status || item.result || item.value || "OK",
              note: item.note || item.comment || item.remarks || "",
              category: categoryKey
            });
          });
        } else if (typeof categoryValue !== 'object' || categoryValue === null) {
          items.push({
            name: categoryKey,
            status: categoryValue,
            note: "",
            category: "Allgemein"
          });
        } else if (typeof categoryValue === 'object') {
          Object.keys(categoryValue).forEach(subKey => {
            items.push({
              name: subKey,
              status: categoryValue[subKey]?.status || categoryValue[subKey] || "OK",
              note: categoryValue[subKey]?.note || "",
              category: categoryKey
            });
          });
        }
      });
      return items;
    }
    return [];
  };

  const checkListItems = getFlattenedChecklist();
  const hasChecklist = checkListItems.length > 0 || Boolean(order?.repair_notes);

  const renderHeader = () => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #111", paddingBottom: "8px", marginBottom: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {currentShop.logo_url && (
          <img src={currentShop.logo_url} alt="Logo" style={{ maxHeight: "35px", maxWidth: "120px", objectFit: "contain" }} />
        )}
        <h1 style={{ fontSize: "14px", fontWeight: "bold", margin: 0 }}>{currentShop.name}</h1>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "11px", fontWeight: "bold" }}>{t("print.contractTitle")}</div>
        <div style={{ fontSize: "9.5px" }}><strong>Nr.:</strong> {order?.auftragsnummer || order?.orderNumber || "—"} | <strong>Datum:</strong> {order?.created_at ? berlinDate(order.created_at) : berlinDate()}</div>
      </div>
    </div>
  );

  const renderSignatureBlock = () => (
    <div className="signature-section" style={{ borderTop: "2px solid #333", paddingTop: "10px", marginTop: "15px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", pageBreakInside: "avoid", breakInside: "avoid" }}>
      <div>
        <div style={{ fontSize: "10px", marginBottom: "12px", fontWeight: "bold" }}>Berlin, {berlinDate()}</div>
        <div style={{ borderTop: "1px solid #000", width: "140px", paddingTop: "3px", fontSize: "9.5px", textAlign: "center" }}>{t("print.signatureShop")}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        {order?.intake_signature || order?.signature ? (
          <img src={order.intake_signature || order.signature} alt="Unterschrift" style={{ maxHeight: "30px", margin: "0 auto 3px", display: "block" }} />
        ) : <div style={{ height: "30px" }} />}
        <div style={{ borderTop: "1px solid #000", width: "150px", paddingTop: "3px", fontSize: "9.5px" }}>{t("print.signatureCustomer")}</div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-background border border-border max-w-4xl w-full max-h-[92vh] flex flex-col rounded-xl shadow-2xl">
        
        {/* شريط التحكم العلوي */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <h3 className="font-head font-semibold text-base">{t("print.contractTitle")} · {order?.auftragsnummer || order?.orderNumber}</h3>
          <div className="flex items-center gap-3">
            <button onClick={handlePrint} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-xs font-head font-semibold uppercase tracking-wider hover:bg-blue-600 transition-colors">
              <Printer size={16} /> {t("common.print")}
            </button>
            <button onClick={onClose} aria-label={t("common.close")} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
              <X size={22} />
            </button>
          </div>
        </div>

        {/* نافذة المعاينة الداخلية */}
        <div className="p-8 bg-muted/40 overflow-y-auto flex-1 flex flex-col items-center gap-6">
          <div id="vertrag" style={{ width: "190mm", background: "#ffffff", color: "#111111", padding: "12mm", boxSizing: "border-box", boxShadow: "0 0 10px rgba(0,0,0,0.1)", borderRadius: "4px" }}>
            
            {order.status === "STORNIERT" && (
              <div data-testid="print-canceled-banner" style={{
                textAlign: "center", border: "3px solid #c00", color: "#c00",
                fontWeight: 700, fontSize: "20px", letterSpacing: "4px",
                padding: "4px", margin: "8px 0", transform: "rotate(-1.5deg)",
              }}>
                STORNIERT
                {order.cancel_reason && (
                  <div style={{ fontWeight: 400, fontSize: "10.5px", letterSpacing: "normal", marginTop: "2px" }}>
                    Grund: {order.cancel_reason}
                  </div>
                )}
              </div>
            )}
            
            {renderHeader()}
            
            <div style={{ fontSize: "9.5px", color: "#555", marginBottom: "10px" }}>
              {currentShop.address} | WhatsApp: {currentShop.whatsapp} | E-Mail: {currentShop.email}
            </div>

            {/* بيانات الزبون والجهاز بجانب بعضهما */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
              <div style={{ flex: 1, border: "1px solid #ddd", padding: "6px 8px", borderRadius: "4px", background: "#fcfcfc" }}>
                <div style={{ fontWeight: "bold", fontSize: "10px", borderBottom: "1px solid #eee", paddingBottom: "3px", marginBottom: "5px" }}>{t("print.customerData")}</div>
                <div style={{ fontSize: "9.5px", lineHeight: "1.4" }}>
                  <div><strong>Name:</strong> {order?.customer_name || order?.customerName || "—"}</div>
                  <div><strong>Telefon:</strong> {order?.customer_phone || order?.customerPhone || "—"}</div>
                  <div><strong>E-Mail:</strong> {order?.customer_email || order?.customerEmail || "—"}</div>
                  <div><strong>Adresse:</strong> {order?.customer_address || order?.customerAddress || "—"}</div>
                </div>
              </div>
              <div style={{ flex: 1, border: "1px solid #ddd", padding: "6px 8px", borderRadius: "4px", background: "#fcfcfc" }}>
                <div style={{ fontWeight: "bold", fontSize: "10px", borderBottom: "1px solid #eee", paddingBottom: "3px", marginBottom: "5px" }}>{t("print.deviceData")}</div>
                <div style={{ fontSize: "9.5px", lineHeight: "1.4" }}>
                  <div><strong>Gerät:</strong> {order?.device_brand || order?.brand || ""} {order?.device_model || order?.model || "—"}</div>
                  <div><strong>IMEI/SN:</strong> {order?.imei || order?.serialNumber || "—"}</div>
                  <div><strong>Sperre:</strong> {order?.device_lock_type && order?.device_lock_type !== "none" ? order.device_lock_type : "—"}</div>
                  <div><strong>Fehler:</strong> {order?.issue_description || order?.issue || "—"}</div>
                  {order?.battery_health && <div><strong>Akku-Gesundheit:</strong> {order.battery_health}%</div>}
                </div>
              </div>
            </div>

            {/* شروط المسؤولية */}
            <div className="section-block" style={{ border: "1px solid #ccc", padding: "6px 8px", borderRadius: "4px", background: "#fff" }}>
              <div style={{ fontWeight: "bold", fontSize: "10px", marginBottom: "4px" }}>{t("print.termsTitle")} (Haftungsausschluss)</div>
              <div className="legal-box">{LIABILITY_WAIVER}</div>
            </div>

            {/* بروتوكول الفحص (يظهر فقط إذا وجد) */}
            {hasChecklist && (
              <div className="section-block">
                <h2 style={{ fontSize: "11.5px", marginBottom: "6px", fontWeight: "bold", borderBottom: "1px solid #eee", paddingBottom: "2px" }}>Endkontrolle / Prüfprotokoll</h2>
                {checkListItems.length > 0 && (
                  <table className="check-table">
                    <thead>
                      <tr>
                        <th>Testpunkt</th>
                        <th style={{ textAlign: "center", width: "15%" }}>Status</th>
                        <th style={{ width: "45%" }}>Anmerkung</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkListItems.map((item, index) => {
                        const statusVal = item.status || item.result || item.value || "—";
                        const isOk = statusVal === "OK" || statusVal === "true" || statusVal === true;
                        return (
                          <tr key={index}>
                            <td>
                              {item.category && <span style={{ display: "block", fontSize: "6.5px", color: "#666", textTransform: "uppercase" }}>{item.category}</span>}
                              <strong>{item.name || item.key || item.label || item.title || `Punkt ${index + 1}`}</strong>
                            </td>
                            <td style={{ textAlign: "center", fontWeight: "bold", color: isOk ? "#28a745" : "#d9534f" }}>
                              {isOk ? "OK" : statusVal}
                            </td>
                            <td style={{ color: "#333" }}>{item.note || item.comment || item.remarks || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
                {order?.repair_notes && (
                  <div style={{ border: "1px solid #ddd", padding: "6px 8px", borderRadius: "4px", background: "#fafafa" }}>
                    <div style={{ fontSize: "10px", fontWeight: "bold", marginBottom: "3px" }}>Reparaturnotizen:</div>
                    <div style={{ fontSize: "9px", color: "#333" }}>{order.repair_notes}</div>
                  </div>
                )}
              </div>
            )}

            {/* الشروط العامة AGB */}
            <div className="section-block">
              <h2 style={{ fontSize: "11.5px", marginBottom: "6px", fontWeight: "bold", borderBottom: "1px solid #eee", paddingBottom: "2px" }}>Allgemeine Geschäftsbedingungen (AGB)</h2>
              <div className="legal-box">{AGB_FULL}</div>
            </div>

            {/* سياسة الخصوصية DSGVO */}
            <div className="section-block">
              <h2 style={{ fontSize: "11.5px", marginBottom: "6px", fontWeight: "bold", borderBottom: "1px solid #eee", paddingBottom: "2px" }}>Datenschutzerklärung (DSGVO)</h2>
              <div className="legal-box">{DSGVO_FULL}</div>
            </div>

            {/* التوقيع يظهر حصرياً في النهاية */}
            {renderSignatureBlock()}

          </div>
        </div>

      </div>
    </div>
  );
}