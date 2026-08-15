import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api, { fileUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, SlaBadge } from "@/components/StatusBadge";
import OrderChat from "@/components/OrderChat";
import OrderPurchasesTab from "@/components/OrderPurchasesTab";
import Abholschein from "@/components/Abholschein";
import Invoice from "@/components/Invoice";
import CameraCapture from "@/components/CameraCapture";
import SignaturePad from "@/components/SignaturePad";
import WhatsAppFab from "@/components/WhatsAppFab";
import CommunicationPanel from "@/components/CommunicationPanel";
import InspectionForm from "@/components/InspectionForm";
import ContractPrint from "@/components/ContractPrint";
import { PatternDisplay } from "@/components/PatternLock";
import { STATUS_LABELS, COST_STATUS_LABELS, COST_STATUS_STYLES, PICKUP_WAIVER } from "@/lib/constants";
import { berlinDateTime } from "@/lib/datetime";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import {
  ArrowLeft, Printer, CheckCircle, XCircle, Wrench, Package,
  UploadSimple, ShieldCheck, DeviceMobile, User, ClockCounterClockwise, Camera,
  Receipt, Trash, Plus, VideoCamera, ListChecks, ShoppingCart,
  Warning, Signature, ArrowsClockwise, ChatCircleDots, ClipboardText,
} from "@phosphor-icons/react";

const LOCK_LABELS = { none: "Keine Sperre", pattern: "Muster", pin: "PIN", password: "Passwort" };

