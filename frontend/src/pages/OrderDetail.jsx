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
import LabelPrint from "@/components/LabelPrint";
import { PatternDisplay } from "@/components/PatternLock";
import { STATUS_LABELS, COST_STATUS_LABELS, COST_STATUS_STYLES, PICKUP_WAIVER, PAYMENT_STATUS_STYLES, TECH_STATUS_FLOW } from "@/lib/constants";
import { berlinDateTime } from "@/lib/datetime";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import {
  ArrowLeft, Printer, CheckCircle, XCircle, Wrench, Package,
  UploadSimple, ShieldCheck, DeviceMobile, User, ClockCounterClockwise, Camera,
  Receipt, Trash, Plus, VideoCamera, ListChecks, ShoppingCart,
  Warning, Signature, ArrowsClockwise, ChatCircleDots, ClipboardText, Barcode, ShieldWarning, SpinnerGap,PencilSimple,
} from "@phosphor-icons/react";

const LOCK_LABELS = { none: "Keine Sperre", pattern: "Muster", pin: "PIN", password: "Passwort" }; // eslint-disable-line no-unused-vars

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
  const [showLabel, setShowLabel] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(null);
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
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canManageRef = user.role === "admin" || user.role === "mitarbeiter";
  const isAdmin = user.role === "admin";
  const isMitarbeiter = user.role === "mitarbeiter" || user.role === "techniker";

  const deleteOrder = async () => {
    setDeleting(true);
    try {
      await api.delete(`/orders/${id}`);
      toast.success(t("detail.deleteSuccess"));
      navigate("/auftraege");
    } catch (e) {
      toast.error(e.response?.data?.detail || t("detail.deleteError"));
      setDeleting(false);
    }
  };

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

  if (!order) return <div className="p-8 font-mono text-muted-foreground">{t("detail.loading")}</div>;

  const branchName = branches.find((b) => b.id === order.branch_id)?.name || "—";
  const currentBranch = branches.find((b) => String(b._id) === String(order.branch_id) || String(b.id) === String(order.branch_id));
  const act = async (fn, msg) => {
    try { await fn(); toast.success(msg); await load(); loadComms(); }
    catch (e) { toast.error(e.response?.data?.detail || t("toast.error")); }
  };

  const assign = (techId) => act(() => api.post(`/orders/${id}/assign`, { techniker_id: techId }), t("toast.techAssigned"));
  const accept = () => act(() => api.post(`/orders/${id}/accept`), t("toast.orderAccepted"));
  const doReject = () => {
    if (!rejectReason.trim()) { toast.error(t("toast.reasonRequired")); return; }
    act(() => api.post(`/orders/${id}/reject`, { reason: rejectReason }), t("toast.orderRejected"))
      .then(() => { setShowReject(false); setRejectReason(""); });
  };

  const doCancel = () => {
    if (!cancelReason.trim()) { toast.error(t("toast.reasonRequired")); return; }
    act(() => api.post(`/orders/${id}/cancel`, { reason: cancelReason }), t("detail.orderCanceled"))
      .then(() => { setShowCancel(false); setCancelReason(""); });
  };
  const openEdit = () => {
    setEditForm({
      customer_name: order.customer_name || "", customer_phone: order.customer_phone || "",
      customer_email: order.customer_email || "", customer_address: order.customer_address || "",
      device_brand: order.device_brand || "", device_model: order.device_model || "",
      imei: order.imei || "", device_passcode: order.device_passcode || "",
      issue_description: order.issue_description || "",
    });
    setShowEdit(true);
  };
  const saveEdit = () => {
    act(() => api.patch(`/orders/${id}`, editForm), t("detail.orderUpdated")).then(() => setShowEdit(false));
  };
  
  const setStatus = (status) => act(() => api.patch(`/orders/${id}/status`, { status }), t("toast.statusChanged", { s: t(`status.${status}`, STATUS_LABELS[status]) }));

  const saveCosts = () => act(() => api.patch(`/orders/${id}/costs`, {
    diagnosis_fee: parseFloat(costForm.diagnosis_fee) || 0,
    labor_cost: parseFloat(costForm.labor_cost) || 0,
    parts_cost: parseFloat(costForm.parts_cost) || 0,
  }), t("toast.costsSaved"));

  const setCostStatus = (cost_status) => act(() => api.patch(`/orders/${id}/costs`, { cost_status }), t("toast.costStatusUpdated"));
  const setDiagnosisPayment = (diagnosis_payment_status) => act(() => api.patch(`/orders/${id}/costs`, { diagnosis_payment_status }), t("toast.paymentStatusUpdated"));

  const addPart = () => {
    if (!partId) { toast.error(t("toast.choosePart")); return; }
    act(() => api.post(`/orders/${id}/parts`, { inventory_id: partId, quantity: parseInt(partQty) || 1 }), t("toast.partInstalled"))
      .then(() => { setPartId(""); setPartQty(1); api.get("/inventory").then((r) => setInventory(r.data)); });
  };

  const removePart = (pid) => act(() => api.delete(`/orders/${id}/parts/${pid}`), t("toast.partRemoved"))
    .then(() => api.get("/inventory").then((r) => setInventory(r.data)));

  const saveImei = () => {
    if (!imeiInput.trim()) { toast.error(t("toast.enterImei")); return; }
    act(() => api.patch(`/orders/${id}/imei`, { imei: imeiInput.trim() }), t("toast.imeiSaved"))
      .then(() => setImeiInput(""));
  };

  const saveSignature = async (type, dataUrl) => {
    setSavingSig(true);
    try {
      await api.post(`/orders/${id}/signature`, { type, signature: dataUrl, signer_name: order.customer_name || "" });
      toast.success(type === "pickup" ? t("toast.pickupSigSaved") : t("toast.sigSaved"));
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || t("toast.sigError"));
    } finally { setSavingSig(false); }
  };

 const deleteMedia = async (m, index) => {
    // نختار أثبت قيمة تدل على الصورة
    const mediaId = m.filename || m.storage_path?.split("/").pop() || m.file_path?.split("/").pop() || m.id || m._id || index;
    try {
      await api.delete(`/orders/${id}/media/${encodeURIComponent(mediaId)}`);
      toast.success(t("toast.mediaDeleted") || "Bild erfolgreich gelöscht");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.detail || t("toast.deleteFailed") || "Fehler beim Löschen");
    }
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
      toast.success(t("toast.mediaUploaded"));
      await load();
    } catch (err) {
      toast.error(t("toast.uploadFailed"));
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
  const liveGross = canManage
  ? (parseFloat(costForm.diagnosis_fee) || 0) + (parseFloat(costForm.labor_cost) || 0) + (parseFloat(costForm.parts_cost) || 0)
  : Number(order.cost?.gross || 0);
const liveNet = canManage ? liveGross / 1.19 : Number(order.cost?.net || 0);
const liveTax = canManage ? liveGross - liveNet : Number(order.cost?.tax || 0);

  return (
    <div>
      <PageHeader label={branchName} title={order.auftragsnummer}>
        {isAdmin && (
          <button data-testid="delete-order-button" onClick={() => setShowDelete(true)}
            className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider border border-red-700 bg-red-950/40 text-red-300 px-3 py-2 rounded-lg hover:bg-red-700 hover:text-white transition-colors">
            <Trash size={15} weight="bold" /> {t("detail.deleteOrder")}
          </button>
        )}
        <button data-testid="back-button" onClick={() => navigate("/auftraege")}
          className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-primary-foreground transition-colors">
          <ArrowLeft size={16} /> {t("common.back")}
        </button>
      </PageHeader>

      {/* Status + Actions bar */}
      <div className="flex flex-wrap items-center gap-3 px-6 md:px-8 py-4 border-b border-border/60">
        <StatusBadge status={order.status} />
        {order.sla_breached && <SlaBadge days={order.working_days_open} />}
        {order.imei_reminder && (
          <span data-testid="imei-reminder-badge" className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border border-amber-600 bg-amber-950 text-amber-300 rounded-lg animate-pulse">
            <Warning size={13} weight="fill" /> {t("detail.imeiMissing")}
          </span>
        )}
        {order.under_warranty && (
          <span data-testid="warranty-badge" className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border border-emerald-600 bg-emerald-950 text-emerald-300 rounded-lg">
            <ShieldCheck size={13} weight="fill" /> {t("detail.warrantyActive")}{typeof order.warranty_days_left === "number" ? ` · ${t("detail.days", { d: order.warranty_days_left })}` : ""}
          </span>
        )}
        {order.is_reclamation && (
          <span data-testid="reclamation-badge" className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider border border-amber-600 bg-amber-950 text-amber-300 rounded-lg">
            <ArrowsClockwise size={13} weight="fill" /> {t("actions.reklamation")}{order.reclamation_of_number ? ` · ${order.reclamation_of_number}` : ""}
          </span>
        )}
        <div className="flex-1" />

        {canManage && (
          <select data-testid="manual-status-select" value={order.status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-background border border-border px-3 py-2 text-xs font-mono uppercase tracking-wider rounded-lg outline-none focus:border-accent">
            {["ANGENOMMEN", "WARTEN_FREIGABE", "IN_BEARBEITUNG", "WARTEN_ERSATZTEIL", "FERTIG", "ABGEHOLT"].map((s) => (
              <option key={s} value={s}>{t(`status.${s}`, STATUS_LABELS[s])}</option>
            ))}
            {!["ANGENOMMEN", "WARTEN_FREIGABE", "IN_BEARBEITUNG", "WARTEN_ERSATZTEIL", "FERTIG", "ABGEHOLT"].includes(order.status) && (
              <option value={order.status} disabled>{t(`status.${order.status}`, STATUS_LABELS[order.status])}</option>
            )}
          </select>
        )}

        {/* Technician technical-phase status control (exact 4-step flow) */}
        {isTech && !["ZUGEWIESEN", "ABGELEHNT", "ABGEHOLT"].includes(order.status) && (
          <select data-testid="tech-status-select"
            value={TECH_STATUS_FLOW.includes(order.status) ? order.status : ""}
            onChange={(e) => e.target.value && setStatus(e.target.value)}
            className="bg-background border border-border px-3 py-2 text-xs font-mono uppercase tracking-wider rounded-lg outline-none focus:border-accent">
            {!TECH_STATUS_FLOW.includes(order.status) && (
              <option value="">{t(`status.${order.status}`, STATUS_LABELS[order.status])}</option>
            )}
            {TECH_STATUS_FLOW.map((s) => (
              <option key={s} value={s}>{t(`status.${s}`, STATUS_LABELS[s])}</option>
            ))}
          </select>
        )}

        {canManage && order.status !== "STORNIERT" && (
          <button data-testid="open-edit" onClick={openEdit}
            className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider border border-border px-4 py-2 hover:bg-muted hover:text-primary-foreground transition-colors">
            <PencilSimple size={14} /> {t("detail.editOrder")}
          </button>
        )}
        {canManage && order.status !== "STORNIERT" && (
          <button data-testid="open-cancel" onClick={() => setShowCancel(true)}
            className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider border border-red-800 text-red-400 px-4 py-2 hover:bg-red-950 transition-colors">
            <XCircle size={14} /> {t("detail.cancelOrder")}
          </button>
        )}

        {/* Device QR/barcode sticker — restricted to Admin & Reception (DSGVO / role isolation) */}
        {canManage && (
          <button data-testid="open-label" onClick={() => setShowLabel(true)}
            className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider border border-border px-4 py-2 hover:bg-muted hover:text-primary-foreground transition-colors">
            <Barcode size={14} /> {t("label.button")}
          </button>
        )}

        {canManage && (
          <button data-testid="open-receipt" onClick={() => setShowReceipt(true)}
            className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider border border-border px-4 py-2 hover:bg-muted hover:text-primary-foreground transition-colors">
            <Printer size={14} /> {t("actions.receipt")}
          </button>
        )}
        {canManage && (
          <button data-testid="open-contract" onClick={() => setShowContract(true)}
            className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider border border-border px-4 py-2 hover:bg-muted hover:text-primary-foreground transition-colors">
            <ClipboardText size={14} /> {t("actions.fullPrint")}
          </button>
        )}
        
        
        {canManage && order.status === "ABGEHOLT" && (
          <button data-testid="open-invoice" onClick={() => setShowInvoice(true)}
            className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-blue-600 hover:text-primary-foreground transition-colors">
            <Printer size={14} /> {t("actions.printInvoice")}
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
            <ArrowsClockwise size={14} /> {t("actions.reklamation")}
          </button>
        )}
        {canManage && order.status === "FERTIG" && (
          <button data-testid="mark-delivered" onClick={() => setStatus("ABGEHOLT")}
            className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider bg-emerald-600 text-foreground px-4 py-2 hover:bg-emerald-500 transition-colors">
            <CheckCircle size={14} /> {t("actions.collected")}
          </button>
        )}
        {isTech && order.status === "ZUGEWIESEN" && (
          <>
            <button data-testid="accept-order" onClick={accept}
              className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider bg-primary text-primary-foreground px-4 py-2 hover:bg-blue-600 hover:text-primary-foreground transition-colors">
              <CheckCircle size={14} /> {t("actions.accept")}
            </button>
            <button data-testid="reject-order" onClick={() => setShowReject(true)}
              className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider bg-red-600 text-foreground px-4 py-2 hover:bg-red-500 transition-colors">
              <XCircle size={14} /> {t("actions.reject")}
            </button>
          </>
        )}
        {isTech && order.status === "AKZEPTIERT" && (
          <button data-testid="start-repair" onClick={() => setStatus("IN_BEARBEITUNG")}
            className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider bg-amber-600 text-foreground px-4 py-2 hover:bg-amber-500 transition-colors">
            <Wrench size={14} /> {t("actions.startRepair")}
          </button>
        )}
        {isTech && order.status === "IN_BEARBEITUNG" && (
          <>
            <button data-testid="wait-part" onClick={() => setStatus("WARTEN_ERSATZTEIL")}
              className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider bg-orange-600 text-foreground px-4 py-2 hover:bg-orange-500 transition-colors">
              <Package size={14} /> {t("actions.waitPart")}
            </button>
            <button data-testid="mark-ready" onClick={() => setStatus("FERTIG")} disabled={repairMedia.length === 0 || !order.inspection}
              title={repairMedia.length === 0 ? t("detail.markReadyMediaTitle") : (!order.inspection ? t("detail.markReadyInspectionTitle") : "")}
              className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider bg-emerald-600 text-foreground px-4 py-2 hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <CheckCircle size={14} /> {t("actions.markReady")}
            </button>
          </>
        )}
        {isTech && order.status === "WARTEN_ERSATZTEIL" && (
          <button data-testid="resume-repair" onClick={() => setStatus("IN_BEARBEITUNG")}
            className="flex items-center gap-2 text-xs font-head font-semibold uppercase tracking-wider bg-amber-600 text-foreground px-4 py-2 hover:bg-amber-500 transition-colors">
            <Wrench size={14} /> {t("actions.resumeRepair")}
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
          {t("detail.tabDetails")}
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
          <ShoppingCart size={14} /> {t("detail.tabPurchases")}
          {purchasesCount > 0 && (
            <span className="bg-accent/20 text-accent px-1.5 py-0.5 rounded-full text-[10px] font-mono">
              {purchasesCount}
            </span>
          )}
        </button>
      </div>

      {order.status === "ABGELEHNT" && order.reject_reason && (
        <div className="mx-6 md:mx-8 my-4 border border-red-900 bg-red-950/30 px-4 py-3">
          <div className="font-mono text-[11px] uppercase tracking-wider text-red-400 mb-1">{t("detail.rejectReason")}</div>
          <div className="text-sm text-red-200">{order.reject_reason}</div>
        </div>
      )}

      {order.status === "STORNIERT" && (
        <div data-testid="cancel-reason-banner" className="mx-6 md:mx-8 my-4 border-2 border-red-700 bg-red-950/40 px-4 py-3">
          <div className="font-mono text-[11px] uppercase tracking-wider text-red-400 mb-1">{t("detail.cancelReason")}</div>
          <div className="text-sm text-red-200">{order.cancel_reason}</div>
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
            <Section title={t("detail.deviceError")} icon={DeviceMobile}>
              <Field label={t("detail.brandModel")} value={`${order.device_brand} ${order.device_model}`} />
              <Field label={t("detail.imei")} value={order.imei || (order.imei_unreadable ? t("detail.imeiNotReadable") : "—")} />
              {order.imei_reminder && (
                <div data-testid="imei-fillin" className="my-2 border border-amber-800/60 bg-amber-950/20 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-amber-300 mb-2">
                    <Warning size={13} weight="fill" /> {t("detail.imeiMissing")}
                  </div>
                  <div className="flex gap-2">
                    <input data-testid="imei-input" value={imeiInput} onChange={(e) => setImeiInput(e.target.value)}
                      placeholder={t("detail.imei")} className="flex-1 bg-background border border-border px-3 py-2 text-sm rounded-lg outline-none focus:border-accent font-mono" />
                    <button data-testid="imei-save" onClick={saveImei}
                      className="text-xs font-head font-semibold uppercase tracking-wider bg-primary text-primary-foreground px-4 rounded-lg hover:bg-blue-600 transition-colors">
                      {t("common.save")}
                    </button>
                  </div>
                </div>
              )}
              <Field label={t("detail.lock")} value={(!order.device_lock_type || order.device_lock_type === "none") ? t("detail.noLock") : (order.device_lock_type === "pattern" ? t("detail.pattern") : order.device_lock_type.toUpperCase())} />
              {order.device_lock_type === "pattern" && order.device_passcode ? (
                <div className="flex justify-between items-center gap-4 py-1.5 border-b border-border/40">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground shrink-0">{t("detail.pattern")}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-foreground">{order.device_passcode.split("-").join(" → ")}</span>
                    <PatternDisplay value={order.device_passcode} size={72} />
                  </div>
                </div>
              ) : (
                <Field label={t("detail.lockValue")} value={order.device_passcode} />
              )}
              <Field label={t("detail.issue")} value={order.issue_description} />
              <Field label={t("detail.warranty")} value={
                order.warranty_months
                  ? (order.warranty_until
                      ? `${order.warranty_months} · ${berlinDateTime(order.warranty_until)}${order.under_warranty ? ` (${t("reklamation.badgeWarranty")})` : ""}`
                      : t("detail.warrantyMonthsFrom", { m: order.warranty_months }))
                  : t("detail.noWarranty")
              } />
            </Section>

            {/* Kostenaufschlüsselung */}
            {!isTech && (
            <div className="border border-border">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60">
                <div className="flex items-center gap-2">
                  <Receipt size={16} className="text-accent" />
                  <h2 className="font-head font-semibold text-sm tracking-tight">{t("costs.title")}</h2>
                </div>
                <span data-testid="cost-status-badge" className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded-lg ${COST_STATUS_STYLES[order.cost?.status] || "bg-muted text-foreground/80 border-border"}`}>
                  {order.cost?.status ? t("costs." + ({WARTET:"waiting",BESTAETIGT:"confirmed",ABGELEHNT:"rejected"}[order.cost.status] || "waiting")) : "—"}
                </span>
              </div>
              <div className="p-4">
                {canManage ? (
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{t("costs.diagnosis")}</label>
                      <input data-testid="cost-diagnosis-input" type="number" step="0.01" value={costForm.diagnosis_fee}
                        onChange={(e) => setCostForm({ ...costForm, diagnosis_fee: e.target.value })}
                        className="w-full bg-background border border-border px-2 py-1.5 text-sm rounded-lg outline-none focus:border-accent font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{t("costs.labor")}</label>
                      <input data-testid="cost-labor-input" type="number" step="0.01" value={costForm.labor_cost}
                        onChange={(e) => setCostForm({ ...costForm, labor_cost: e.target.value })}
                        className="w-full bg-background border border-border px-2 py-1.5 text-sm rounded-lg outline-none focus:border-accent font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{t("costs.attempt")}</label>
                      <input data-testid="cost-parts-input" type="number" step="0.01" value={costForm.parts_cost}
                        onChange={(e) => setCostForm({ ...costForm, parts_cost: e.target.value })}
                        className="w-full bg-background border border-border px-2 py-1.5 text-sm rounded-lg outline-none focus:border-accent font-mono" />
                    </div>
                  </div>
                ) : (
                  <div className="font-mono text-sm space-y-1 mb-3">
                    <div className="flex justify-between text-muted-foreground"><span>{t("costs.diagnosisFee")}</span><span>{Number(order.cost?.diagnosis_fee || 0).toFixed(2)} €</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>{t("costs.labor")}</span><span>{Number(order.cost?.labor_cost || 0).toFixed(2)} €</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>{t("costs.attempt")}</span><span>{Number(order.cost?.parts_cost || 0).toFixed(2)} €</span></div>
                  </div>
                )}

                <div className="border-t border-border pt-3 font-mono text-sm space-y-1">
                  <div className="flex justify-between text-muted-foreground"><span>{t("costs.net")}</span><span data-testid="detail-cost-net">{liveNet.toFixed(2)} €</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>{t("costs.tax")}</span><span data-testid="detail-cost-tax">{liveTax.toFixed(2)} €</span></div>
                  <div className="flex justify-between text-foreground font-semibold text-base border-t border-border pt-1.5 mt-1.5"><span>{t("costs.gross")}</span><span data-testid="detail-cost-gross">{liveGross.toFixed(2)} €</span></div>
                </div>

                {/* Diagnosegebühr Zahlungsstatus */}
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{t("costs.paymentLabel")}</span>
                  {canManage ? (
                    <select data-testid="diagnosis-payment-select" value={order.diagnosis_payment_status || "OPEN"}
                      onChange={(e) => setDiagnosisPayment(e.target.value)}
                      className="bg-background border border-border px-2 py-1 text-xs font-mono uppercase tracking-wider rounded-lg outline-none focus:border-accent">
                      <option value="OPEN">{t("costs.open")}</option>
                      <option value="PAID">{t("costs.paid")}</option>
                      <option value="NA">{t("costs.na")}</option>
                    </select>
                  ) : (
                    <span data-testid="diagnosis-payment-badge" className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded-lg ${PAYMENT_STATUS_STYLES[order.diagnosis_payment_status] || "bg-muted border-border"}`}>
                      {t("costs." + ({PAID:"paid",OPEN:"open",NA:"na"}[order.diagnosis_payment_status] || "open"))}
                    </span>
                  )}
                </div>

                {canManage && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button data-testid="save-costs" onClick={saveCosts}
                      className="text-xs font-head font-semibold uppercase tracking-wider bg-primary text-primary-foreground px-4 py-2 hover:bg-blue-600 hover:text-primary-foreground transition-colors">
                      {t("costs.save")}
                    </button>
                    <div className="flex-1" />
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{t("costs.release")}</span>
                    <button data-testid="cost-approve" onClick={() => setCostStatus("BESTAETIGT")}
                      className="text-xs font-mono uppercase tracking-wider border border-emerald-700 text-emerald-300 px-3 py-2 hover:bg-emerald-950 transition-colors">{t("costs.confirmed")}</button>
                    <button data-testid="cost-wait" onClick={() => setCostStatus("WARTET")}
                      className="text-xs font-mono uppercase tracking-wider border border-amber-700 text-amber-300 px-3 py-2 hover:bg-amber-950 transition-colors">{t("costs.waiting")}</button>
                    <button data-testid="cost-reject" onClick={() => setCostStatus("ABGELEHNT")}
                      className="text-xs font-mono uppercase tracking-wider border border-red-700 text-red-300 px-3 py-2 hover:bg-red-950 transition-colors">{t("costs.rejected")}</button>
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Verbaute Ersatzteile */}
            <div className="border border-border">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/60">
                <Package size={16} className="text-accent" />
                <h2 className="font-head font-semibold text-sm tracking-tight">{t("detail.partsTitle")}</h2>
              </div>
              <div className="p-4">
                {(order.used_parts || []).length === 0 ? (
                  <div className="text-xs font-mono text-muted-foreground/70 py-3 text-center">{t("detail.noParts")}</div>
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
                      <option value="">{t("detail.choosePart")}</option>
                      {inventory.filter((i) => i.quantity > 0).map((i) => (
                        <option key={i.id} value={i.id}>{`${i.brand} ${i.device_model} · ${i.part_type} (${i.quantity} · ${Number(i.price).toFixed(2)}€)`}</option>
                      ))}
                    </select>
                    <input data-testid="part-qty" type="number" min="1" value={partQty} onChange={(e) => setPartQty(e.target.value)}
                      className="w-16 bg-background border border-border px-2 py-2 text-sm rounded-lg outline-none focus:border-accent font-mono" />
                    <button data-testid="add-part" onClick={addPart}
                      className="flex items-center gap-1 bg-primary text-primary-foreground text-xs font-head font-semibold uppercase tracking-wider px-3 hover:bg-blue-600 hover:text-primary-foreground transition-colors">
                      <Plus size={14} /> {t("detail.install")}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {isTech ? (
              <div className="border border-amber-900/50 bg-amber-950/20 px-4 py-3 flex items-center gap-3">
                <ShieldCheck size={20} className="text-amber-400 shrink-0" />
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-wider text-amber-400">{t("detail.dsgvoTitle")}</div>
                  <div className="text-xs text-muted-foreground">{t("detail.dsgvoDesc")}</div>
                </div>
              </div>
            ) : (
              <Section title={t("detail.customer")} icon={User}>
                <Field label={t("detail.name")} value={order.customer_name} />
                <Field label={t("detail.phone")} value={order.customer_phone} />
                <Field label={t("detail.email")} value={order.customer_email} />
                <Field label={t("detail.address")} value={order.customer_address} />
              </Section>
            )}

            {/* Media */}
            <Section title={t("detail.intakeMedia")} icon={Camera}>
              {intakeMedia.length === 0 ? (
                <div className="text-xs font-mono text-muted-foreground/70 py-4 text-center">{t("detail.noIntakeMedia")}</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
               {intakeMedia.map((m, index) => (
               <MediaThumb key={m.id || m._id || index} m={m} onDelete={() => deleteMedia(m, index)} />
            ))}
                </div>
              )}
            </Section>

            <Section title={t("detail.repairDoc")} icon={Wrench}>
              {isTech && repairMedia.length === 0 && order.status !== "ABGEHOLT" && (
                <div data-testid="repair-media-required" className="mb-3 border border-amber-800/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-300 font-mono">
                  {t("detail.repairRequired")}
                </div>
              )}
              {repairMedia.length === 0 ? (
                <div className="text-xs font-mono text-muted-foreground/70 py-4 text-center">{t("detail.noRepairMedia")}</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
                 {repairMedia.map((m, index) => (
  <MediaThumb key={m.id || m._id || index} m={m} onDelete={() => deleteMedia(m, index)} />
))}
                </div>
              )}
              {(isTech || canManage) && order.status !== "ABGEHOLT" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label data-testid="upload-media-label" className="flex items-center justify-center gap-2 border border-dashed border-border py-3 cursor-pointer hover:border-accent transition-colors text-sm text-muted-foreground">
                    <UploadSimple size={16} /> {uploading ? t("common.loading") : t("detail.uploadFile")}
                    <input data-testid="upload-media-input" type="file" accept="image/*,video/*" multiple onChange={uploadRepair} className="hidden" disabled={uploading} />
                  </label>
                  <button data-testid="open-camera" onClick={() => setShowCamera(true)}
                    className="flex items-center justify-center gap-2 border border-dashed border-accent/50 py-3 hover:border-accent hover:bg-accent/5 transition-colors text-sm text-foreground/80">
                    <VideoCamera size={16} className="text-accent" /> {t("detail.liveCamera")}
                  </button>
                </div>
              )}
              
            </Section>

           
{/* Endkontrolle / Prüfprotokoll & Eingangsprüfung */}
<div className="space-y-6">
  
  {/* 1. فحص الاستلام (Eingangsprüfung) */}
  <Section title="Eingangsprüfung (Mitarbeiter)" icon={ClipboardText}>
    {(() => {
      const hasIntake = Boolean(order.intake_inspection?.checklist && Object.keys(order.intake_inspection.checklist).length > 0);
      const isReadOnly = hasIntake && !canManage && !isMitarbeiter;
      
      return (
        <div className="space-y-3">
          {hasIntake && (
            <p className="text-[11px] font-mono text-emerald-400">
              ✓ Eingangsprüfung durchgeführt von {order.intake_inspection.by || "Mitarbeiter"}
            </p>
          )}
          <InspectionForm 
            order={order} 
            inspectionType="intake" 
            inspectionData={order.intake_inspection} 
            readOnly={isReadOnly} 
            onSaved={load} 
          />
        </div>
      );
    })()}
  </Section>

  {/* 2. فحص النهاية (Endkontrolle) */}
  {(isTech || canManage || isMitarbeiter) && (
    <Section title={t("inspection.title")} icon={ClipboardText}>
      {(() => {
        const hasEnd = Boolean(order.inspection?.checklist && Object.keys(order.inspection.checklist).length > 0);
        const isReadOnly = (hasEnd && order.status === "ABGEHOLT") || (!isTech && !canManage);

        return (
          <div className="space-y-3">
            <p className="text-[11px] font-mono text-amber-300">{t("inspection.subtitle")}</p>
            {hasEnd && (
              <p className="text-[11px] font-mono text-emerald-400">
                ✓ Endkontrolle durchgeführt von {order.inspection.by || "Techniker"}
              </p>
            )}
            <InspectionForm 
              order={order} 
              inspectionType="end" 
              inspectionData={order.inspection} 
              readOnly={isReadOnly} 
              onSaved={load} 
            />
          </div>
        );
      })()}
    </Section>
  )}

</div>

            {/* Digitale Unterschriften */}
            {canManage && (
              <Section title={t("detail.signatures")} icon={Signature}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Intake / Abholschein */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{t("detail.sigIntake")}</div>
                    {order.has_intake_signature && order.intake_signature ? (
                      <div className="space-y-1">
                        <div className="border border-border rounded-lg bg-white p-2">
                          <img src={order.intake_signature} alt={t("detail.sigIntake")} className="h-24 object-contain mx-auto" />
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {order.intake_signed_name || order.customer_name} · {order.intake_signed_at ? berlinDateTime(order.intake_signed_at) : ""}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <SignaturePad saving={savingSig} onSave={(d) => saveSignature("intake", d)} label={t("detail.sigIntakeSign")} height={140} />
                      </div>
                    )}
                  </div>

                  {/* Pickup / Übergabe */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{t("detail.sigPickup")}</div>
                    {order.has_pickup_signature && order.pickup_signature ? (
                      <div className="space-y-1">
                        <div className="border border-border rounded-lg bg-white p-2">
                          <img src={order.pickup_signature} alt={t("detail.sigPickup")} className="h-24 object-contain mx-auto" />
                        </div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {order.pickup_signed_name || order.customer_name} · {order.pickup_signed_at ? berlinDateTime(order.pickup_signed_at) : ""}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground whitespace-pre-line leading-relaxed border border-border/60 rounded-lg p-2 bg-card/30">{PICKUP_WAIVER}</p>
                        <SignaturePad saving={savingSig} onSave={(d) => saveSignature("pickup", d)} label={t("detail.sigPickupSign")} height={140} />
                      </div>
                    )}
                  </div>
                </div>
              </Section>
            )}

            {/* Chat */}
            <OrderChat orderId={order.id} />
            {canManage && (
              <Section title={t("detail.commTitle")} icon={ChatCircleDots}>
                <CommunicationPanel order={order} onSent={loadComms} />
                <div className="mt-4 pt-4 border-t border-border/60">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">{t("detail.history")}</div>
                  {comms.length === 0 ? (
                    <div className="text-xs font-mono text-muted-foreground/70 py-3 text-center">{t("detail.noMessages")}</div>
                  ) : (
                    <div className="space-y-2" data-testid="comms-list">
                      {comms.map((c) => (
                        <div key={c.id} className="border border-border/60 px-3 py-2">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-accent">{(c.channel || t("detail.channelDefault")).toUpperCase()} → {c.to}{c.status ? ` · ${c.status}` : ""}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">{berlinDateTime(c.at)}</span>
                          </div>
                          <div className="text-sm text-foreground">{c.message}</div>
                          <div className="font-mono text-[10px] text-muted-foreground/70 mt-1">{t("detail.msgFrom")} {c.by}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Audit-Log */}
            {canManage && (
              <Section title={t("detail.auditTitle")} icon={ListChecks}>
                {audit.length === 0 ? (
                  <div className="text-xs font-mono text-muted-foreground/70 py-3 text-center">{t("detail.noAudit")}</div>
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
            <Section title={t("detail.qr")} icon={Package}>
              <div className="flex flex-col items-center py-3">
                <div className="bg-white p-3">
                  <QRCodeCanvas value={order.auftragsnummer} size={140} level="M" />
                </div>
                <div className="font-mono text-sm text-foreground mt-3">{order.auftragsnummer}</div>
                <div className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{t("detail.scanHint")}</div>
              </div>
            </Section>

            {canManage && (order.status === "ANGENOMMEN" || order.status === "ABGELEHNT" || !order.assigned_techniker_id) && (
              <Section title={order.status === "ABGELEHNT" ? t("detail.reassignTitle") : t("detail.assignTech")} icon={Wrench}>
                {order.status === "ABGELEHNT" && (
                  <p data-testid="reassign-hint" className="text-[11px] font-mono text-amber-300 mb-2">
                    {t("detail.reassignHint")}
                  </p>
                )}
                <select data-testid="assign-technician-select" defaultValue="" onChange={(e) => e.target.value && assign(e.target.value)}
                  className="w-full bg-background border border-border px-3 py-2.5 text-sm rounded-lg outline-none focus:border-accent">
                  <option value="">{t("detail.chooseTech")}</option>
                  {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Section>
            )}

            <Section title={t("detail.history")} icon={ClockCounterClockwise}>
              <div className="space-y-3">
                {(order.status_history || []).slice().reverse().map((h, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center pt-1">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      {i < order.status_history.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    <div className="pb-2">
                      <div className="text-sm text-foreground">{t(`status.${h.status}`, STATUS_LABELS[h.status] || h.status)}</div>
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

      {showReceipt && <Abholschein order={order} branchName={branchName} branchInfo={branches.find((b) => b.name?.trim().toLowerCase() === branchName?.trim().toLowerCase())} onClose={() => setShowReceipt(false)} />}
      {showInvoice && <Invoice order={order} branchName={branchName} branchInfo={branches.find((b) => b.name?.trim().toLowerCase() === branchName?.trim().toLowerCase())} onClose={() => setShowInvoice(false)} />}
      {showContract && <ContractPrint order={{ ...order, inspection: order.inspection || order.checklist }} branchName={branchName} branchInfo={branches.find((b) => b.id === order.branch_id)} onClose={() => setShowContract(false)} />}
      {showLabel && <LabelPrint order={order} onClose={() => setShowLabel(false)} />}

      {showDelete && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div data-testid="delete-order-modal" className="bg-card border border-red-900/60 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-red-300">
              <ShieldWarning size={22} weight="fill" />
              <h3 className="font-head font-semibold text-lg">{t("detail.deleteTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("detail.deleteConfirm", { nr: order.auftragsnummer })}
            </p>
            <div className="flex gap-3 pt-1">
              <button data-testid="delete-order-confirm" onClick={deleteOrder} disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 bg-red-700 text-white font-head font-semibold text-sm uppercase tracking-wider py-2.5 rounded-lg hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {deleting ? <SpinnerGap size={16} className="animate-spin" /> : <Trash size={16} />} {t("detail.deleteConfirmBtn")}
              </button>
              <button data-testid="delete-order-cancel" onClick={() => setShowDelete(false)} disabled={deleting}
                className="px-6 border border-border rounded-lg text-xs font-mono uppercase tracking-wider text-muted-foreground hover:bg-muted transition-colors flex items-center gap-1.5">
                <XCircle size={14} /> {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
      {showCamera && <CameraCapture onCapture={uploadCaptured} onClose={() => setShowCamera(false)} />}
      {canManage && order.customer_phone && <WhatsAppFab order={order} onLogged={loadComms} />}

      {showReject && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background border border-border max-w-md w-full p-6">
            <h3 className="font-head font-semibold text-lg mb-1">{t("detail.rejectTitle")}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t("detail.rejectDesc")}</p>
            <textarea data-testid="reject-reason-input" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4}
              placeholder={t("detail.rejectPlaceholder")}
              className="w-full bg-background border border-border px-3 py-2.5 text-sm rounded-lg outline-none focus:border-accent" />
            <div className="flex gap-3 mt-4">
              <button data-testid="confirm-reject" onClick={doReject}
                className="flex-1 bg-red-600 text-foreground font-head font-semibold text-sm uppercase tracking-wider py-2.5 hover:bg-red-500 transition-colors">
                {t("actions.reject")}
              </button>
              <button onClick={() => setShowReject(false)}
                className="px-6 border border-border text-muted-foreground hover:text-primary-foreground hover:bg-muted transition-colors">
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancel && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background border border-red-800 max-w-md w-full p-6 rounded-xl">
            <h3 className="font-head font-semibold text-lg mb-1 text-red-300">{t("detail.cancelTitle")}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t("detail.cancelDesc")}</p>
            <textarea data-testid="cancel-reason-input" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={4}
              placeholder={t("detail.cancelPlaceholder")}
              className="w-full bg-background border border-border px-3 py-2.5 text-sm rounded-lg outline-none focus:border-accent" />
            <div className="flex gap-3 mt-4">
              <button data-testid="confirm-cancel" onClick={doCancel}
                className="flex-1 bg-red-700 text-foreground font-head font-semibold text-sm uppercase tracking-wider py-2.5 rounded-lg hover:bg-red-600 transition-colors">
                {t("detail.confirmCancel")}
              </button>
              <button onClick={() => { setShowCancel(false); setCancelReason(""); }}
                className="px-6 border border-border text-muted-foreground hover:text-primary-foreground hover:bg-muted transition-colors rounded-lg">
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEdit && editForm && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-background border border-border max-w-lg w-full p-6 rounded-xl my-8">
            <h3 className="font-head font-semibold text-lg mb-4">{t("detail.editOrder")}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ["customer_name", t("oc.name")], ["customer_phone", t("oc.phone")],
                ["customer_email", t("oc.email")], ["customer_address", t("oc.address")],
                ["device_brand", t("oc.brand")], ["device_model", t("oc.model")],
                ["imei", t("oc.imei")], ["device_passcode", t("oc.lockValue")],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{label}</label>
                  <input data-testid={`edit-${key}`} value={editForm[key]}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    className="w-full bg-background border border-border px-3 py-2 text-sm rounded-lg outline-none focus:border-accent" />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1">{t("oc.issue")}</label>
                <textarea data-testid="edit-issue_description" value={editForm.issue_description} rows={3}
                  onChange={(e) => setEditForm({ ...editForm, issue_description: e.target.value })}
                  className="w-full bg-background border border-border px-3 py-2 text-sm rounded-lg outline-none focus:border-accent" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button data-testid="confirm-edit" onClick={saveEdit}
                className="flex-1 bg-primary text-primary-foreground font-head font-semibold text-sm uppercase tracking-wider py-2.5 rounded-lg hover:bg-blue-600 transition-colors">
                {t("common.save")}
              </button>
              <button onClick={() => setShowEdit(false)}
                className="px-6 border border-border text-muted-foreground hover:text-primary-foreground hover:bg-muted transition-colors rounded-lg">
                {t("common.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MediaThumb({ m, onDelete }) {
  const url = fileUrl(m.storage_path);
  return (
    <div className="relative group aspect-square border border-border overflow-hidden bg-background hover:border-accent transition-colors">
      <a href={url} target="_blank" rel="noreferrer" data-testid={`media-${m.id}`} className="block w-full h-full">
        {m.is_video ? (
          <video src={url} className="w-full h-full object-cover" />
        ) : (
          <img src={url} alt={m.original_filename} className="w-full h-full object-cover" />
        )}
      </a>
      {/* زر الحذف يظهر في الزاوية */}
      {onDelete && (
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-1 right-1 p-1.5 bg-red-950/80 hover:bg-red-700 text-red-300 hover:text-white rounded shadow transition-colors z-10"
          title="Bild löschen"
        >
          <Trash size={14} weight="bold" />
        </button>
      )}
    </div>
  );
}