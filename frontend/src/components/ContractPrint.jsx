import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Printer, X } from "@phosphor-icons/react";
import { berlinDate } from "@/lib/datetime";
import { fileUrl } from "@/lib/api";
import { LIABILITY_WAIVER, AGB_FULL, DSGVO_FULL } from "@/lib/constants";

export default function ContractPrint({ order, branchName, branchInfo, onClose }) {
  const { t } = useTranslation();
  const [brokenImages, setBrokenImages] = useState({});

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

    return rawMedia
      .map((m) => {
        if (!m) return null;
        if (typeof m === "object" && m.is_video) return null;

        let path = null;
        if (typeof m === "string") {
          path = m;
        } else if (typeof m === "object" && m !== null) {
          // storage_path ist das echte, gültige Feld für hochgeladene Dateien.
          // Die anderen Fallbacks bleiben nur für evtl. abweichende ältere Datensätze.
          path = m.storage_path || m.url || m.file_url || m.secure_url || m.path || m.preview;
        }

        if (!path || typeof path !== "string") return null;

        return path.startsWith("http") || path.startsWith("blob:") || path.startsWith("data:image")
          ? path
          : fileUrl(path);
      })
      .filter(Boolean);
  };

  // Bilder, die beim Laden fehlschlagen (z. B. veraltete/gelöschte Dateien),
  // werden konsequent ausgeblendet — im gedruckten Dokument darf niemals ein
  // kaputtes Bildsymbol erscheinen.
  const intakeMediaList = getIntakeMediaList().filter((_, idx) => !brokenImages[idx]);

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
            @page { size: A4; margin: 6mm; }
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #111; font-size: 8.5px; line-height: 1.2; background: #fff; }
            .document-container { width: 100%; box-sizing: border-box; }
            .section-block { margin-bottom: 5px !important; page-break-inside: avoid !important; }
            .legal-box { font-size: 6.8px !important; line-height: 1.25 !important; text-align: justify !important; color: #333 !important; white-space: pre-line !important; }
            .top-info-box { border: 1.5px solid #888 !important; padding: 5px 8px !important; border-radius: 3px !important; background: #fafafa !important; }
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
        if (['media', 'photos', 'notes', 'signature'].includes(categoryKey)) return;

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
            const subVal = categoryValue[subKey];
            const actualStatus = typeof subVal === 'object' && subVal !== null ? (subVal.status || subVal.result || subVal.value || "OK") : subVal;
            items.push({
              name: subKey,
              status: actualStatus,
              note: typeof subVal === 'object' && subVal !== null ? (subVal.note || "") : "",
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
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #111", paddingBottom: "4px", marginBottom: "4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {currentShop.logo_url && (
          <img src={currentShop.logo_url} alt="Logo" style={{ maxHeight: "32px", maxWidth: "100px", objectFit: "contain" }} />
        )}
        <h1 style={{ fontSize: "14px", fontWeight: 800, margin: 0, letterSpacing: "-0.2px" }}>{currentShop.name}</h1>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: "11px", fontWeight: 800 }}>{t("print.contractTitle")}</div>
        <div style={{ fontSize: "8.5px" }}><strong>Nr.:</strong> {order?.auftragsnummer || order?.orderNumber || "—"} · <strong>Datum:</strong> {order?.created_at ? berlinDate(order.created_at) : berlinDate()}</div>
      </div>
    </div>
  );

  const renderSignatureBlock = () => (
    <div className="signature-section" style={{ borderTop: "1.5px solid #222", paddingTop: "5px", marginTop: "5px", display: "flex", justifyContent: "space-between", alignItems: "flex-end", pageBreakInside: "avoid" }}>
      <div>
        <div style={{ fontSize: "8px", marginBottom: "8px", fontWeight: "bold" }}>Berlin, {berlinDate()}</div>
        <div style={{ borderTop: "1px solid #000", width: "110px", paddingTop: "2px", fontSize: "7.5px", textAlign: "center" }}>{t("print.signatureShop")}</div>
      </div>
      <div style={{ textAlign: "center" }}>
        {order?.intake_signature || order?.signature ? (
          <img src={order.intake_signature || order.signature} alt="Unterschrift" style={{ maxHeight: "26px", margin: "0 auto 2px", display: "block" }} />
        ) : <div style={{ height: "26px" }} />}
        <div style={{ borderTop: "1px solid #000", width: "120px", paddingTop: "2px", fontSize: "7.5px" }}>{t("print.signatureCustomer")}</div>
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
          <div id="vertrag" style={{ width: "190mm", background: "#ffffff", color: "#111111", padding: "6mm", boxSizing: "border-box", boxShadow: "0 0 10px rgba(0,0,0,0.1)", borderRadius: "4px" }}>

            {order.status === "STORNIERT" && (
              <div data-testid="print-canceled-banner" style={{
                textAlign: "center", border: "2px solid #c00", color: "#c00",
                fontWeight: 700, fontSize: "14px", letterSpacing: "2px",
                padding: "3px", margin: "0 0 4px", transform: "rotate(-1.5deg)",
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

            <div style={{ fontSize: "8px", color: "#555", marginBottom: "6px" }}>
              {currentShop.address}
              {currentShop.whatsapp && <> · WhatsApp: {currentShop.whatsapp}</>}
              {currentShop.email && <> · E-Mail: {currentShop.email}</>}
            </div>

            {/* بيانات العميل والجهاز — خط كبير وواضح */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
              <div className="top-info-box" style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: "10px", borderBottom: "1.5px solid #bbb", paddingBottom: "3px", marginBottom: "5px", color: "#000" }}>{t("print.customerData")}</div>
                <div style={{ fontSize: "9.5px", lineHeight: 1.5 }}>
                  <div><strong>Name:</strong> <span style={{ fontSize: "12px", fontWeight: 800 }}>{order?.customer_name || order?.customerName || "—"}</span></div>
                  <div><strong>Telefon:</strong> <span style={{ fontSize: "10.5px", fontWeight: 700 }}>{order?.customer_phone || order?.customerPhone || "—"}</span></div>
                  <div><strong>E-Mail:</strong> {order?.customer_email || order?.customerEmail || "—"}</div>
                  <div><strong>Adresse:</strong> {order?.customer_address || order?.customerAddress || "—"}</div>
                </div>
              </div>
              <div className="top-info-box" style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: "10px", borderBottom: "1.5px solid #bbb", paddingBottom: "3px", marginBottom: "5px", color: "#000" }}>{t("print.deviceData")}</div>
                <div style={{ fontSize: "9.5px", lineHeight: 1.5 }}>
                  <div><strong>Gerät:</strong> <span style={{ fontSize: "12px", fontWeight: 800 }}>{order?.device_brand || order?.brand || ""} {order?.device_model || order?.model || "—"}</span></div>
                  <div><strong>IMEI/SN:</strong> <span style={{ fontSize: "10.5px", fontWeight: 700 }}>{order?.imei || order?.serialNumber || "—"}</span></div>
                  <div><strong>Sperre:</strong> {order?.device_lock_type && order?.device_lock_type !== "none" ? order.device_lock_type : "—"}</div>
                  <div><strong>Fehler:</strong> <span style={{ fontSize: "10.5px", fontWeight: 700 }}>{order?.issue_description || order?.issue || "—"}</span></div>
                  {order?.battery_health && <div><strong>Akku-Gesundheit:</strong> {order.battery_health}%</div>}
                </div>
              </div>
            </div>

            {/* صور الاستلام — الصور المكسورة تختفي تلقائياً، لا تظهر أبداً بالمستند */}
            {intakeMediaList.length > 0 && (
              <div className="section-block">
                <div style={{ fontSize: "9.5px", fontWeight: 800, marginBottom: "3px", borderBottom: "1.5px solid #111", paddingBottom: "2px" }}>Zustandsprotokoll Fotos (Eingang)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "4px" }}>
                  {getIntakeMediaList().map((url, idx) => (
                    brokenImages[idx] ? null : (
                      <img
                        key={idx}
                        src={url}
                        alt=""
                        onError={() => setBrokenImages((prev) => ({ ...prev, [idx]: true }))}
                        style={{
                          width: "60px", height: "60px", objectFit: "cover",
                          border: "1px solid #999", borderRadius: "3px", display: "block",
                        }}
                      />
                    )
                  ))}
                </div>
              </div>
            )}

            {/* جدول الفحص */}
            {hasChecklist && (
              <div className="section-block">
                <h2 style={{ fontSize: "9.5px", marginBottom: "3px", fontWeight: 800, borderBottom: "1.5px solid #ccc", paddingBottom: "2px" }}>Prüfprotokoll (Mitarbeiter)</h2>
                {checkListItems.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "3px", marginBottom: "5px" }}>
                    {checkListItems.map((item, index) => {
                      const statusVal = item.status || item.result || item.value || "—";
                      const isOk = statusVal === "OK" || statusVal === "true" || statusVal === true;
                      return (
                        <div key={index} style={{ width: "32%", border: "1px solid #ddd", padding: "3px 5px", borderRadius: "2px", background: "#fafafa", fontSize: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", boxSizing: "border-box" }}>
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
                  <div style={{ border: "1px solid #ccc", padding: "3px 5px", borderRadius: "2px", background: "#fbfbfb", marginTop: "3px" }}>
                    <div style={{ fontSize: "8px", fontWeight: "bold", marginBottom: "1px" }}>Reparaturnotizen:</div>
                    <div style={{ fontSize: "8px", color: "#333" }}>{order.repair_notes}</div>
                  </div>
                )}
              </div>
            )}

            <div className="section-block" style={{ border: "1px solid #ccc", padding: "3px 5px", borderRadius: "2px", background: "#fff" }}>
              <div style={{ fontWeight: "bold", fontSize: "9px", marginBottom: "2px" }}>{t("print.termsTitle")} (Haftungsausschluss)</div>
              <div className="legal-box" style={{ whiteSpace: "pre-line" }}>{LIABILITY_WAIVER}</div>
            </div>

            <div className="section-block">
              <h2 style={{ fontSize: "9.5px", marginBottom: "2px", fontWeight: 800, borderBottom: "1.5px solid #ccc", paddingBottom: "2px" }}>Allgemeine Geschäftsbedingungen (AGB)</h2>
              <div className="legal-box" style={{ whiteSpace: "pre-line" }}>{AGB_FULL}</div>
            </div>

            <div className="section-block">
              <h2 style={{ fontSize: "9.5px", marginBottom: "2px", fontWeight: 800, borderBottom: "1.5px solid #ccc", paddingBottom: "2px" }}>Datenschutzerklärung (DSGVO)</h2>
              <div className="legal-box" style={{ whiteSpace: "pre-line" }}>{DSGVO_FULL}</div>
            </div>

            {renderSignatureBlock()}

          </div>
        </div>

      </div>
    </div>
  );
}