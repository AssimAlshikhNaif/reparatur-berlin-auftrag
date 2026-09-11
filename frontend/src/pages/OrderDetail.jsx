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
import PatternLock, { PatternDisplay } from "@/components/PatternLock";import { STATUS_LABELS, COST_STATUS_LABELS, COST_STATUS_STYLES, PICKUP_WAIVER, TECH_STATUS_FLOW } from "@/lib/constants";
import { berlinDateTime } from "@/lib/datetime";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import {
  ArrowLeft, Printer, CheckCircle, XCircle, Wrench, Package,
  UploadSimple, ShieldCheck, DeviceMobile, User, ClockCounterClockwise, Camera,
  Receipt, Trash, Plus, VideoCamera, ListChecks, ShoppingCart,
  Warning, Signature, ArrowsClockwise, ChatCircleDots, ClipboardText, Barcode, ShieldWarning, SpinnerGap, PencilSimple,
} from "@phosphor-icons/react";

const LOCK_LABELS = { none: "Keine Sperre", pattern: "Muster", pin: "PIN", password: "Passwort" }; // eslint-disable-line no-unused-vars

const BILLING_MODE_LABELS = {
  OPEN: "DIAGNOSE + REPARATUR",
  PAID: "NUR REPARATUR (DIAGNOSE ERLASSEN)",
  NA: "NUR DIAGNOSE",
};

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
  const isTech = user?.role === "techniker";
  const [newNoteContent, setNewNoteContent] = useState('');
  const [loadingNote, setLoadingNote] = useState(false);
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
  const [costForm, setCostForm] = useState({ diagnosis_fee: "", labor_cost: "", parts_cost: "", anzahlung: "", diagnosis_payment_status: "OPEN", is_diagnosis_paid_at_intake: false });
  useEffect(() => {
    if (order) {
      setCostForm({
        diagnosis_fee: order.cost?.diagnosis_fee ?? "",
        labor_cost: order.cost?.labor_cost ?? "",
        parts_cost: order.cost?.parts_cost ?? "",
        anzahlung: order.cost?.anzahlung ?? "",
        diagnosis_payment_status: order.diagnosis_payment_status || "OPEN",
        is_diagnosis_paid_at_intake: !!order.is_diagnosis_paid_at_intake
      });
    }
  }, [order]);

  const [comms, setComms] = useState([]);
  const [audit, setAudit] = useState([]);
  // حالة التبويب النشط ونظام المشتريات
  const [activeTab, setActiveTab] = useState("details"); // "details" | "purchases"
  const [purchasesCount, setPurchasesCount] = useState(0);
  const [imeiInput, setImeiInput] = useState("");
  const [savingSig, setSavingSig] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showExternalProcurement, setShowExternalProcurement] = useState(false);

  const canManageRef = user.role === "admin" || user.role === "mitarbeiter" || user.role === "techniker";
  const isAdmin = user.role === "admin";
  const isMitarbeiter = user.role === "mitarbeiter" || user.role === "techniker";

  const deleteOrder = async () => {
    try {
      setDeleting(true);
      const response = await api.delete(`/orders/${id}`);
      if (response.status === 200 || response.status === 204) {
        toast.success("Auftrag erfolgreich gelöscht");
        navigate("/auftraege");
      } else {
        toast.error("Fehler beim Löschen des Auftrags");
        setDeleting(false);
        setShowDelete(false);
      }
    } catch (error) {
      console.error("Error deleting order:", error);
      toast.error("Ein Fehler ist aufgetreten");
      setDeleting(false);
      setShowDelete(false);
    }
  };

  const load = useCallback(async () => {
    const { data } = await api.get(`/orders/${id}`);
    setOrder(data);
    setCostForm({
      diagnosis_fee: data.cost?.diagnosis_fee ?? 0,
      labor_cost: data.cost?.labor_cost ?? 0,
      parts_cost: data.cost?.parts_cost ?? 0,
      anzahlung: data.cost?.anzahlung ?? 0,
      diagnosis_payment_status: data.diagnosis_payment_status || "OPEN",
      is_diagnosis_paid_at_intake: !!data.is_diagnosis_paid_at_intake,
    });
  }, [id]);

  const loadPurchasesCount = useCallback(() => {
    api.get(`/purchases/order/${id}`).then((r) => setPurchasesCount(r.data.length)).catch(() => { });
  }, [id]);

  const loadComms = useCallback(() => {
    if (!canManageRef) return;
    api.get(`/orders/${id}/communications`).then((r) => setComms(r.data)).catch(() => { });
    api.get(`/orders/${id}/audit`).then((r) => setAudit(r.data)).catch(() => { });
  }, [id, canManageRef]);

  const setStatus = async (status) => {
    try {
      await api.patch(`/orders/${id}/status`, { status });
      toast.success(t("toast.statusUpdated"));
      load();
    } catch (e) {
      toast.error(e.response?.data?.detail || t("toast.updateError"));
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    try {
      setLoadingNote(true);
      const response = await api.post(`/orders/${id}/notes`, {
        content: newNoteContent,
        is_internal: true
      });
      setOrder(prevOrder => ({
        ...prevOrder,
        notes: [...(prevOrder.notes || []), response.data.note]
      }));
      setNewNoteContent('');
    } catch (error) {
      console.error('Error adding note:', error);
      alert('Fehler beim Speichern der Notiz');
    } finally {
      setLoadingNote(false);
    }
  };

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
  const currentBranch = branches.find((b) => String(b._id) === String(order.branch_id) || String(b.id) === String(order.branch_id)); // eslint-disable-line no-unused-vars

  const act = async (fn, msg) => {
    try { await fn(); toast.success(msg); await load(); loadComms(); }
    catch (e) { toast.error(e.response?.data?.detail || t("toast.error")); }
  };

  const assign = (techId) => act(() => api.post(`/orders/${id}/assign`, { techniker_id: techId }), t("toast.techAssigned"));
  const accept = () => {
    act(() => api.patch(`/orders/${id}/status`, { status: "AKZEPTIERT" }), t("toast.orderAccepted"));
  };
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
      assigned_techniker_id: order.assigned_techniker_id || "",
    });
    setShowEdit(true);
  };

  const saveEdit = () => {
    const cleanedPayload = {};
    Object.keys(editForm).forEach((key) => {
      const val = editForm[key];
      cleanedPayload[key] = val === "" ? null : val;
    });
    act(() => api.patch(`/orders/${id}`, cleanedPayload), t("detail.orderUpdated"))
      .then(() => {
        setShowEdit(false);
        load();
      });
  };

