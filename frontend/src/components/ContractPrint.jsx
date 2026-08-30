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

  const getIntakeMediaList = () => {
    const rawMedia = order?.intake_media || 
                     order?.intakeMedia || 
                     order?.intake_inspection?.media || 
                     order?.intake_inspection?.photos || 
                     order?.photos || 
                     order?.media || [];

    if (!Array.isArray(rawMedia)) return [];

    return rawMedia.map(m => {
      if (!m) return null;
      if (typeof m === 'string') return m;
      if (typeof m === 'object') {
        return m.url || m.path || m.file_url || m.secure_url || m.preview || m.uri || null;
      }
      return null;
    }).filter(Boolean);
  };

  const intakeMediaList = getIntakeMediaList();

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
            @page { size: A4; margin: 4mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #111; font-size: 8px; line-height: 1.15; background: #fff; }
            .document-container { width: 100%; box-sizing: border-box; }
            .shop-logo { max-height: 25px !important; max-width: 80px !important; object-fit: contain; display: block; }
            .check-grid { display: flex !important; flex-wrap: wrap !important; gap: 3px !important; margin-top: 2px !important; margin-bottom: 4px !important; }
            .check-item { width: 32% !important; border: 1px solid #ddd !important; padding: 2px 4px !important; border-radius: 2px !important; background: #fafafa !important; font-size: 7.5px !important; display: flex !important; justify-content: space-between !important; align-items: center !important; box-sizing: border-box !important; }
            .section-block { margin-bottom: 3px !important; page-break-inside: avoid !important; }
            .legal-box { font-size: 6.5px !important; line-height: 1.08 !important; text-align: justify !important; color: #333 !important; }
            .top-info-box { border: 1.5px solid #888 !important; padding: 4px 6px !important; border-radius: 3px !important; background: #fafafa !important; }
            .media-grid { display: flex !important; flex-wrap: wrap !important; gap: 4px !important; margin-top: 3px !important; }
            .media-thumb { width: 42px !important; height: 42px !important; object-fit: cover !important; border: 1px solid #777 !important; border-radius: 2px !important; display: inline-block !important; }
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
            }, 400);
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getFlattenedChecklist = () => {
    const data = order?.intake_inspection?.checklist || order?.intake_inspection || order?.inspection || order?.checklist || {};
    
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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #111", paddingBottom: "3px", marginBottom: "3px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {currentShop.logo_url && (
          <img src={currentShop.logo_url} alt="Logo" style={{ maxHeight: "28px", maxWidth: "90px", objectFit: "contain" }} />
        )}
        <h1 style={{ fontSize: "12px", fontWeight: "800", margin: 0, letterSpacing: "-0.2px" }}>{currentShop.name}</h1>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "10px", fontWeight: "800" }}>{t("print.contractTitle")}</div>
        <div style={{ fontSize: "8px" }}><strong>Nr.:</strong> {order?.auftragsnummer || order?.orderNumber || "—"} | <strong>Datum:</strong> {order?.created_at ? berlinDate(order.created_at) : berlinDate()}</div>
      </div>
    </div>
  );

  const renderSignatureBlock = () => (
    <div className="signature-section" style={{ borderTop: "1.5px solid #222", paddingTop: "4px", marginTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", pageBreakInside: "avoid" }}>
      <div>
        <div style={{ fontSize: "8px", marginBottom: "6px", fontWeight: "bold" }}>Berlin, {berlinDate()}</div>
        <div style={{ borderTop: "1px solid #000", width: "100px", paddingTop: "2px", fontSize: "7.5px", textAlign: "center" }}>{t("print.signatureShop")}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        {order?.intake_signature || order?.signature ? (
          <img src={order.intake_signature || order.signature} alt="Unterschrift" style={{ maxHeight: "22px", margin: "0 auto 2px", display: "block" }} />
        ) : <div style={{ height: "22px" }} />}
        <div style={{ borderTop: "1px solid #000", width: "110px", paddingTop: "2px", fontSize: "7.5px" }}>{t("print.signatureCustomer")}</div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-background border border-border max-w-4xl w-full max-h-[92vh] flex flex-col rounded-xl shadow-2xl">
        
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

        <div className="p-8 bg-muted/40 overflow-y-auto flex-1 flex flex-col items-center gap-6">
          <div id="vertrag" style={{ width: "190mm", background: "#ffffff", color: "#111111", padding: "4mm", boxSizing: "border-box", boxShadow: "0 0 10px rgba(0,0,0,0.1)", borderRadius: "4px" }}>
            
            {order.status === "STORNIERT" && (
              <div data-testid="print-canceled-banner" style={{
                textAlign: "center", border: "2px solid #c00", color: "#c00",
                fontWeight: 700, fontSize: "14px", letterSpacing: "2px",
                padding: "2px", margin: "2px 0", transform: "rotate(-1.5deg)",
              }}>
                STORNIERT
                {order.cancel_reason && (
                  <div style={{ fontWeight: 400, fontSize: "8px", letterSpacing: "normal", marginTop: "1px" }}>
                    Grund: {order.cancel_reason}
                  </div>
                )}
              </div>
            )}
            
            {renderHeader()}
            
            <div style={{ fontSize: "7.5px", color: "#444", marginBottom: "4px" }}>
              {currentShop.address} | WhatsApp: {currentShop.whatsapp} | E-Mail: {currentShop.email}
            </div>

            {/* بيانات العميل والجهاز بشكل بارز واحترافي */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "4px" }}>
              <div className="top-info-box" style={{ flex: 1 }}>
                <div style={{ fontWeight: "800", fontSize: "9px", borderBottom: "1.5px solid #bbb", paddingBottom: "2px", marginBottom: "3px", color: "#000" }}>{t("print.customerData")}</div>
                <div style={{ fontSize: "8.5px", lineHeight: "1.25" }}>
                  <div><strong>Name:</strong> <span style={{ fontSize: "9.5px", fontWeight: "800" }}>{order?.customer_name || order?.customerName || "—"}</span></div>
                  <div><strong>Telefon:</strong> <span style={{ fontWeight: "700" }}>{order?.customer_phone || order?.customerPhone || "—"}</span></div>
                  <div><strong>E-Mail:</strong> {order?.customer_email || order?.customerEmail || "—"}</div>
                  <div><strong>Adresse:</strong> {order?.customer_address || order?.customerAddress || "—"}</div>
                </div>
              </div>
              <div className="top-info-box" style={{ flex: 1 }}>
                <div style={{ fontWeight: "800", fontSize: "9px", borderBottom: "1.5px solid #bbb", paddingBottom: "2px", marginBottom: "3px", color: "#000" }}>{t("print.deviceData")}</div>
                <div style={{ fontSize: "8.5px", lineHeight: "1.25" }}>
                  <div><strong>Gerät:</strong> <span style={{ fontSize: "9.5px", fontWeight: "800" }}>{order?.device_brand || order?.brand || ""} {order?.device_model || order?.model || "—"}</span></div>
                  <div><strong>IMEI/SN:</strong> <span style={{ fontWeight: "700" }}>{order?.imei || order?.serialNumber || "—"}</span></div>
                  <div><strong>Sperre:</strong> {order?.device_lock_type && order?.device_lock_type !== "none" ? order.device_lock_type : "—"}</div>
                  <div><strong>Fehler:</strong> <span style={{ fontWeight: "700" }}>{order?.issue_description || order?.issue || "—"}</span></div>
                  {order?.battery_health && <div><strong>Akku-Gesundheit:</strong> {order.battery_health}%</div>}
                </div>
              </div>
            </div>

            {/* صور الاستلام */}
            {intakeMediaList.length > 0 && (
              <div className="section-block">
                <div style={{ fontSize: "9px", fontWeight: "800", marginBottom: "2px", borderBottom: "1.5px solid #111", paddingBottom: "1px" }}>Zustandsprotokoll Fotos (Eingang)</div>
                <div className="media-grid">
                  {intakeMediaList.map((url, idx) => (
                    <img key={idx} src={url} alt={`Intake ${idx + 1}`} className="media-thumb" />
                  ))}
                </div>
              </div>
            )}

            {hasChecklist && (
              <div className="section-block">
                <h2 style={{ fontSize: "9px", marginBottom: "2px", fontWeight: "800", borderBottom: "1.5px solid #ccc", paddingBottom: "1px" }}>Prüfprotokoll (Mitarbeiter)</h2>
                {checkListItems.length > 0 && (
                  <div className="check-grid">
                    {checkListItems.map((item, index) => {
                      const statusVal = item.status || item.result || item.value || "—";
                      const isOk = statusVal === "OK" || statusVal === "true" || statusVal === true;
                      return (
                        <div key={index} className="check-item">
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                            <strong>{item.name || item.key || item.label || item.title || `Punkt ${index + 1}`}</strong>
                          </span>
                          <span style={{ fontWeight: "bold", color: isOk ? "#155724" : "#721c24" }}>
                            {isOk ? "OK" : statusVal}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {order?.repair_notes && (
                  <div style={{ border: "1px solid #ccc", padding: "2px 4px", borderRadius: "2px", background: "#fbfbfb", marginTop: "2px" }}>
                    <div style={{ fontSize: "8px", fontWeight: "bold", marginBottom: "1px" }}>Reparaturnotizen:</div>
                    <div style={{ fontSize: "7.5px", color: "#333" }}>{order.repair_notes}</div>
                  </div>
                )}
              </div>
            )}

            <div className="section-block" style={{ border: "1px solid #ccc", padding: "2px 4px", borderRadius: "2px", background: "#fff" }}>
              <div style={{ fontWeight: "bold", fontSize: "8.5px", marginBottom: "1px" }}>{t("print.termsTitle")} (Haftungsausschluss)</div>
              <div className="legal-box">{LIABILITY_WAIVER}</div>
            </div>

            <div className="section-block">
              <h2 style={{ fontSize: "9px", marginBottom: "1px", fontWeight: "800", borderBottom: "1.5px solid #ccc", paddingBottom: "1px" }}>Allgemeine Geschäftsbedingungen (AGB)</h2>
              <div className="legal-box">{AGB_FULL}</div>
            </div>

            <div className="section-block">
              <h2 style={{ fontSize: "9px", marginBottom: "1px", fontWeight: "800", borderBottom: "1.5px solid #ccc", paddingBottom: "1px" }}>Datenschutzerklärung (DSGVO)</h2>
              <div className="legal-box">{DSGVO_FULL}</div>
            </div>

            {renderSignatureBlock()}

          </div>
        </div>

      </div>
    </div>
  );
}