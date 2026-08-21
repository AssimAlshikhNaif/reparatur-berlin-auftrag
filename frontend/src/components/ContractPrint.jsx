import { useTranslation } from "react-i18next";
import { Printer, X } from "@phosphor-icons/react";
import { berlinDate } from "@/lib/datetime";
import { LIABILITY_WAIVER, AGB_FULL, DSGVO_FULL } from "@/lib/constants";

export default function ContractPrint({ order, branchName, branchInfo, onClose }) {
  const { t } = useTranslation();

  const currentShop = {
    name: branchInfo?.name || branchName || "Reparatur Berlin",
    email: branchInfo?.email || "",
    whatsapp: branchInfo?.whatsapp || "",
    address: branchInfo?.address || "Berlin",
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
            body { 
              font-family: Arial, sans-serif; 
              color: #111; 
              margin: 0;
              padding: 0;
            }
            .page { 
              page-break-after: always; 
              break-after: page;
              box-sizing: border-box;
              padding: 10mm;
              height: 297mm;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              position: relative;
            }
            .header-mini {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1px solid #111;
              padding-bottom: 5px;
              margin-bottom: 8px;
              font-size: 9px;
            }
            h1 { font-size: 16px; margin: 0 0 2px 0; }
            h2 { font-size: 11px; border-bottom: 1.5px solid #000; padding-bottom: 2px; margin-top: 6px; margin-bottom: 4px; }
            p, div { font-size: 9px; line-height: 1.35; }
            table.check-table { width: 100%; border-collapse: collapse; margin-top: 2px; margin-bottom: 4px; }
            table.check-table th, table.check-table td { border: 1px solid #ccc; padding: 2px 4px; font-size: 8px; text-align: left; }
            table.check-table th { background-color: #f2f2f2; }
            .section-title { font-size: 8.5px; font-weight: bold; color: #1d4ed8; margin-top: 4px; margin-bottom: 2px; text-transform: uppercase; }
            .signature-section {
              border-top: 1px solid #aaa;
              padding-top: 6px;
              margin-top: 4px;
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
            }
            @media print { 
              @page { size: A4; margin: 0; } 
            }
          </style>
        </head>
        <body>
          ${contractContent}
          <script>
            window.onload = () => { 
              window.print(); 
              window.close(); 
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // معالجة شاملة لبنية بيانات الفحص (سواء كانت مصفوفة مباشرة أو كائن أقسام)
  const rawInspection = order?.inspection || order?.checklist || order?.checkpoints || [];
  
  // تحويل البيانات لتكون مصفوفة مفلطحة أو مقسمة بشكل صحيح للطباعة
 const getFlattenedChecklist = () => {
    const data = order?.inspection || order?.checklist || order?.checkpoints || order?.test_results || order?.testResults || order?.checks || {};
    
    console.log("Inspection data to flatten:", data);

    // إذا كانت البيانات مصفوفة من الأساس
    if (Array.isArray(data)) {
      return data;
    } 
    
    // إذا كانت البيانات عبارة عن كائن (Object)
    if (typeof data === 'object' && data !== null) {
      let items = [];
      
      Object.keys(data).forEach(categoryKey => {
        const categoryValue = data[categoryKey];
        
        // إذا كان المفتاح يحتوي على مصفوفة (مثلاً: screen: [{name: 'Touch', status: 'OK'}])
        if (Array.isArray(categoryValue)) {
          categoryValue.forEach(item => {
            items.push({
              name: item.name || item.label || item.title || categoryKey,
              status: item.status || item.result || item.value || "OK",
              note: item.note || item.comment || item.remarks || "",
              category: categoryKey
            });
          });
        } 
        // إذا كان الكائن مخزناً بشكل مفتاح-قيمة مباشر (مثلاً: { touch: "OK", battery: "OK" })
        else if (typeof categoryValue !== 'object' || categoryValue === null) {
          items.push({
            name: categoryKey,
            status: categoryValue,
            note: "",
            category: "Allgemein"
          });
        }
        // إذا كان عبارة عن كائن فرعي متداخل
        else if (typeof categoryValue === 'object') {
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

  const renderSignatureBlock = () => (
    <div className="signature-section" style={{ borderTop: "1px solid #ccc", paddingTop: "6px", marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
      <div>
        <div style={{ fontSize: "8px", marginBottom: "10px", fontWeight: "bold" }}>Berlin, {berlinDate()}</div>
        <div style={{ borderTop: "1px solid #000", width: "120px", paddingTop: "2px", fontSize: "8px", textAlign: "center" }}>{t("print.signatureShop")}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        {order?.intake_signature || order?.signature ? (
          <img src={order.intake_signature || order.signature} alt="Unterschrift" style={{ maxHeight: "22px", margin: "0 auto 2px", display: "block" }} />
        ) : <div style={{ height: "22px" }} />}
        <div style={{ borderTop: "1px solid #000", width: "130px", paddingTop: "2px", fontSize: "8px" }}>{t("print.signatureCustomer")}</div>
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
        <div className="p-8 bg-muted/40 overflow-y-auto flex-1 flex justify-center">
          <div id="vertrag" style={{ width: "190mm", background: "#ffffff", color: "#111111", boxShadow: "0 0 10px rgba(0,0,0,0.1)", borderRadius: "4px" }}>
            
            {/* الصفحة الأولى: العقد الرئيسي والبيانات */}
            <div className="page" style={{ padding: "10mm", height: "297mm", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "2px solid #111", paddingBottom: "8px", marginBottom: "8px" }}>
                  <div>
                    <h1 style={{ fontSize: "15px", fontWeight: "bold" }}>{currentShop.name}</h1>
                    <div style={{ fontSize: "8.5px", color: "#555", lineHeight: "1.3" }}>
                      {currentShop.address} | WhatsApp: {currentShop.whatsapp} | E-Mail: {currentShop.email}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "13px", fontWeight: "bold" }}>{t("print.contractTitle")}</div>
                    <div style={{ fontSize: "9.5px" }}><strong>Nr.:</strong> {order?.auftragsnummer || order?.orderNumber || "—"} | <strong>Datum:</strong> {order?.created_at ? berlinDate(order.created_at) : berlinDate()}</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                  <div style={{ flex: 1, border: "1px solid #ddd", padding: "5px 7px", borderRadius: "4px", background: "#fcfcfc" }}>
                    <div style={{ fontWeight: "bold", fontSize: "8.5px", borderBottom: "1px solid #eee", paddingBottom: "2px", marginBottom: "2px" }}>{t("print.customerData")}</div>
                    <div style={{ fontSize: "8.5px", lineHeight: "1.3" }}>
                      <div><strong>Name:</strong> {order?.customer_name || order?.customerName || "—"}</div>
                      <div><strong>Telefon:</strong> {order?.customer_phone || order?.customerPhone || "—"}</div>
                      <div><strong>E-Mail:</strong> {order?.customer_email || order?.customerEmail || "—"}</div>
                      <div><strong>Adresse:</strong> {order?.customer_address || order?.customerAddress || "—"}</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, border: "1px solid #ddd", padding: "5px 7px", borderRadius: "4px", background: "#fcfcfc" }}>
                    <div style={{ fontWeight: "bold", fontSize: "8.5px", borderBottom: "1px solid #eee", paddingBottom: "2px", marginBottom: "2px" }}>{t("print.deviceData")}</div>
                    <div style={{ fontSize: "8.5px", lineHeight: "1.3" }}>
                      <div><strong>Gerät:</strong> {order?.device_brand || order?.brand || ""} {order?.device_model || order?.model || "—"}</div>
                      <div><strong>IMEI/SN:</strong> {order?.imei || order?.serialNumber || "—"}</div>
                      <div><strong>Sperre:</strong> {order?.device_lock_type && order?.device_lock_type !== "none" ? order.device_lock_type : "—"}</div>
                      <div><strong>Fehler:</strong> {order?.issue_description || order?.issue || "—"}</div>
                      {order?.battery_health && <div><strong>Akku-Gesundheit:</strong> {order.battery_health}%</div>}
                    </div>
                  </div>
                </div>

                <div style={{ border: "1px solid #ccc", padding: "5px 7px", borderRadius: "4px", background: "#fff" }}>
                  <div style={{ fontWeight: "bold", fontSize: "8.5px", marginBottom: "2px" }}>{t("print.termsTitle")} (Haftungsausschluss)</div>
                  <div style={{ fontSize: "7px", color: "#333", lineHeight: "1.3", whiteSpace: "pre-line" }}>{LIABILITY_WAIVER}</div>
                </div>
              </div>

              {renderSignatureBlock()}
            </div>

            {/* الصفحة الثانية: بروتوكول الفحص (Prüfprotokoll) */}
            <div className="page" style={{ padding: "10mm", height: "297mm", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div className="header-mini">
                  <span><strong>{currentShop.name}</strong></span>
                  <span>Auftrag: <strong>{order?.auftragsnummer || order?.orderNumber}</strong></span>
                </div>
                <h2 style={{ fontSize: "11px", fontWeight: "bold", borderBottom: "1.5px solid #000", paddingBottom: "2px", marginBottom: "4px" }}>Endkontrolle / Prüfprotokoll</h2>
                
                {checkListItems.length > 0 ? (
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
                            <td style={{ textAlign: "center", fontWeight: "bold", color: isOk ? "green" : "#d9534f" }}>
                              {isOk ? "OK" : statusVal}
                            </td>
                            <td>{item.note || item.comment || item.remarks || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <div style={{ fontSize: "8.5px", color: "#777", fontStyle: "italic", marginTop: "8px" }}>
                    Keine Prüfprotokoll-Daten für diesen Auftrag vorhanden.
                  </div>
                )}

                {order?.repair_notes && (
                  <div style={{ marginTop: "6px", border: "1px solid #ddd", padding: "4px 6px", borderRadius: "3px" }}>
                    <div style={{ fontSize: "8px", fontWeight: "bold", marginBottom: "2px" }}>Reparaturnotizen:</div>
                    <div style={{ fontSize: "7.5px", color: "#333" }}>{order.repair_notes}</div>
                  </div>
                )}
              </div>

              {renderSignatureBlock()}
            </div>

            {/* الصفحة الثالثة: AGB */}
            <div className="page" style={{ padding: "10mm", height: "297mm", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div className="header-mini">
                  <span><strong>{currentShop.name}</strong></span>
                  <span>Auftrag: <strong>{order?.auftragsnummer || order?.orderNumber}</strong></span>
                </div>
                <h2 style={{ fontSize: "11px", fontWeight: "bold", borderBottom: "1.5px solid #000", paddingBottom: "2px", marginBottom: "4px" }}>Allgemeine Geschäftsbedingungen (AGB)</h2>
                <div style={{ fontSize: "6.5px", color: "#333", lineHeight: "1.3", whiteSpace: "pre-line" }}>
                  {AGB_FULL}
                </div>
              </div>

              {renderSignatureBlock()}
            </div>

            {/* الصفحة الرابعة: DSGVO */}
            <div className="page" style={{ padding: "10mm", height: "297mm", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div className="header-mini">
                  <span><strong>{currentShop.name}</strong></span>
                  <span>Auftrag: <strong>{order?.auftragsnummer || order?.orderNumber}</strong></span>
                </div>
                <h2 style={{ fontSize: "11px", fontWeight: "bold", borderBottom: "1.5px solid #000", paddingBottom: "2px", marginBottom: "4px" }}>Datenschutzerklärung (DSGVO)</h2>
                <div style={{ fontSize: "6.5px", color: "#333", lineHeight: "1.3", whiteSpace: "pre-line" }}>
                  {DSGVO_FULL}
                </div>
              </div>

              {renderSignatureBlock()}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}