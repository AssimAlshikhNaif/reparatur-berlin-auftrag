import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Printer, X } from "@phosphor-icons/react";
import { berlinDateTime, berlinDate } from "@/lib/datetime";
import { SHOP_INFO, LIABILITY_WAIVER, AGB_FULL } from "@/lib/constants";

export default function ContractPrint({ order, branchName, onClose }) {
  const { t } = useTranslation();

  useEffect(() => {
    const after = () => { if (onClose) onClose(); };
    window.addEventListener("afterprint", after);
    return () => window.removeEventListener("afterprint", after);
  }, [onClose]);

  const cell = { padding: "3px 0", fontSize: "12px", color: "#111" };
  const lbl = { ...cell, color: "#555", width: "42%", verticalAlign: "top" };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-background border border-border max-w-3xl w-full my-6">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-head font-semibold text-sm">{t("print.contractTitle")} · {order.auftragsnummer}</h3>
          <div className="flex items-center gap-2">
            <button data-testid="contract-print-button" onClick={() => window.print()}
              className="flex items-center gap-2 bg-primary text-primary-foreground text-xs font-head font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-blue-600 transition-colors">
              <Printer size={14} /> {t("common.print")}
            </button>
            <button data-testid="contract-close-button" onClick={onClose}
              className="flex items-center gap-2 border border-border text-foreground text-xs font-head font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg hover:bg-muted transition-colors">
              <X size={14} /> {t("common.close")}
            </button>
          </div>
        </div>

        <div className="p-6 bg-card flex justify-center">
          <div id="vertrag" style={{ width: "190mm", padding: "12mm", background: "#fff", color: "#111", fontFamily: "Arial, sans-serif" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "18px", fontWeight: 700 }}>{SHOP_INFO.name}</div>
                <div style={{ fontSize: "11px", color: "#444", marginTop: "4px", lineHeight: 1.5 }}>
                  {SHOP_INFO.addressLine1}<br />{SHOP_INFO.addressLine2}<br />
                  {SHOP_INFO.phone} · {SHOP_INFO.email}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "20px", fontWeight: 700 }}>{t("print.contractTitle")}</div>
                <div style={{ fontSize: "12px", marginTop: "6px" }}>Nr.: {order.auftragsnummer}</div>
                <div style={{ fontSize: "12px" }}>Datum: {berlinDate(order.created_at)}</div>
                <div style={{ fontSize: "11px", color: "#444" }}>Filiale: {branchName || "—"}</div>
              </div>
            </div>

            <hr style={{ margin: "16px 0", border: "none", borderTop: "1px solid #ccc" }} />

            <div style={{ display: "flex", gap: "24px" }}>
              <table style={{ width: "50%" }}>
                <tbody>
                  <tr><td colSpan={2} style={{ fontWeight: 700, fontSize: "13px", paddingBottom: "4px" }} data-testid="contract-customer">{t("print.customerData")}</td></tr>
                  <tr><td style={lbl}>Name</td><td style={cell}>{order.customer_name || "—"}</td></tr>
                  <tr><td style={lbl}>Telefon</td><td style={cell}>{order.customer_phone || "—"}</td></tr>
                  <tr><td style={lbl}>E-Mail</td><td style={cell}>{order.customer_email || "—"}</td></tr>
                  <tr><td style={lbl}>Adresse</td><td style={cell}>{order.customer_address || "—"}</td></tr>
                </tbody>
              </table>
              <table style={{ width: "50%" }}>
                <tbody>
                  <tr><td colSpan={2} style={{ fontWeight: 700, fontSize: "13px", paddingBottom: "4px" }} data-testid="contract-device">{t("print.deviceData")}</td></tr>
                  <tr><td style={lbl}>Gerät</td><td style={cell}>{order.device_brand} {order.device_model}</td></tr>
                  <tr><td style={lbl}>IMEI/SN</td><td style={cell}>{order.imei || "—"}</td></tr>
                  <tr><td style={lbl}>Sperre</td><td style={cell}>{order.device_lock_type && order.device_lock_type !== "none" ? order.device_lock_type : "—"}</td></tr>
                  <tr><td style={lbl}>Fehler</td><td style={cell}>{order.issue_description || "—"}</td></tr>
                </tbody>
              </table>
            </div>

            <div data-testid="contract-terms" style={{ marginTop: "18px", borderTop: "1px solid #ccc", paddingTop: "12px" }}>
              <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "6px" }}>{t("print.termsTitle")}</div>
              <div style={{ fontSize: "9px", color: "#333", lineHeight: 1.6, whiteSpace: "pre-line" }}>{LIABILITY_WAIVER}</div>
              <div style={{ fontSize: "9px", color: "#333", lineHeight: 1.6, whiteSpace: "pre-line", marginTop: "10px" }}>{AGB_FULL}</div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "28px", gap: "24px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "11px", marginBottom: "16px", fontWeight: 600 }}>Berlin, {berlinDate()}</div>
                <div style={{ borderTop: "1px solid #000", paddingTop: "4px", fontSize: "10px" }}>{t("print.signatureShop")}</div>
              </div>
              <div style={{ flex: 1, textAlign: "center" }}>
                {order.intake_signature ? (
                  <img src={order.intake_signature} alt="Unterschrift" style={{ maxHeight: "44px", margin: "0 auto 2px" }} />
                ) : <div style={{ height: "44px" }} />}
                <div style={{ borderTop: "1px solid #000", paddingTop: "4px", fontSize: "10px" }}>{t("print.signatureCustomer")}</div>
              </div>
            </div>
            <div style={{ marginTop: "10px", fontSize: "9px", color: "#666" }}>Erstellt: {berlinDateTime(order.created_at)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