function Section({ title, icon: Icon, children }) {
  return (
    <div className="border border-border">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/60">
        {Icon && <Icon size={16} className="text-accent" />}
        <h2 className="font-head font-semibold text-sm tracking-tight">{title}</h2>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right break-words">{value || "—"}</span>
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [branches, setBranches] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [partId, setPartId] = useState("");
  const [partQty, setPartQty] = useState(1);
  const [costForm, setCostForm] = useState({ diagnosis_fee: "", labor_cost: "", parts_cost: "" });
  const [comms, setComms] = useState([]);
  const [audit, setAudit] = useState([]);
  
  // حالة التبويب النشط ونظام المشتريات
  const [activeTab, setActiveTab] = useState("details"); // "details" | "purchases"
  const [purchasesCount, setPurchasesCount] = useState(0);
  const [imeiInput, setImeiInput] = useState("");
  const [savingSig, setSavingSig] = useState(false);

  const canManageRef = user.role === "admin" || user.role === "mitarbeiter";

  const loadComms = useCallback(() => {
    if (!canManageRef) return;
    api.get(`/orders/${id}/communications`).then((r) => setComms(r.data)).catch(() => {});
    api.get(`/orders/${id}/audit`).then((r) => setAudit(r.data)).catch(() => {});
  }, [id, canManageRef]);

  const loadPurchasesCount = useCallback(() => {
    api.get(`/purchases/order/${id}`).then((r) => setPurchasesCount(r.data.length)).catch(() => {});
  }, [id]);

  const load = useCallback(async () => {
    const { data } = await api.get(`/orders/${id}`);
    setOrder(data);
    setCostForm({
      diagnosis_fee: data.cost?.diagnosis_fee ?? 0,
      labor_cost: data.cost?.labor_cost ?? 0,
      parts_cost: data.cost?.parts_cost ?? 0,
    });
  }, [id]);

  useEffect(() => {
    load();
    loadPurchasesCount();
    api.get("/branches").then((r) => setBranches(r.data));
    if (user.role !== "techniker") api.get("/technicians").then((r) => setTechnicians(r.data));
    api.get("/inventory").then((r) => setInventory(r.data));
    loadComms();
  }, [load, loadPurchasesCount, user.role, loadComms]);

  if (!order) return <div className="p-8 font-mono text-muted-foreground">Lade Auftrag…</div>;

  const branchName = branches.find((b) => b.id === order.branch_id)?.name || "—";

  const act = async (fn, msg) => {
    try { await fn(); toast.success(msg); await load(); loadComms(); }
    catch (e) { toast.error(e.response?.data?.detail || "Fehler"); }
  };

  const assign = (techId) => act(() => api.post(`/orders/${id}/assign`, { techniker_id: techId }), "Techniker zugewiesen");
  const accept = () => act(() => api.post(`/orders/${id}/accept`), "Auftrag akzeptiert");
  const doReject = () => {
    if (!rejectReason.trim()) { toast.error("Grund erforderlich"); return; }
    act(() => api.post(`/orders/${id}/reject`, { reason: rejectReason }), "Auftrag abgelehnt")
      .then(() => { setShowReject(false); setRejectReason(""); });
  };
  const setStatus = (status) => act(() => api.patch(`/orders/${id}/status`, { status }), `Status: ${STATUS_LABELS[status]}`);

  const saveCosts = () => act(() => api.patch(`/orders/${id}/costs`, {
    diagnosis_fee: parseFloat(costForm.diagnosis_fee) || 0,
    labor_cost: parseFloat(costForm.labor_cost) || 0,
    parts_cost: parseFloat(costForm.parts_cost) || 0,
  }), "Kosten gespeichert");

  const setCostStatus = (cost_status) => act(() => api.patch(`/orders/${id}/costs`, { cost_status }), "Kostenstatus aktualisiert");

  const addPart = () => {
    if (!partId) { toast.error("Ersatzteil wählen"); return; }
    act(() => api.post(`/orders/${id}/parts`, { inventory_id: partId, quantity: parseInt(partQty) || 1 }), "Ersatzteil verbaut (Lagerabzug)")
      .then(() => { setPartId(""); setPartQty(1); api.get("/inventory").then((r) => setInventory(r.data)); });
  };

  const removePart = (pid) => act(() => api.delete(`/orders/${id}/parts/${pid}`), "Ersatzteil entfernt (Bestand zurück)")
    .then(() => api.get("/inventory").then((r) => setInventory(r.data)));

  const saveImei = () => {
    if (!imeiInput.trim()) { toast.error("Bitte IMEI eingeben"); return; }
    act(() => api.patch(`/orders/${id}/imei`, { imei: imeiInput.trim() }), "IMEI nachgetragen")
      .then(() => setImeiInput(""));
  };

  const saveSignature = async (type, dataUrl) => {
    setSavingSig(true);
    try {
      await api.post(`/orders/${id}/signature`, { type, signature: dataUrl, signer_name: order.customer_name || "" });
      toast.success(type === "pickup" ? "Abhol-Unterschrift gespeichert" : "Unterschrift gespeichert");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Fehler beim Speichern der Unterschrift");
    } finally { setSavingSig(false); }
  };

  const uploadFiles = async (files) => {
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("media_type", user.role === "techniker" ? "repair" : "intake");
        await api.post(`/orders/${id}/media`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
      toast.success("Medien hochgeladen");
      await load();
    } catch (err) {
      toast.error("Upload fehlgeschlagen");
    } finally { setUploading(false); }
  };

  const uploadRepair = (e) => uploadFiles(Array.from(e.target.files || []));
  const uploadCaptured = (file) => uploadFiles([file]);

  const intakeMedia = (order.media || []).filter((m) => m.media_type === "intake");
  const repairMedia = (order.media || []).filter((m) => m.media_type === "repair");

  const isTech = user.role === "techniker";
  const canManage = user.role === "admin" || user.role === "mitarbeiter";

  // Live cost totals: when the user can edit costs, compute Netto/MwSt/Brutto
  // from the local costForm state so the totals update in real-time as they type.
  const liveNet = canManage
    ? (parseFloat(costForm.diagnosis_fee) || 0) + (parseFloat(costForm.labor_cost) || 0) + (parseFloat(costForm.parts_cost) || 0)
    : Number(order.cost?.net || 0);
  const liveTax = canManage ? liveNet * 0.19 : Number(order.cost?.tax || 0);
  const liveGross = canManage ? liveNet + liveTax : Number(order.cost?.gross || 0);

  return (
    <div>
      <PageHeader label={branchName} title={order.auftragsnummer}>
        <button data-testid="back-button" onClick={() => navigate("/auftraege")}
          className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-primary-foreground transition-colors">
          <ArrowLeft size={16} /> Zurück
        </button>
      </PageHeader>

      {/* Status + Actions bar */}
      <div className="flex flex-wrap items-center gap-3 px-6 md:px-8 py-4 border-b border-border/60">
        <StatusBadge status={order.status} />
        {order.sla_breached && <SlaBadge days={order.working_days_open} />}
        {order.imei_reminder && (
          <span data-testid="imei-reminder-badge" className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border border-amber-600 bg-amber-950 text-amber-300 rounded-lg animate-pulse">
            <Warning size={13} weight="fill" /> IMEI fehlt – bitte nachtragen
          </span>
        )}
        {order.under_warranty && (
          <span data-testid="warranty-badge" className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border border-emerald-600 bg-emerald-950 text-emerald-300 rounded-lg">
            <ShieldCheck size={13} weight="fill" /> Garantie aktiv{typeof order.warranty_days_left === "number" ? ` · ${order.warranty_days_left} Tage` : ""}
          </span>
        )}
        {order.is_reclamation && (
          <span data-testid="reclamation-badge" className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border border-amber-600 bg-amber-950 text-amber-300 rounded-lg">
            <ArrowsClockwise size={13} weight="fill" /> Reklamation{order.reclamation_of_number ? ` zu ${order.reclamation_of_number}` : ""}
          </span>
        )}
        <div className="flex-1" />

        {canManage && (
          <select data-testid="manual-status-select" value={order.status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-background border border-border px-3 py-2 text-xs font-mono uppercase tracking-wider rounded-lg outline-none focus:border-accent">
            {["ANGENOMMEN", "IN_BEARBEITUNG", "WARTEN_ERSATZTEIL", "FERTIG", "ABGEHOLT"].map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
            {!["ANGENOMMEN", "IN_BEARBEITUNG", "WARTEN_ERSATZTEIL", "FERTIG", "ABGEHOLT"].includes(order.status) && (
              <option value={order.status} disabled>{STATUS_LABELS[order.status]}</option>
            )}
          </select>
        )}

        {canManage && (
          <button data-testid="open-receipt" onClick={() => setShowReceipt(true)}
            className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider border border-border px-4 py-2 hover:bg-muted hover:text-primary-foreground transition-colors">
            <Printer size={14} /> Abholschein
          </button>
        )}
        {canManage && (
          <button data-testid="open-contract" onClick={() => setShowContract(true)}
            className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider border border-border px-4 py-2 hover:bg-muted hover:text-primary-foreground transition-colors">
            <ClipboardText size={14} /> Komplett-Druck
          </button>
        )}
        {canManage && order.status === "ABGEHOLT" && (
          <button data-testid="open-invoice" onClick={() => setShowInvoice(true)}
            className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-blue-600 hover:text-primary-foreground transition-colors">
            <Printer size={14} /> Rechnung drucken
          </button>
        )}
        {canManage && order.status === "ABGEHOLT" && (
          <button data-testid="open-reklamation" onClick={() => navigate("/auftrag/neu", { state: { reclamationOf: {
              id: order.id, auftragsnummer: order.auftragsnummer, branch_id: order.branch_id,
              device_brand: order.device_brand, device_model: order.device_model, imei: order.imei,
              customer_name: order.customer_name, customer_phone: order.customer_phone,
              customer_email: order.customer_email, customer_address: order.customer_address,
            } } })}
            className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider border border-amber-600 text-amber-300 px-4 py-2 rounded-lg hover:bg-amber-950 transition-colors">
            <ArrowsClockwise size={14} /> Reklamation
          </button>
        )}
        {canManage && order.status === "FERTIG" && (
          <button data-testid="mark-delivered" onClick={() => setStatus("ABGEHOLT")}
            className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider bg-emerald-600 text-foreground px-4 py-2 hover:bg-emerald-500 transition-colors">
            <CheckCircle size={14} /> Abgeholt
          </button>
        )}
        {isTech && order.status === "ZUGEWIESEN" && (
          <>
            <button data-testid="accept-order" onClick={accept}
              className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider bg-primary text-primary-foreground px-4 py-2 hover:bg-blue-600 hover:text-primary-foreground transition-colors">
              <CheckCircle size={14} /> Annehmen
            </button>
            <button data-testid="reject-order" onClick={() => setShowReject(true)}
              className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider bg-red-600 text-foreground px-4 py-2 hover:bg-red-500 transition-colors">
              <XCircle size={14} /> Ablehnen
            </button>
          </>
        )}
        {isTech && order.status === "AKZEPTIERT" && (
          <button data-testid="start-repair" onClick={() => setStatus("IN_BEARBEITUNG")}
            className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider bg-amber-600 text-foreground px-4 py-2 hover:bg-amber-500 transition-colors">
            <Wrench size={14} /> Reparatur starten
          </button>
        )}
        {isTech && order.status === "IN_BEARBEITUNG" && (
          <>
            <button data-testid="wait-part" onClick={() => setStatus("WARTEN_ERSATZTEIL")}
              className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider bg-orange-600 text-foreground px-4 py-2 hover:bg-orange-500 transition-colors">
              <Package size={14} /> Warten auf Ersatzteil
            </button>
            <button data-testid="mark-ready" onClick={() => setStatus("FERTIG")} disabled={repairMedia.length === 0 || !order.inspection}
              title={repairMedia.length === 0 ? "Erst Reparatur-Fotos/Videos aufnehmen" : (!order.inspection ? "Erst Prüfprotokoll ausfüllen" : "")}
              className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider bg-emerald-600 text-foreground px-4 py-2 hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <CheckCircle size={14} /> Fertig melden
            </button>
          </>
        )}
        {isTech && order.status === "WARTEN_ERSATZTEIL" && (
          <button data-testid="resume-repair" onClick={() => setStatus("IN_BEARBEITUNG")}
            className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider bg-amber-600 text-foreground px-4 py-2 hover:bg-amber-500 transition-colors">
            <Wrench size={14} /> Reparatur fortsetzen
          </button>
        )}
      </div>

      {/* نظام التبويبات (Tabs Navigation) الاحترافي */}
      <div className="flex items-center gap-2 px-6 md:px-8 border-b border-border bg-card/40">
        <button
          onClick={() => setActiveTab("details")}
          className={`px-4 py-3 text-xs font-head font-semibold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === "details" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Auftragsdetails & Teile
        </button>
        <button
          onClick={() => {
            setActiveTab("purchases");
            loadPurchasesCount();
          }}
          className={`px-4 py-3 text-xs font-head font-semibold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "purchases" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShoppingCart size={14} /> Beschaffung & Einkauf
          {purchasesCount > 0 && (
            <span className="bg-accent/20 text-accent px-1.5 py-0.5 rounded-full text-[10px] font-mono">
              {purchasesCount}
            </span>
          )}
        </button>
      </div>

      {order.status === "ABGELEHNT" && order.reject_reason && (
        <div className="mx-6 md:mx-8 my-4 border border-red-900 bg-red-950/30 px-4 py-3">
          <div className="font-mono text-[11px] uppercase tracking-wider text-red-400 mb-1">Ablehnungsgrund</div>
          <div className="text-sm text-red-200">{order.reject_reason}</div>
        </div>
      )}

      {/* محتوى التبويبات */}
      {activeTab === "purchases" ? (
        <div className="p-6 md:p-8 max-w-4xl mx-auto w-full">
          <div className="border border-border p-6 bg-card/20 rounded-lg">
            <OrderPurchasesTab orderId={order.id} onChange={setPurchasesCount} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 p-6 md:p-8">
          {/* LEFT column */}
          <div className="lg:col-span-2 space-y-4">
            <Section title="Gerät & Fehler" icon={DeviceMobile}>
              <Field label="Marke / Modell" value={`${order.device_brand} ${order.device_model}`} />
              <Field label="IMEI" value={order.imei || (order.imei_unreadable ? "— (nicht lesbar)" : "—")} />
              {order.imei_reminder && (
                <div data-testid="imei-fillin" className="my-2 border border-amber-800/60 bg-amber-950/20 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-amber-300 mb-2">
                    <Warning size={13} weight="fill" /> IMEI ausstehend – sobald Gerät zugänglich, bitte nachtragen
                  </div>
                  <div className="flex gap-2">
                    <input data-testid="imei-input" value={imeiInput} onChange={(e) => setImeiInput(e.target.value)}
                      placeholder="IMEI / Seriennummer" className="flex-1 bg-background border border-border px-3 py-2 text-sm rounded-lg outline-none focus:border-accent font-mono" />
                    <button data-testid="imei-save" onClick={saveImei}
                      className="text-xs font-head font-semibold uppercase tracking-wider bg-primary text-primary-foreground px-4 rounded-lg hover:bg-blue-600 transition-colors">
                      Speichern
                    </button>
                  </div>
                </div>
              )}
              <Field label="Geräte-Sperre" value={LOCK_LABELS[order.device_lock_type] || (order.device_passcode ? "PIN/Passwort" : "Keine Sperre")} />
              {order.device_lock_type === "pattern" && order.device_passcode ? (
                <div className="flex justify-between items-center gap-4 py-1.5 border-b border-border/40">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground shrink-0">Muster</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-foreground">{order.device_passcode.split("-").join(" → ")}</span>
                    <PatternDisplay value={order.device_passcode} size={72} />
                  </div>
                </div>
              ) : (
                <Field label="Sperrwert" value={order.device_passcode} />
              )}
              <Field label="Fehlerbeschreibung" value={order.issue_description} />
              <Field label="Garantie" value={
                order.warranty_months
                  ? (order.warranty_until
                      ? `${order.warranty_months} Monate · gültig bis ${berlinDateTime(order.warranty_until)}${order.under_warranty ? " (aktiv)" : " (abgelaufen)"}`
                      : `${order.warranty_months} Monate (ab Abholung)`)
                  : "Keine Garantie"
              } />
            </Section>

            {/* Kostenaufschlüsselung */}
            {!isTech && (
            <div className="border border-border">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60">
                <div className="flex items-center gap-2">
                  <Receipt size={16} className="text-accent" />
                  <h2 className="font-head font-semibold text-sm tracking-tight">Kostenaufschlüsselung</h2>
                </div>
                <span data-testid="cost-status-badge" className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded-lg ${COST_STATUS_STYLES[order.cost?.status] || "bg-muted text-foreground/80 border-border"}`}>
                  {COST_STATUS_LABELS[order.cost?.status] || "—"}
                </span>
              </div>
              <div className="p-4">
                {canManage ? (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Diagnose</label>
                      <input data-testid="cost-diagnosis-input" type="number" step="0.01" value={costForm.diagnosis_fee}
                        onChange={(e) => setCostForm({ ...costForm, diagnosis_fee: e.target.value })}
                        className="w-full bg-background border border-border px-2 py-1.5 text-sm rounded-lg outline-none focus:border-accent font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Arbeitskosten</label>
                      <input data-testid="cost-labor-input" type="number" step="0.01" value={costForm.labor_cost}
                        onChange={(e) => setCostForm({ ...costForm, labor_cost: e.target.value })}
                        className="w-full bg-background border border-border px-2 py-1.5 text-sm rounded-lg outline-none focus:border-accent font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Materialkosten</label>
                      <input data-testid="cost-parts-input" type="number" step="0.01" value={costForm.parts_cost}
                        onChange={(e) => setCostForm({ ...costForm, parts_cost: e.target.value })}
                        className="w-full bg-background border border-border px-2 py-1.5 text-sm rounded-lg outline-none focus:border-accent font-mono" />
                    </div>
                  </div>
                ) : (
                  <div className="font-mono text-sm space-y-1 mb-3">
                    <div className="flex justify-between text-muted-foreground"><span>Diagnosegebühr</span><span>{Number(order.cost?.diagnosis_fee || 0).toFixed(2)} €</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Arbeitskosten</span><span>{Number(order.cost?.labor_cost || 0).toFixed(2)} €</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Materialkosten</span><span>{Number(order.cost?.parts_cost || 0).toFixed(2)} €</span></div>
                  </div>
                )}

                <div className="border-t border-border pt-3 font-mono text-sm space-y-1">
                  <div className="flex justify-between text-muted-foreground"><span>Netto</span><span data-testid="detail-cost-net">{liveNet.toFixed(2)} €</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>MwSt. (19%)</span><span data-testid="detail-cost-tax">{liveTax.toFixed(2)} €</span></div>
                  <div className="flex justify-between text-foreground font-semibold text-base border-t border-border pt-1.5 mt-1.5"><span>Gesamt (Brutto)</span><span data-testid="detail-cost-gross">{liveGross.toFixed(2)} €</span></div>
                </div>

                {canManage && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button data-testid="save-costs" onClick={saveCosts}
                      className="text-xs font-head font-semibold uppercase tracking-wider bg-primary text-primary-foreground px-4 py-2 hover:bg-blue-600 hover:text-primary-foreground transition-colors">
                      Kosten speichern
                    </button>
                    <div className="flex-1" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Freigabe:</span>
                    <button data-testid="cost-approve" onClick={() => setCostStatus("BESTAETIGT")}
                      className="text-xs font-mono uppercase tracking-wider border border-emerald-700 text-emerald-300 px-3 py-2 hover:bg-emerald-950 transition-colors">Bestätigt</button>
                    <button data-testid="cost-wait" onClick={() => setCostStatus("WARTET")}
                      className="text-xs font-mono uppercase tracking-wider border border-amber-700 text-amber-300 px-3 py-2 hover:bg-amber-950 transition-colors">Wartet</button>
                    <button data-testid="cost-reject" onClick={() => setCostStatus("ABGELEHNT")}
                      className="text-xs font-mono uppercase tracking-wider border border-red-700 text-red-300 px-3 py-2 hover:bg-red-950 transition-colors">Abgelehnt</button>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Verbaute Ersatzteile */}
            <div className="border border-border">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/60">
                <Package size={16} className="text-accent" />
                <h2 className="font-head font-semibold text-sm tracking-tight">Verbaute Ersatzteile</h2>
              </div>
              <div className="p-4">
                {(order.used_parts || []).length === 0 ? (
                  <div className="text-xs font-mono text-muted-foreground/70 py-3 text-center">Noch keine Ersatzteile verbaut.</div>
                ) : (
                  <div className="space-y-2 mb-3">
                    {order.used_parts.map((p) => (
                      <div key={p.id} data-testid={`used-part-${p.sku}`} className="flex items-center justify-between border border-border/60 px-3 py-2">
                        <div className="min-w-0">
                          <div className="text-sm text-foreground truncate">{p.name}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{p.sku} · {p.quantity}×{!isTech && p.unit_price != null ? ` à ${Number(p.unit_price).toFixed(2)} €` : ""}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {!isTech && p.total != null && (
                            <span className="font-mono text-sm text-foreground">{Number(p.total).toFixed(2)} €</span>
                          )}
                          {order.status !== "ABGEHOLT" && (
                            <button data-testid={`remove-part-${p.sku}`} onClick={() => removePart(p.id)} className="p-1 border border-border hover:bg-red-950 text-red-400"><Trash size={13} /></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {order.status !== "ABGEHOLT" && (
                  <div className="flex gap-2 border-t border-border pt-3">
                    <select data-testid="part-select" value={partId} onChange={(e) => setPartId(e.target.value)}
                      className="flex-1 min-w-0 bg-background border border-border px-2 py-2 text-sm rounded-lg outline-none focus:border-accent">
                      <option value="">— Ersatzteil aus Lager wählen —</option>
                      {inventory.filter((i) => i.quantity > 0).map((i) => (
                        <option key={i.id} value={i.id}>{`${i.brand} ${i.device_model} · ${i.part_type} (${i.quantity} · ${Number(i.price).toFixed(2)}€)`}</option>
                      ))}
                    </select>
                    <input data-testid="part-qty" type="number" min="1" value={partQty} onChange={(e) => setPartQty(e.target.value)}
                      className="w-16 bg-background border border-border px-2 py-2 text-sm rounded-lg outline-none focus:border-accent font-mono" />
                    <button data-testid="add-part" onClick={addPart}
                      className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-head font-semibold uppercase tracking-wider px-3 hover:bg-blue-600 hover:text-primary-foreground transition-colors">
                      <Plus size={14} /> Verbauen
                    </button>
                  </div>
                )}
              </div>
            </div>

            {isTech ? (
              <div className="border border-amber-900/50 bg-amber-950/20 px-4 py-3 flex items-center gap-3">
                <ShieldCheck size={20} className="text-amber-400 shrink-0" />
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-amber-400">DSGVO-Schutz</div>
                  <div className="text-xs text-muted-foreground">Kundendaten sind für Techniker aus Datenschutzgründen ausgeblendet.</div>
                </div>
              </div>
            ) : (
              <Section title="Kundendaten" icon={User}>
                <Field label="Name" value={order.customer_name} />
                <Field label="Telefon" value={order.customer_phone} />
                <Field label="E-Mail" value={order.customer_email} />
                <Field label="Adresse" value={order.customer_address} />
              </Section>
            )}

            {/* Media */}
            <Section title="Zustandsprotokoll (Eingang)" icon={Camera}>
              {intakeMedia.length === 0 ? (
                <div className="text-xs font-mono text-muted-foreground/70 py-4 text-center">Keine Eingangs-Medien.</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {intakeMedia.map((m) => <MediaThumb key={m.id} m={m} />)}
                </div>
              )}
            </Section>

            <Section title="Reparatur-Dokumentation" icon={Wrench}>
              {isTech && repairMedia.length === 0 && order.status !== "ABGEHOLT" && (
                <div data-testid="repair-media-required" className="mb-3 border border-amber-800/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-300 font-mono">
                  Pflicht: Nehmen Sie vor „Fertig melden" Reparatur-Fotos/-Videos direkt über die Live-Kamera auf.
                </div>
              )}
              {repairMedia.length === 0 ? (
                <div className="text-xs font-mono text-muted-foreground/70 py-4 text-center">Noch keine Reparatur-Medien.</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                  {repairMedia.map((m) => <MediaThumb key={m.id} m={m} />)}
                </div>
              )}
              {(isTech || canManage) && order.status !== "ABGEHOLT" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label data-testid="upload-media-label" className="flex items-center justify-center gap-2 border border-dashed border-border py-3 cursor-pointer hover:border-accent transition-colors text-sm text-muted-foreground">
                    <UploadSimple size={16} /> {uploading ? "Lädt…" : "Datei hochladen"}
                    <input data-testid="upload-media-input" type="file" accept="image/*,video/*" multiple onChange={uploadRepair} className="hidden" disabled={uploading} />
                  </label>
                  <button data-testid="open-camera" onClick={() => setShowCamera(true)}
                    className="flex items-center justify-center gap-2 border border-dashed border-accent/50 py-3 hover:border-accent hover:bg-accent/5 transition-colors text-sm text-foreground/80">
                    <VideoCamera size={16} className="text-accent" /> Live-Kamera
                  </button>
                </div>
              )}
            </Section>

            {/* Endkontrolle / Prüfprotokoll (QC) */}
            {(isTech || canManage) && (
              <Section title={t("inspection.title")} icon={ClipboardText}>
                {order.inspection && order.status === "ABGEHOLT" ? (
                  <InspectionForm order={order} readOnly onSaved={load} />
                ) : (isTech || canManage) ? (
                  <>
                    <p className="text-[11px] font-mono text-amber-300 mb-3">{t("inspection.subtitle")}</p>
                    <InspectionForm order={order} onSaved={load} />
                  </>
                ) : (
                  <InspectionForm order={order} readOnly />
                )}
              </Section>
            )}

            {/* Digitale Unterschriften */}
            {canManage && (
              <Section title="Digitale Unterschriften" icon={Signature}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Intake / Abholschein */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Abgabe (Abholschein)</div>
                    {order.has_intake_signature && order.intake_signature ? (
                      <div className="space-y-1">
                        <div className="border border-border rounded-lg bg-white p-2">
                          <img src={order.intake_signature} alt="Unterschrift Abgabe" className="h-24 object-contain mx-auto" />
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {order.intake_signed_name || order.customer_name} · {order.intake_signed_at ? berlinDateTime(order.intake_signed_at) : ""}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <SignaturePad saving={savingSig} onSave={(d) => saveSignature("intake", d)} label="Kunde unterschreibt (Abgabe)" height={140} />
                      </div>
                    )}
                  </div>

                  {/* Pickup / Übergabe */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">Abholung / Übergabe</div>
                    {order.has_pickup_signature && order.pickup_signature ? (
                      <div className="space-y-1">
                        <div className="border border-border rounded-lg bg-white p-2">
                          <img src={order.pickup_signature} alt="Unterschrift Abholung" className="h-24 object-contain mx-auto" />
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {order.pickup_signed_name || order.customer_name} · {order.pickup_signed_at ? berlinDateTime(order.pickup_signed_at) : ""}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground whitespace-pre-line leading-relaxed border border-border/60 rounded-lg p-2 bg-card/30">{PICKUP_WAIVER}</p>
                        <SignaturePad saving={savingSig} onSave={(d) => saveSignature("pickup", d)} label="Kunde unterschreibt (Abholung)" height={140} />
                      </div>
                    )}
                  </div>
                </div>
              </Section>
            )}

            {/* Chat */}
            <OrderChat orderId={order.id} />
            {canManage && (
              <Section title="Kundenkommunikation · WhatsApp / SMS / E-Mail" icon={ChatCircleDots}>
                <CommunicationPanel order={order} onSent={loadComms} />
                <div className="mt-4 pt-4 border-t border-border/60">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">Verlauf</div>
                  {comms.length === 0 ? (
                    <div className="text-xs font-mono text-muted-foreground/70 py-3 text-center">Noch keine Nachrichten an den Kunden.</div>
                  ) : (
                    <div className="space-y-2" data-testid="comms-list">
                      {comms.map((c) => (
                        <div key={c.id} className="border border-border/60 px-3 py-2">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-accent">{(c.channel || "nachricht").toUpperCase()} → {c.to}{c.status ? ` · ${c.status}` : ""}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{berlinDateTime(c.at)}</span>
                          </div>
                          <div className="text-sm text-foreground">{c.message}</div>
                          <div className="font-mono text-[10px] text-muted-foreground/70 mt-1">von {c.by}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Audit-Log */}
            {canManage && (
              <Section title="Audit-Log · Historie" icon={ListChecks}>
                {audit.length === 0 ? (
                  <div className="text-xs font-mono text-muted-foreground/70 py-3 text-center">Keine Einträge.</div>
                ) : (
                  <div className="space-y-1" data-testid="audit-list">
                    {audit.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-3 border-b border-border/40 py-1.5 text-xs">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-accent shrink-0 w-24">{a.action}</span>
                        <span className="text-foreground/80 flex-1 truncate">{a.detail}</span>
                        <span className="font-mono text-[10px] text-muted-foreground shrink-0">{berlinDateTime(a.at)} · {a.by}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}
          </div>

          {/* RIGHT column */}
          <div className="space-y-4">
            <Section title="QR-Code" icon={Package}>
              <div className="flex flex-col items-center py-3">
                <div className="bg-white p-3">
                  <QRCodeCanvas value={order.auftragsnummer} size={140} level="M" />
                </div>
                <div className="font-mono text-sm text-foreground mt-3">{order.auftragsnummer}</div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Zum Scannen</div>
              </div>
            </Section>

            {canManage && (order.status === "ANGENOMMEN" || order.status === "ABGELEHNT" || !order.assigned_techniker_id) && (
              <Section title={order.status === "ABGELEHNT" ? "Neu zuweisen (nach Ablehnung)" : "Techniker zuweisen"} icon={Wrench}>
                {order.status === "ABGELEHNT" && (
                  <p data-testid="reassign-hint" className="text-[11px] font-mono text-amber-300 mb-2">
                    Auftrag wurde abgelehnt. Wählen Sie einen anderen Techniker, um erneut zuzuweisen.
                  </p>
                )}
                <select data-testid="assign-technician-select" defaultValue="" onChange={(e) => e.target.value && assign(e.target.value)}
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm rounded-lg outline-none focus:border-accent">
                  <option value="">— Techniker wählen —</option>
                  {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Section>
            )}

            <Section title="Verlauf" icon={ClockCounterClockwise}>
              <div className="space-y-3">
                {(order.status_history || []).slice().reverse().map((h, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      {i < order.status_history.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    <div className="pb-2">
                      <div className="text-sm text-foreground">{STATUS_LABELS[h.status] || h.status}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {berlinDateTime(h.at)} · {h.by}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      )}

      {showReceipt && <Abholschein order={order} branchName={branchName} onClose={() => setShowReceipt(false)} />}
      {showInvoice && <Invoice order={order} branchName={branchName} onClose={() => setShowInvoice(false)} />}
      {showContract && <ContractPrint order={order} branchName={branchName} onClose={() => setShowContract(false)} />}
      {showCamera && <CameraCapture onCapture={uploadCaptured} onClose={() => setShowCamera(false)} />}
      {canManage && order.customer_phone && <WhatsAppFab order={order} onLogged={loadComms} />}

      {showReject && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background border border-border max-w-md w-full p-6">
            <h3 className="font-head font-semibold text-lg mb-1">Auftrag ablehnen</h3>
            <p className="text-sm text-muted-foreground mb-4">Bitte geben Sie einen Grund für die Ablehnung an.</p>
            <textarea data-testid="reject-reason-input" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4}
              placeholder="z.B. Ersatzteil nicht verfügbar, Wasserschaden zu groß…"
              className="w-full bg-background border border-border px-3 py-2.5 text-sm rounded-lg outline-none focus:border-accent" />
            <div className="flex gap-3 mt-4">
              <button data-testid="confirm-reject" onClick={doReject}
                className="flex-1 bg-red-600 text-foreground font-head font-semibold text-sm uppercase tracking-wider py-2.5 hover:bg-red-500 transition-colors">
                Ablehnen
              </button>
              <button onClick={() => setShowReject(false)}
                className="px-6 border border-border text-muted-foreground hover:text-primary-foreground hover:bg-muted transition-colors">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MediaThumb({ m }) {
  const url = fileUrl(m.storage_path);
  return (
    <a href={url} target="_blank" rel="noreferrer" data-testid={`media-${m.id}`}
      className="block aspect-square border border-border overflow-hidden bg-background hover:border-accent transition-colors">
      {m.is_video ? (
        <video src={url} className="w-full h-full object-cover" />
      ) : (
        <img src={url} alt={m.original_filename} className="w-full h-full object-cover" />
      )}
    </a>
  );
}