const saveCosts = () => act(() => api.patch(`/orders/${id}/costs`, {
      diagnosis_fee: parseFloat(costForm.diagnosis_fee) || 0,
      labor_cost: parseFloat(costForm.labor_cost) || 0,
      parts_cost: parseFloat(costForm.parts_cost) || 0,
      anzahlung: parseFloat(costForm.anzahlung) || 0,
      diagnosis_payment_status: costForm.diagnosis_payment_status || "OPEN",
      is_diagnosis_paid_at_intake: !!costForm.is_diagnosis_paid_at_intake,
      defect_description: costForm.defect_description || order.defect_description
    }), t("toast.costsSaved"));;

  const setCostStatus = (cost_status) => act(() => api.patch(`/orders/${id}/costs`, { cost_status }), t("toast.costStatusUpdated"));

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
    const mediaId = m.filename || m.file_path?.split("/").pop() || m.storage_path?.split("/").pop() || String(index);
    try {
      await api.delete(`/orders/${id}/media/${encodeURIComponent(mediaId)}`);
      toast.success(t("toast.mediaDeleted") || "Bild erfolgreich gelöscht");
      await load();
    } catch (e) {
      console.error("Delete media error:", e.response?.data || e);
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

  const canManage = user.role === "admin" || user.role === "mitarbeiter" || user.role === "techniker" || user.role === "TECHNIKER";

  // الحسابات اللحظية حسب نوع الفوترة
  const feeD = parseFloat(costForm.diagnosis_fee) || 0;
  const feeL = parseFloat(costForm.labor_cost) || 0;
  const feeP = parseFloat(costForm.parts_cost) || 0;
  
  const billingMode = canManage ? (costForm.diagnosis_payment_status || "OPEN") : (order.diagnosis_payment_status || "OPEN");

  // 1. حساب الإجمالي أولاً (liveGross) بناءً على المدخلات
  const rawGross = canManage 
  ? (billingMode === "PAID" ? feeL + feeP : billingMode === "NA" ? feeD : feeD + feeL + feeP)
  : Number(order.cost?.gross || 0);

  const liveGross = Number(rawGross.toFixed(2));

// 2. استخراج الصافي (Netto) من الإجمالي
  const liveNet = Number((liveGross / 1.19).toFixed(2));

// 3. استخراج الضريبة (MwSt 19%)
  const liveTax = Number((liveGross - liveNet).toFixed(2));
  const liveAnzahlung = canManage ? (parseFloat(costForm.anzahlung) || 0) : Number(order.cost?.anzahlung || 0);
  
  // 4. المبلغ المتبقي (تأكد من وجود هذا السطر بالظبط)
  const liveRest = Number(Math.max(0, liveGross - liveAnzahlung).toFixed(2));

  return (
    <div>
      <PageHeader
        label={branchName}
        title={order.auftragsnummer}
        rightAction={
          <button data-testid="back-button" onClick={() => navigate("/auftraege")}
            className="inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider border border-border px-3.5 py-2 hover:bg-muted/80 transition-all rounded-lg text-muted-foreground hover:text-foreground shadow-xs">
            <ArrowLeft size={14} /> {t("common.back")}
          </button>
        }
      >
        <div className="flex flex-wrap items-center gap-2 w-full">

          {/* ========================================== */}
          {/* 1. واجهة التقني (أزرار تفاعلية شاملة للحالات) */}
          {/* ========================================== */}
          {isTech && !["STORNIERT"].includes(order?.status) && (
            <>
              {order.status === "ZUGEWIESEN" && (
                <>
                  <button data-testid="accept-order" onClick={accept}
                    className="inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider bg-primary text-primary-foreground px-3.5 py-2 rounded-lg hover:bg-blue-600 transition-all shadow-xs shrink-0">
                    <CheckCircle size={14} /> Akzeptieren
                  </button>
                  <button data-testid="reject-order" onClick={() => setShowReject(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider bg-red-600 text-white px-3.5 py-2 rounded-lg hover:bg-red-500 transition-all shadow-xs shrink-0">
                    <XCircle size={14} /> Ablehnen
                  </button>
                </>
              )}
              {["ANGENOMMEN", "AKZEPTIERT", "IN_BEARBEITUNG", "WARTEN_ERSATZTEIL", "WARTEN_FREIGABE", "FERTIG", "ABGEHOLT"].includes(order.status) && (
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => setStatus("ANGENOMMEN")}
                    className={`inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider px-3.5 py-2 rounded-lg transition-all shadow-xs shrink-0 ${
                      order.status === "ANGENOMMEN"
                        ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                        : "border border-border hover:bg-muted/80 text-muted-foreground"
                    }`}>
                    Diagnose
                  </button>
                  <button onClick={() => setStatus("WARTEN_FREIGABE")}
                    className={`inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider px-3.5 py-2 rounded-lg transition-all shadow-xs shrink-0 ${
                      order.status === "WARTEN_FREIGABE"
                        ? "bg-sky-600 text-white shadow-[0_0_15px_rgba(2,132,199,0.4)]"
                        : "border border-border hover:bg-muted/80 text-muted-foreground"
                    }`}>
                    Warten Freigabe
                  </button>
                  <button onClick={() => setStatus("IN_BEARBEITUNG")}
                    className={`inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider px-3.5 py-2 rounded-lg transition-all shadow-xs shrink-0 ${
                      order.status === "IN_BEARBEITUNG"
                        ? "bg-amber-600 text-white shadow-[0_0_15px_rgba(217,119,6,0.4)]"
                        : "border border-border hover:bg-muted/80 text-muted-foreground"
                    }`}>
                    <Wrench size={14} /> In Bearbeitung
                  </button>
                  <button onClick={() => setStatus("WARTEN_ERSATZTEIL")}
                    className={`inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider px-3.5 py-2 rounded-lg transition-all shadow-xs shrink-0 ${
                      order.status === "WARTEN_ERSATZTEIL"
                        ? "bg-orange-600 text-white shadow-[0_0_15px_rgba(234,88,12,0.4)]"
                        : "border border-border hover:bg-muted/80 text-muted-foreground"
                    }`}>
                    <Package size={14} /> Warten Ersatzteil
                  </button>
                  <button onClick={() => setStatus("FERTIG")}
                    className={`inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider px-3.5 py-2 rounded-lg transition-all shadow-xs shrink-0 ${
                      order.status === "FERTIG"
                        ? "bg-emerald-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]"
                        : "border border-border hover:bg-muted/80 text-emerald-400"
                    }`}>
                    <CheckCircle size={14} /> Fertig
                  </button>
                  <button onClick={() => setStatus("ABGEHOLT")}
                    className={`inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider px-3.5 py-2 rounded-lg transition-all shadow-xs shrink-0 ${
                      order.status === "ABGEHOLT"
                        ? "bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.4)]"
                        : "border border-border hover:bg-muted/80 text-purple-400"
                    }`}>
                    <CheckCircle size={14} /> Abgeholt
                  </button>
                </div>
              )}
            </>
          )}

          {/* ========================================== */}
          {/* 2. واجهة الإدارة والموظفين (تتضمن القوائم والطباعة) */}
          {/* ========================================== */}
          {canManage && !isTech && (
            <>
              <select
                key={order?.status || "default"}
                data-testid="manual-status-select"
                value={order?.status === "ANGENOMMEN" ? "DIAGNOSE" : (order?.status || "DIAGNOSE")}
                onChange={(e) => {
                  let newStatus = e.target.value;
                  if (newStatus === "DIAGNOSE") newStatus = "ANGENOMMEN";
                  if (!newStatus) return;
                  if (newStatus === "ABGEHOLT" && !order?.pickup_signature && !order?.signature) {
                    toast.error("Kundenunterschrift bei Abholung ist obligatorisch!");
                    return;
                  }
                  setStatus(newStatus);
                }}
                className={`border px-3.5 py-2 text-xs font-mono uppercase tracking-wider rounded-lg outline-none transition-all shadow-xs shrink-0 font-semibold ${
                  order?.status === "ANGENOMMEN"
                    ? "bg-blue-600/90 text-white border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)]" :
                  order?.status === "WARTEN_FREIGABE"
                    ? "bg-sky-600/90 text-white border-sky-500 shadow-[0_0_15px_rgba(2,132,199,0.4)]" :
                  order?.status === "IN_BEARBEITUNG"
                    ? "bg-amber-600/90 text-white border-amber-500 shadow-[0_0_15px_rgba(217,119,6,0.4)]" :
                  order?.status === "WARTEN_ERSATZTEIL"
                    ? "bg-orange-600/90 text-white border-orange-500 shadow-[0_0_15px_rgba(234,88,12,0.4)]" :
                  order?.status === "FERTIG"
                    ? "bg-emerald-600/90 text-white border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]" :
                  order?.status === "ABGEHOLT"
                    ? "bg-purple-600/90 text-white border-purple-500 shadow-[0_0_15px_rgba(147,51,234,0.4)]" :
                    "bg-background text-foreground border-border"
                }`}
              >
                <option value="DIAGNOSE" className="bg-background text-foreground">Diagnose</option>
                <option value="WARTEN_FREIGABE" className="bg-background text-foreground">Warten Freigabe</option>
                <option value="IN_BEARBEITUNG" className="bg-background text-foreground">In Bearbeitung</option>
                <option value="WARTEN_ERSATZTEIL" className="bg-background text-foreground">Warten Ersatzteil</option>
                <option value="FERTIG" className="bg-background text-foreground">Fertig</option>
                <option value="ABGEHOLT" className="bg-background text-foreground">Abgeholt</option>
              </select>

              {order.status !== "STORNIERT" && (
                <>
                  <button data-testid="open-edit" onClick={openEdit}
                    className="inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider border border-border px-3 py-2 hover:bg-muted/80 transition-all rounded-lg shadow-xs shrink-0">
                    <PencilSimple size={14} className="text-muted-foreground" /> {t("detail.editOrder")}
                  </button>
                  <button data-testid="open-cancel" onClick={() => setShowCancel(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider border border-red-800/60 text-red-400 px-3 py-2 hover:bg-red-950/50 transition-all rounded-lg shadow-xs shrink-0">
                    <XCircle size={14} /> {t("detail.cancelOrder")}
                  </button>
                </>
              )}
              <button data-testid="open-label" onClick={() => setShowLabel(true)}
                className="inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider border border-border px-3 py-2 hover:bg-muted/80 transition-all rounded-lg shadow-xs shrink-0">
                <Barcode size={14} className="text-muted-foreground" /> {t("label.button")}
              </button>
              <button data-testid="open-receipt" onClick={() => setShowReceipt(true)}
                className="inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider border border-border px-3 py-2 hover:bg-muted/80 transition-all rounded-lg shadow-xs shrink-0">
                <Printer size={14} className="text-muted-foreground" /> {t("actions.receipt")}
              </button>

              <button data-testid="open-contract" onClick={() => setShowContract(true)}
                className="inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider border border-border px-3 py-2 hover:bg-muted/80 transition-all rounded-lg shadow-xs shrink-0">
                <ClipboardText size={14} className="text-muted-foreground" /> {t("actions.fullPrint")}
              </button>

{/* زر Beschaffung & Einkauf المرتبط بقاعدة البيانات والتبويب */}
<button 
  data-testid="open-external-procurement" 
  onClick={() => setActiveTab("purchases")}
  className="inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider border border-amber-600/60 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 transition-all rounded-lg shadow-xs shrink-0"
>
  🛒 Beschaffung & Einkauf
</button>
              
              {order.status === "ABGEHOLT" && (
                <>
                  <button data-testid="open-invoice" onClick={() => {
                    if (!order?.pickup_signature && !order?.signature) {
                      toast.error("Kundenunterschrift ist erforderlich, bevor die Rechnung gedruckt werden kann!");
                      return;
                    }
                    setShowInvoice(true);
                  }}
                    className={`inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider px-3.5 py-2 rounded-lg transition-all shadow-xs shrink-0 ${
                      !order?.pickup_signature && !order?.signature
                        ? "bg-muted text-muted-foreground opacity-60 cursor-not-allowed"
                        : "bg-primary text-primary-foreground hover:bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                    }`}>
                    <Printer size={14} /> {t("actions.printInvoice")}
                  </button>

                  <button 
                    data-testid="open-reklamation" 
                    onClick={async () => {
                      try {
                        const res = await api.post(`/orders/${order.id}/create-reclamation`);
                        if (res.data && res.data.id) {
                          // الانتقال مباشرة لصفحة الطلب الخاص بالريكلاماتيون الذي تم إنشاؤه وربطه بالباك إند
                          navigate(`/auftrag/${res.data.id}`);
                        } else {
                          window.location.reload();
                        }
                      } catch (err) {
                        console.error(err);
                        toast.error("Fehler beim Erstellen der Reklamation");
                      }
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider border border-amber-600/60 text-amber-300 px-3 py-2 rounded-lg hover:bg-amber-950/50 transition-all shadow-xs shrink-0"
                  >
                    <ArrowsClockwise size={14} /> {t("actions.reklamation")}
                  </button>
                </>
              )}
              
              {order.status === "FERTIG" && (
                <button data-testid="mark-delivered" onClick={() => {
                  if (!order?.pickup_signature && !order?.signature) {
                    toast.error("Kundenunterschrift bei Abholung ist obligatorisch!");
                    return;
                  }
                  setStatus("ABGEHOLT");
                }}
                  className="inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider bg-emerald-600 text-white px-3.5 py-2 rounded-lg hover:bg-emerald-500 transition-all shadow-xs shrink-0">
                  <CheckCircle size={14} /> {t("actions.collected")}
                </button>
              )}
              {isAdmin && (
                <button data-testid="delete-order-button" onClick={() => setShowDelete(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-head font-semibold uppercase tracking-wider border border-red-700/60 bg-red-950/30 text-red-300 px-3 py-2 rounded-lg hover:bg-red-700 hover:text-white transition-all shadow-xs shrink-0">
                  <Trash size={14} weight="bold" /> {t("detail.deleteOrder")}
                </button>
              )}
            </>
          )}
        </div>
      </PageHeader>

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
                <span data-testid="cost-status-badge" className={`inline-flex items-center px-2.5 py-1 text-xs font-mono uppercase tracking-wider border rounded-lg ${COST_STATUS_STYLES[order.cost?.status] || "bg-muted text-foreground/80 border-border"}`}>
                  {order.cost?.status ? t("costs." + ({WARTET:"waiting",BESTAETIGT:"confirmed",ABGELEHNT:"rejected"}[order.cost.status] || "waiting")) : "—"}
                </span>
              </div>
              <div className="p-4 space-y-4">
                
                {/* حقل وصف العطل أو الإصلاح للفاتورة */}
                {canManage && (
                  <div className="space-y-1.5 pb-3 border-b border-border">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Reparaturbeschreibung / Fehler (für die Rechnung)
                    </label>
                    <textarea
  data-testid="cost-defect-description-input"
  value={costForm.defect_description !== undefined ? costForm.defect_description : (order.defect_description || "")}
  onChange={(e) => {
    setCostForm({ ...costForm, defect_description: e.target.value });
  }}
  placeholder="z.B. Displaytausch & Ladebuchse gereinigt..."
  className="w-full bg-background border border-border px-3 py-2 text-xs rounded-lg outline-none focus:border-accent font-mono"
  rows={2}
/>
                  </div>
                )}

                {canManage ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  <div className="font-mono text-sm space-y-1">
                    <div className="flex justify-between text-muted-foreground"><span>{t("costs.diagnosisFee")}</span><span>{Number(order.cost?.diagnosis_diagnosis_fee || 0).toFixed(2)} €</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>{t("costs.labor")}</span><span>{Number(order.cost?.labor_cost || 0).toFixed(2)} €</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>{t("costs.attempt")}</span><span>{Number(order.cost?.parts_cost || 0).toFixed(2)} €</span></div>
                  </div>
                )}

                {/* Abrechnungsart */}
<div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{t("costs.paymentLabel")}</span>
  {canManage ? (
    <select 
      data-testid="diagnosis-payment-select" 
      value={costForm.diagnosis_payment_status || "OPEN"}
      onChange={(e) => setCostForm((prev) => ({ ...prev, diagnosis_payment_status: e.target.value }))}
      className="bg-background border border-border px-2 py-1 text-xs font-mono uppercase tracking-widest rounded-lg outline-none focus:border-accent cursor-pointer">
      <option value="OPEN">DIAGNOSE + REPARATUR (BEIDES)</option>
      <option value="PAID">NUR REPARATUR (DIAGNOSE ERLASSEN)</option>
      <option value="NA">NUR DIAGNOSE (KEINE REPARATUR)</option>
    </select>
  ) : (
    <span data-testid="diagnosis-payment-badge" className="inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded-lg bg-muted border-border">
      {BILLING_MODE_LABELS[order.diagnosis_payment_status] || BILLING_MODE_LABELS.OPEN}
    </span>
  )}
</div>

                {/* Diagnosegebühr bei Annahme bezahlt */}
                {canManage && (
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="diagnosis_paid_intake" data-testid="diagnosis-paid-intake-checkbox"
                      checked={!!costForm.is_diagnosis_paid_at_intake}
                      onChange={(e) => setCostForm((prev) => ({ ...prev, is_diagnosis_paid_at_intake: e.target.checked }))}
                      className="w-4 h-4 accent-accent cursor-pointer" />
                    <label htmlFor="diagnosis_paid_intake" className="text-xs font-mono cursor-pointer">
                      Diagnosegebühr bei Annahme bereits bezahlt
                    </label>
                  </div>
                )}

                {/* Summen, Anzahlung, Restbetrag, Zahlungsstatus */}
                <div className="border border-border bg-card/40 rounded-lg p-4 font-mono text-sm space-y-2">
                  <div className="flex justify-between text-muted-foreground"><span>{t("costs.net")}</span><span data-testid="detail-cost-net">{liveNet.toFixed(2)} €</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>{t("costs.tax")}</span><span data-testid="detail-cost-tax">{liveTax.toFixed(2)} €</span></div>
                  <div className="flex justify-between text-foreground font-semibold text-base border-t border-border pt-2 mt-2"><span>{t("costs.gross")}</span><span data-testid="detail-cost-gross">{liveGross.toFixed(2)} €</span></div>
                  <div className="border-t border-border pt-2 flex items-center justify-between">
                    <span className="text-xs uppercase text-muted-foreground">Anzahlung:</span>
                    {canManage ? (
                      <input data-testid="anzahlung-input" type="number" step="0.01" min="0" value={costForm.anzahlung}
                        onChange={(e) => setCostForm({ ...costForm, anzahlung: e.target.value })}
                        placeholder="0.00"
                        className="w-32 bg-background border border-border px-2 py-1 text-sm rounded-lg outline-none focus:border-accent text-right font-mono" />
                    ) : (
                      <span className="text-foreground">{liveAnzahlung.toFixed(2)} €</span>
                    )}
                  </div>
                  <div className="flex justify-between text-foreground font-semibold pt-1 border-t border-dashed border-border">
                    <span>Restbetrag:</span>
                    <span data-testid="detail-cost-rest" className={liveRest > 0 ? "text-amber-500 font-semibold" : "text-emerald-500 font-semibold"}>
                      {liveRest.toFixed(2)} €
                    </span>
                  </div>
                  <div className="pt-2 flex items-center justify-between border-t border-border">
                    <span className="text-[10px] uppercase text-muted-foreground">Zahlungsstatus:</span>
                    {liveAnzahlung <= 0 ? (
                      <div data-testid="payment-status-badge" className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium bg-red-500/10 text-red-400 rounded border border-red-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                        Offen (Nicht bezahlt)
                      </div>
                    ) : liveAnzahlung < liveGross ? (
                      <div data-testid="payment-status-badge" className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium bg-amber-500/10 text-amber-400 rounded border border-amber-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Teilweise
                      </div>
                    ) : (
                      <div data-testid="payment-status-badge" className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 rounded border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Bezahlt
                      </div>
                    )}
                  </div>
                </div>

                {canManage && (
                  <div className="pt-2 border-t border-border flex flex-wrap items-center gap-2">
                    <button data-testid="save-costs" onClick={saveCosts}
                      className="text-xs font-head font-semibold uppercase tracking-wider bg-primary text-primary-foreground px-5 py-2.5 hover:bg-blue-600 transition-colors rounded-lg shadow-sm">
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

            {/* قسم الملاحظات الداخلية للموظفين */}
            {!isTech && (
              <div className="border border-border mt-4">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60">
                  <div className="flex items-center gap-2">
                    <ChatCircleDots size={16} className="text-accent" />
                    <h2 className="font-head font-semibold text-sm tracking-tight">Interne Notizen</h2>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {order?.notes && order.notes.length > 0 ? (
                      order.notes.map((note) => (
                        <div key={note.id} className="relative bg-background border border-border p-3 rounded-lg text-sm group pr-8">
                          <p className="text-foreground whitespace-pre-wrap">{note.content}</p>
                          <div className="flex justify-between items-center mt-2 text-[11px] font-mono text-muted-foreground">
                            <span>Von: <strong className="text-foreground">{note.author_name}</strong></span>
                            <span>{new Date(note.created_at).toLocaleString()}</span>
                          </div>
                          {(isAdmin || note.author_id === user?.id || note.user_id === user?.id) && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await api.delete(`/orders/${order.id}/notes/${note.id}`);
                                  toast.success("Notiz gelöscht");
                                  load();
                                } catch (err) {
                                  toast.error("Fehler beim Löschen");
                                }
                              }}
                              className="absolute top-2 right-2 text-red-500 hover:text-red-700 opacity-60 hover:opacity-100 transition-opacity p-1 text-xs"
                              title="Notiz löschen"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm font-mono">Keine Notizen vorhanden.</p>
                    )}
                  </div>
                  <form onSubmit={handleAddNote} className="flex gap-2 pt-2 border-t border-border">
                    <input
                      type="text"
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      placeholder="Interne Notiz hinzufügen..."
                      className="flex-1 bg-background border border-border px-3 py-1.5 text-sm rounded-lg outline-none focus:border-accent"
                    />
                    <button
                      type="submit"
                      disabled={loadingNote}
                      className="bg-accent text-accent-foreground px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50"
                    >
                      {loadingNote ? '...' : 'Hinzufügen'}
                    </button>
                  </form>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
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
                <div className=" sm:grid-cols-4 gap-2 mb-3">
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
              <Section title="Eingangsprüfung (Mitarbeiter)" icon={ClipboardText}>
                {(() => {
                  const hasIntake = Boolean(order.intake_inspection?.checklist && Object.keys(order.intake_inspection.checklist).length > 0);
                  const isReadOnly = !canManage && !isMitarbeiter;
                  return (
                    <div className="space-y-3">
                      {hasIntake && (
                        <p className="text-[11px] font-mono text-emerald-400">
                          ✓ Eingangsprüfung durchgeführt von {order.intake_inspection.by || "Mitarbeiter"}
                        </p>
                      )}
                      <InspectionForm
                        key={`intake-${order._id || order.id}`}
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
                          key={`end-${order._id || order.id}`}
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

{/* 1. الشات الداخلي - يظهر للجميع (تقني + موظف + أدمن) */}
<OrderChat orderId={order.id} />

{/* 2. قسم الاتصالات والمراسلات - يخفى عن التقني تماماً */}
{user?.role !== 'Techniker' && (
  <Section title={t("detail.commTitle")} icon={ChatCircleDots}>
    <CommunicationPanel order={order} onSent={loadComms} />
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
              {/* اسم الموظف المسؤول مرتب تحت الـ Verlauf مباشرة داخل نفس الصندوق */}
  <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
    <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Erstellt von:</span>
    <span className="text-xs font-mono font-semibold text-foreground">{order.created_by || "—"}</span>
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
      {!isTech && canManage && order.customer_phone && (
        <WhatsAppFab order={order} onLogged={loadComms} />
      )}

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
  <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
    <div className="bg-card border border-border/80 max-w-xl w-full p-6 sm:p-8 rounded-2xl shadow-2xl my-8 relative">

            <div>
              {/* قسم بيانات العميل */}
  <div className="mb-6">
    <div className="text-[11px] font-mono uppercase tracking-wider text-accent mb-3 font-semibold">Kundendaten</div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      
      <div className="space-y-1">
        <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{t("oc.name") || "Name"}</label>
        <input
          data-testid="edit-customer_name"
          value={editForm.customer_name || ""}
          onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
          className="w-full bg-background/50 border border-border/80 px-3.5 py-2.5 text-sm rounded-xl outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{t("oc.phone") || "Telefon"}</label>
        <input
          data-testid="edit-customer_phone"
          value={editForm.customer_phone || ""}
          onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })}
          className="w-full bg-background/50 border border-border/80 px-3.5 py-2.5 text-sm rounded-xl outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{t("oc.email") || "E-Mail"}</label>
        <input
          data-testid="edit-customer_email"
          value={editForm.customer_email || ""}
          onChange={(e) => setEditForm({ ...editForm, customer_email: e.target.value })}
          className="w-full bg-background/50 border border-border/80 px-3.5 py-2.5 text-sm rounded-xl outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{t("oc.address") || "Adresse"}</label>
        <input
          data-testid="edit-customer_address"
          value={editForm.customer_address || ""}
          onChange={(e) => setEditForm({ ...editForm, customer_address: e.target.value })}
          className="w-full bg-background/50 border border-border/80 px-3.5 py-2.5 text-sm rounded-xl outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
        />
      </div>

    </div>
  </div>
                <div className="text-[11px] font-mono uppercase tracking-wider text-accent mb-3 font-semibold">Gerätedetails & Reparatur</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  
                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{t("oc.brand") || "Marke"}</label>
                    <input
                      data-testid="edit-device_brand"
                      value={editForm.device_brand || ""}
                      onChange={(e) => setEditForm({ ...editForm, device_brand: e.target.value })}
                      className="w-full bg-background/50 border border-border/80 px-3.5 py-2.5 text-sm rounded-xl outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{t("oc.model") || "Modell"}</label>
                    <input
                      data-testid="edit-device_model"
                      value={editForm.device_model || ""}
                      onChange={(e) => setEditForm({ ...editForm, device_model: e.target.value })}
                      className="w-full bg-background/50 border border-border/80 px-3.5 py-2.5 text-sm rounded-xl outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{t("oc.imei") || "IMEI / Seriennr."}</label>
                    <input
                      data-testid="edit-imei"
                      value={editForm.imei || ""}
                      onChange={(e) => setEditForm({ ...editForm, imei: e.target.value })}
                      className="w-full bg-background/50 border border-border/80 px-3.5 py-2.5 text-sm rounded-xl outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                    />
                  </div>

                  {/* اختيار نوع القفل ولوحة الرسم */}
                  <div className="sm:col-span-2 space-y-2">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                      {t("oc.lock") || "Geräte-Sperre"}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <select 
                        data-testid="edit-order-lock-type" 
                        value={editForm.device_lock_type || "none"}
                        onChange={(e) => setEditForm({ ...editForm, device_lock_type: e.target.value, device_passcode: "" })}
                        className="bg-background/50 border border-border/80 px-3.5 py-2.5 text-xs rounded-xl outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer h-11"
                      >
                        <option value="none">{t("oc.lockNone") || "Keine Sperre"}</option>
                        <option value="pattern">{t("oc.lockPattern") || "Muster (zeichnen)"}</option>
                        <option value="pin">{t("oc.lockPin") || "PIN (numerisch)"}</option>
                        <option value="password">{t("oc.lockPassword") || "Passwort (alphanumerisch)"}</option>
                      </select>

                      <div className="sm:col-span-2">
                        {editForm.device_lock_type === "none" ? (
                          <div className="bg-muted/30 border border-border/50 px-4 py-2.5 text-xs text-muted-foreground rounded-xl flex items-center h-11">
                            Kein Sperrcode erforderlich
                          </div>
                        ) : editForm.device_lock_type === "pattern" ? (
                          <div className="bg-background/50 border border-border/80 p-4 rounded-xl flex flex-col items-center justify-center space-y-3">
                            <div className="w-48 h-48 flex items-center justify-center bg-card/40 rounded-lg border border-border/40 p-2">
                              <div className="scale-90 transform origin-center">
                                <PatternLock 
                                  value={editForm.device_passcode || ""} 
                                  onChange={(seq) => setEditForm((f) => ({ ...f, device_passcode: seq }))} 
                                />
                              </div>
                            </div>
                            
                          </div>
                        ) : (
                          <input 
                            data-testid="edit-order-lock-input"
                            inputMode={editForm.device_lock_type === "pin" ? "numeric" : "text"}
                            placeholder={editForm.device_lock_type === "pin" ? "PIN eingeben (z.B. 1234)..." : "Passwort eingeben..."}
                            value={editForm.device_passcode || ""}
                            onChange={(e) => setEditForm({ ...editForm, device_passcode: e.target.value })}
                            className="w-full bg-background/50 border border-border/80 px-3.5 py-2.5 text-sm rounded-xl outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all font-mono h-11"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                      {t("oc.technician") || "Techniker zuweisen"}
                    </label>
                    <select
                      data-testid="edit-assigned_techniker_id"
                      value={editForm.assigned_techniker_id || ""}
                      onChange={(e) => setEditForm({ ...editForm, assigned_techniker_id: e.target.value })}
                      className="w-full bg-background/50 border border-border/80 px-3.5 py-2.5 text-sm rounded-xl outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all cursor-pointer"
                    >
                      <option value="">{t("Kein Techniker") || "— Kein Techniker —"}</option>
                      {technicians && technicians.map((tech) => (
                        <option key={tech._id || tech.id} value={tech._id || tech.id}>
                          {tech.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2 space-y-1">
                    <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{t("oc.issue")}</label>
                    <textarea
                      data-testid="edit-issue_description"
                      value={editForm.issue_description || ""}
                      rows={3}
                      onChange={(e) => setEditForm({ ...editForm, issue_description: e.target.value })}
                      className="w-full bg-background/50 border border-border/80 px-3.5 py-2.5 text-sm rounded-xl outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all resize-none"
                    />
                  </div>

                </div>
              </div>
            

            <div className="flex items-center gap-3 mt-8 pt-4 border-t border-border/60">
              <button
                onClick={() => setShowEdit(false)}
                className="px-5 py-2.5 border border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all rounded-xl text-sm font-medium"
              >
                {t("common.cancel")}
              </button>
              <button
                data-testid="confirm-edit"
                onClick={saveEdit}
                className="flex-1 bg-primary text-primary-foreground font-head font-semibold text-sm uppercase tracking-wider py-2.5 px-4 rounded-xl hover:opacity-90 active:scale-[0.99] transition-all shadow-lg shadow-primary/20"
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MediaThumb({ m, onDelete }) {
  const token = localStorage.getItem("token") || "";
const rawUrl = m.storage_path ? (m.storage_path.startsWith('/uploads/') ? fileUrl(m.storage_path) : fileUrl(`/uploads/${m.storage_path}`)) : '';  const url = rawUrl.includes("?") ? `${rawUrl}&auth=${token}` : `${rawUrl}?auth=${token}`;
  return (
    <div className="relative group aspect-square border border-border overflow-hidden bg-background hover:border-accent transition-colors">
      <a href={url} target="_blank" rel="noreferrer" data-testid={`media-${m.id}`} className="block w-full h-full">
        {m.is_video ? (
          <video src={url} className="w-full h-full object-cover" />
        ) : (
          <img src={url} alt={m.original_filename} className="w-full h-full object-cover" />
        )}
      </a>
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
