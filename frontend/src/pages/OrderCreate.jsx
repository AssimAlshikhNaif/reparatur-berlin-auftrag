import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { DEVICE_BRANDS, LIABILITY_WAIVER } from "@/lib/constants";
import CameraCapture from "@/components/CameraCapture";
import SignaturePad from "@/components/SignaturePad";
import PatternLock from "@/components/PatternLock";
import { toast } from "sonner";
import { Camera, X, SpinnerGap, FloppyDisk, VideoCamera, Receipt, Warning, ShieldCheck, Signature, CheckCircle, LockKey } from "@phosphor-icons/react";

const inputCls = "w-full bg-background border border-border px-3 py-2.5 text-sm rounded-lg outline-none focus:border-accent transition-colors";
const labelCls = "block text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2";

export default function OrderCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const reclamationSource = location.state?.reclamationOf || null;
  const { user } = useAuth();
  const isMitarbeiter = user.role === "mitarbeiter";
  const [branches, setBranches] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  // Synchroner Schutz vor Doppel-Absendung: React-State ("busy") aktualisiert sich
  // erst beim nächsten Render, daher kann ein sehr schneller Doppelklick den
  // Handler zweimal auslösen, bevor der Button visuell deaktiviert ist.
  const submittingRef = useRef(false);
  const [showCamera, setShowCamera] = useState(false);
  const [intakeSignature, setIntakeSignature] = useState(null);
  const [signerName, setSignerName] = useState("");
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    branch_id: reclamationSource?.branch_id || "", device_brand: reclamationSource?.device_brand || "Apple",
    device_model: reclamationSource?.device_model || "", imei: reclamationSource?.imei || "",
    imei_unreadable: false,
    device_passcode: "",
    device_lock_type: "none",
    issue_description: reclamationSource ? t("oc.reclamationPrefix", { nr: reclamationSource.auftragsnummer }) : "",
    customer_name: reclamationSource?.customer_name || "", customer_phone: reclamationSource?.customer_phone || "",
    customer_email: reclamationSource?.customer_email || "", customer_address: reclamationSource?.customer_address || "",
    estimated_price: "",
    diagnosis_fee: reclamationSource ? "0" : "", labor_cost: reclamationSource ? "0" : "", parts_cost: reclamationSource ? "0" : "",
    diagnosis_payment_status: "OPEN",
    warranty_months: 6,
    assigned_techniker_id: "",
  });

  // Eingaben sind Bruttopreise (inkl. MwSt.) — Endbetrag = Summe der Eingaben.
  const grossTotal = (parseFloat(form.diagnosis_fee) || 0) + (parseFloat(form.labor_cost) || 0) + (parseFloat(form.parts_cost) || 0);
  const netTotal = grossTotal / 1.19;
  const taxTotal = grossTotal - netTotal;

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const results = await Promise.allSettled([
          api.get("/branches"),
          api.get("/technicians"),
        ]);

        if (!isMounted) return;

        const branchesResult = results[0];
        const techsResult = results[1];

        const branchesData = branchesResult.status === "fulfilled" ? (branchesResult.value.data || []) : [];
        const techData = techsResult.status === "fulfilled" ? (techsResult.value.data || []) : [];

        setBranches(branchesData);
        setTechnicians(techData);

        if (isMitarbeiter && user?.branch_id) {
          setForm((f) => ({ ...f, branch_id: user.branch_id }));
        } else if (branchesData.length) {
          setForm((f) => ({ ...f, branch_id: f.branch_id || branchesData[0].id }));
        }
      } catch (err) {
        console.error("Error loading form dependencies:", err);
      }
    })();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

const validate = () => {
    const e = {};
    if (!form.branch_id) e.branch_id = t("oc.errBranch");
    if (!form.device_brand || !form.device_brand.trim()) e.device_brand = t("oc.errBrand");
    if (!form.device_model || !form.device_model.trim()) e.device_model = t("oc.errModel");
    
    const reclamationPrefix = reclamationSource
      ? t("oc.reclamationPrefix", { nr: reclamationSource.auftragsnummer }).trim()
      : "";
    const issue = form.issue_description ? form.issue_description.trim() : "";
    if (!issue || (reclamationSource && issue === reclamationPrefix)) e.issue_description = t("oc.errIssue");
    
    if ((!form.imei || !form.imei.trim()) && !form.imei_unreadable) e.imei = t("oc.errImei");
    if (!form.customer_name || !form.customer_name.trim()) e.customer_name = t("oc.errName");
    
    // التعديل هنا: استبدال فحص الهاتف الإجباري بفحص (الهاتف أو الإيميل معاً)
    const phone = (form.customer_phone || "").trim();
    const email = (form.customer_email || "").trim();
    if (!phone && !email) {
      e.customer_phone = t("oc.errPhone") || "Telefon oder E-Mail erforderlich";
    }
    
    if (form.device_lock_type !== "none" && (!form.device_passcode || !form.device_passcode.trim())) {
      e.device_passcode = t("oc.errPasscode");
    }

    if (!files || files.length === 0) {
      toast.error(t("oc.errMediaRequired") || "Mindestens ein Foto ist erforderlich.");
      e.media = "required";
    }

    setErrors(e);
    const firstKey = Object.keys(e)[0];
    if (firstKey && firstKey !== "media") {
      const testidMap = {
        branch_id: "order-branch",
        device_brand: "order-brand",
        device_model: "order-model",
        issue_description: "order-issue",
        imei: "order-imei",
        customer_name: "order-customer-name",
        customer_phone: "order-customer-phone",
        device_passcode: form.device_lock_type === "pin" ? "order-lock-pin"
          : form.device_lock_type === "password" ? "order-lock-password" : "order-lock-type",
      };
      const el = document.querySelector(`[data-testid="${testidMap[firstKey]}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => { try { el.focus(); } catch (_) { /* noop */ } }, 300);
      }
    }
    return Object.keys(e).length === 0;
  };

  const addFiles = (e) => {
    const chosen = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...chosen.map((f) => ({ file: f, url: URL.createObjectURL(f) }))]);
  };
  const removeFile = (i) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const addCapturedFile = (file) => {
    setFiles((prev) => [...prev, { file, url: URL.createObjectURL(file) }]);
  };

const submit = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    if (!validate()) {
      toast.error(t("oc.validateFail"));
      return;
    }
    submittingRef.current = true;
    setBusy(true);
    try {
      const payload = {
        branch_id: form.branch_id,
        device_brand: form.device_brand || "",
        device_model: form.device_model,
        imei: form.imei || "",
        imei_unreadable: !!form.imei_unreadable,
        device_passcode: form.device_passcode || "",
        device_lock_type: form.device_lock_type || "none",
        issue_description: form.issue_description,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        customer_email: form.customer_email || "",
        customer_address: form.customer_address || "",
        estimated_price: form.estimated_price ? parseFloat(form.estimated_price) : null,
        diagnosis_fee: parseFloat(form.diagnosis_fee) || 0,
        labor_cost: parseFloat(form.labor_cost) || 0,
        parts_cost: parseFloat(form.parts_cost) || 0,
        warranty_months: parseInt(form.warranty_months) || 0,
        assigned_techniker_id: form.assigned_techniker_id || null,
        intake_signature: intakeSignature || null,
        intake_signed_name: signerName || form.customer_name,
        is_reclamation: !!reclamationSource,
        reclamation_of: reclamationSource?.id || null,
        reclamation_of_number: reclamationSource?.auftragsnummer || null,
        media: files.map(f => f.url)
      };

      const { data } = await api.post("/orders", payload);
      
      if (files && files.length > 0) {
        for (const f of files) {
          const fd = new FormData();
          fd.append("file", f.file);
          fd.append("media_type", "intake");
          await api.post(`/orders/${data.id}/media`, fd, { headers: { "Content-Type": "multipart/form-data" } });
        }
      }

      toast.success(t("oc.created", { nr: data.auftragsnummer }));
      navigate(`/auftrag/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || t("oc.createError"));
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader label={reclamationSource ? t("oc.labelReclamation") : t("oc.labelCreate")} title={reclamationSource ? t("oc.titleReclamation") : t("oc.titleNew")} />
      <form onSubmit={submit} noValidate className="p-6 md:p-8 max-w-4xl space-y-8">
        {reclamationSource && (
          <div data-testid="reclamation-banner" className="border border-amber-700 bg-amber-950/30 rounded-lg px-4 py-3 flex items-center gap-3">
            <ShieldCheck size={20} className="text-amber-400 shrink-0" />
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-amber-300">{t("oc.labelReclamation")}</div>
              <div className="text-sm text-foreground/90">{t("oc.reclamationRef")} <span className="font-mono">{reclamationSource.auftragsnummer}</span> · {t("oc.reclamationNote")}</div>
            </div>
          </div>
        )}
        {/* Geräte + Filiale */}
        <section>
          <h2 className="font-head font-semibold text-lg tracking-tight mb-4 border-b border-border pb-2">{t("oc.secDevice")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>{t("oc.branch")}</label>
              <select data-testid="order-branch" required value={form.branch_id} onChange={set("branch_id")} disabled={isMitarbeiter}
                className={`${inputCls} ${isMitarbeiter ? "opacity-70 cursor-not-allowed" : ""}`}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {isMitarbeiter && (
                <p className="text-[10px] font-mono text-muted-foreground mt-1">{t("oc.branchReadonly")}</p>
              )}
            </div>
            <div>
              <label className={labelCls}>{t("oc.brand")}</label>
              <select data-testid="order-brand" value={form.device_brand} onChange={set("device_brand")} className={inputCls}>
                {DEVICE_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t("oc.model")}</label>
              <input data-testid="order-model" required value={form.device_model} onChange={set("device_model")} placeholder={t("oc.modelPlaceholder")} className={inputCls} />
              {errors.device_model && <p className="text-[10px] font-mono text-red-400 mt-1">{errors.device_model}</p>}
            </div>
            <div>
              <label className={labelCls}>{t("oc.imei")} <span className="text-red-400">*</span></label>
              <input data-testid="order-imei" value={form.imei} onChange={set("imei")}
                placeholder={form.imei_unreadable ? t("oc.imeiLater") : t("oc.imeiRequired")}
                disabled={form.imei_unreadable}
                className={`${inputCls} font-mono ${form.imei_unreadable ? "opacity-50" : ""}`} />
              <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                <input data-testid="order-imei-unreadable" type="checkbox" checked={form.imei_unreadable}
                  onChange={(e) => setForm({ ...form, imei_unreadable: e.target.checked, imei: e.target.checked ? "" : form.imei })}
                  className="accent-amber-500 w-4 h-4" />
                <span className="text-xs text-amber-300 flex items-center gap-1"><Warning size={13} /> {t("oc.imeiUnreadable")}</span>
              </label>
              {form.imei_unreadable && (
                <p className="text-[10px] font-mono text-amber-400/80 mt-1">{t("oc.imeiReminderNote")}</p>
              )}
              {errors.imei && <p data-testid="err-imei" className="text-[10px] font-mono text-red-400 mt-1">{errors.imei}</p>}
            </div>
            {/* --- Geräte-Sperre --- */}
            <div>
              <label className={labelCls}><LockKey size={12} className="inline mb-0.5 mr-1" />{t("oc.lock")}</label>
              <select data-testid="order-lock-type" value={form.device_lock_type}
                onChange={(e) => setForm({ ...form, device_lock_type: e.target.value, device_passcode: "" })}
                className={inputCls}>
                <option value="none">{t("oc.lockNone")}</option>
                <option value="pattern">{t("oc.lockPattern")}</option>
                <option value="pin">{t("oc.lockPin")}</option>
                <option value="password">{t("oc.lockPassword")}</option>
              </select>
              {form.device_lock_type === "pin" && (
                <input data-testid="order-lock-pin" inputMode="numeric" value={form.device_passcode}
                  onChange={set("device_passcode")} placeholder={t("oc.pinPlaceholder")}
                  className={`${inputCls} font-mono mt-2`} />
              )}
              {form.device_lock_type === "password" && (
                <input data-testid="order-lock-password" value={form.device_passcode}
                  onChange={set("device_passcode")} placeholder={t("oc.passwordPlaceholder")}
                  className={`${inputCls} font-mono mt-2`} />
              )}
              {form.device_lock_type === "pattern" && (
                <div className="mt-3">
                  <PatternLock value={form.device_passcode} onChange={(seq) => setForm((f) => ({ ...f, device_passcode: seq }))} />
                </div>
              )}
              {errors.device_passcode && <p data-testid="err-device-passcode" className="text-[10px] font-mono text-red-400 mt-1">{errors.device_passcode}</p>}
            </div>
            <div>
              <label className={labelCls}>{t("oc.warranty")}</label>
              <select data-testid="order-warranty" value={form.warranty_months} onChange={set("warranty_months")} className={inputCls}>
                {[0, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{m === 0 ? t("oc.warrantyNone") : t("oc.warrantyMonths", { m })}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-5">
            <label className={labelCls}>{t("oc.issue")}</label>
            <textarea data-testid="order-issue" required value={form.issue_description} onChange={set("issue_description")} rows={3} placeholder={t("oc.issuePlaceholder")} className={inputCls} />
            {errors.issue_description && <p className="text-[10px] font-mono text-red-400 mt-1">{errors.issue_description}</p>}
          </div>
        </section>

        {/* Kunde */}
        <section>
          <h2 className="font-head font-semibold text-lg tracking-tight mb-4 border-b border-border pb-2">{t("oc.secCustomer")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>{t("oc.name")}</label>
              <input data-testid="order-customer-name" required value={form.customer_name} onChange={set("customer_name")} className={inputCls} />
              {errors.customer_name && <p className="text-[10px] font-mono text-red-400 mt-1">{errors.customer_name}</p>}
            </div>
            <div>
              <label className={labelCls}>{t("oc.phone")}</label>
              <input data-testid="order-customer-phone" required value={form.customer_phone} onChange={set("customer_phone")} className={`${inputCls} font-mono`} />
              {errors.customer_phone && <p className="text-[10px] font-mono text-red-400 mt-1">{errors.customer_phone}</p>}
            </div>
            <div>
              <label className={labelCls}>{t("oc.email")}</label>
              <input data-testid="order-customer-email" type="email" value={form.customer_email} onChange={set("customer_email")} placeholder={t("oc.optional")} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t("oc.address")}</label>
              <input data-testid="order-customer-address" value={form.customer_address} onChange={set("customer_address")} placeholder={t("oc.optional")} className={inputCls} />
            </div>
          </div>
        </section>

        {/* Zuweisung */}
        <section>
          <h2 className="font-head font-semibold text-lg tracking-tight mb-4 border-b border-border pb-2">{t("oc.secAssign")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>{t("oc.technicianOptional")}</label>
              <select data-testid="order-technician" value={form.assigned_techniker_id} onChange={set("assigned_techniker_id")} className={inputCls}>
                <option value="">{t("oc.assignLater")}</option>
                {technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Kostenaufschlüsselung */}
        <section>
          <h2 className="font-head font-semibold text-lg tracking-tight mb-4 border-b border-border pb-2 flex items-center gap-2">
            <Receipt size={18} className="text-accent" /> {t("oc.secCosts")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className={labelCls}>{t("oc.diagnosisCost")} <span className="text-muted-foreground/60">{t("oc.optionalTag")}</span></label>
              <input data-testid="order-diagnosis-fee" type="number" step="0.01" value={form.diagnosis_fee} onChange={set("diagnosis_fee")} placeholder="0.00" className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>{t("oc.laborCost")}</label>
              <input data-testid="order-labor-cost" type="number" step="0.01" value={form.labor_cost} onChange={set("labor_cost")} placeholder="0.00" className={`${inputCls} font-mono`} />
            </div>
            <div>
              <label className={labelCls}>{t("oc.attemptCost")} <span className="text-muted-foreground/60">{t("oc.optionalTag")}</span></label>
              <input data-testid="order-parts-cost" type="number" step="0.01" value={form.parts_cost} onChange={set("parts_cost")} placeholder="0.00" className={`${inputCls} font-mono`} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-4">
            <div>
              <label className={labelCls}>{t("oc.paymentStatusDiagnosis")}</label>
              <select data-testid="order-diagnosis-payment" value={form.diagnosis_payment_status} onChange={set("diagnosis_payment_status")} className={inputCls}>
                <option value="OPEN">{t("costs.open")}</option>
                <option value="PAID">{t("costs.paid")}</option>
                <option value="NA">{t("costs.na")}</option>
              </select>
            </div>
          </div>
          <div className="mt-5 border border-border bg-background p-4 max-w-sm ml-auto font-mono text-sm space-y-1.5">
            <div className="flex justify-between text-muted-foreground"><span>{t("oc.net")}</span><span data-testid="cost-net">{netTotal.toFixed(2)} €</span></div>
            <div className="flex justify-between text-muted-foreground"><span>{t("oc.tax")}</span><span data-testid="cost-tax">{taxTotal.toFixed(2)} €</span></div>
            <div className="flex justify-between text-foreground font-semibold text-base border-t border-border pt-1.5 mt-1.5"><span>{t("oc.gross")}</span><span data-testid="cost-gross">{grossTotal.toFixed(2)} €</span></div>
          </div>
        </section>

        {/* Zustandsprotokoll Media */}
        <section>
          <h2 className="font-head font-semibold text-lg tracking-tight mb-4 border-b border-border pb-2">{t("oc.secMedia")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label data-testid="order-media-input-label" className="flex flex-col items-center justify-center border border-dashed border-border py-8 cursor-pointer hover:border-accent transition-colors">
              <Camera size={28} className="text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">{t("oc.uploadFile")}</span>
              <span className="text-[11px] font-mono text-muted-foreground/70 mt-1">{t("oc.selectFiles")}</span>
              <input data-testid="order-media-input" type="file" accept="image/*,video/*" multiple onChange={addFiles} className="hidden" />
            </label>
            <button type="button" data-testid="order-open-camera" onClick={() => setShowCamera(true)}
              className="flex flex-col items-center justify-center border border-dashed border-accent/50 py-8 hover:border-accent hover:bg-accent/5 transition-colors">
              <VideoCamera size={28} className="text-accent mb-2" />
              <span className="text-sm text-foreground/80">{t("oc.liveCapture")}</span>
              <span className="text-[11px] font-mono text-muted-foreground/70 mt-1">{t("oc.captureDirect")}</span>
            </button>
          </div>
          {files.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-4">
              {files.map((f, i) => (
                <div key={i} className="relative group border border-border aspect-square overflow-hidden bg-background">
                  {f.file.type.startsWith("video") ? (
                    <video src={f.url} className="w-full h-full object-cover" />
                  ) : (
                    <img src={f.url} alt="" className="w-full h-full object-cover" />
                  )}
                  <button type="button" data-testid={`remove-media-${i}`} onClick={() => removeFile(i)}
                    className="absolute top-1 right-1 bg-background/80 text-foreground p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Digitale Unterschrift & Haftungsausschluss */}
        <section>
          <h2 className="font-head font-semibold text-lg tracking-tight mb-4 border-b border-border pb-2 flex items-center gap-2">
            <Signature size={18} className="text-accent" /> {t("oc.secSignature")}
          </h2>
          <div className="border border-amber-900/50 bg-amber-950/20 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={16} className="text-amber-400" />
              <span className="font-mono text-[11px] uppercase tracking-wider text-amber-400">{t("oc.waiverTitle")}</span>
            </div>
            <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{LIABILITY_WAIVER}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            <div>
              <label className={labelCls}>{t("oc.signerName")}</label>
              <input data-testid="order-signer-name" value={signerName} onChange={(e) => setSignerName(e.target.value)}
                placeholder={t("oc.signerPlaceholder")} className={inputCls} />
            </div>
            <div>
              {intakeSignature ? (
                <div className="space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle size={14} weight="fill" /> {t("oc.signatureCaptured")}
                  </div>
                  <div className="border border-border rounded-lg bg-white p-2 inline-block">
                    <img src={intakeSignature} alt={t("oc.secSignature")} className="h-20 object-contain" />
                  </div>
                  <button type="button" onClick={() => setIntakeSignature(null)}
                    className="block text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground underline">
                    {t("oc.signAgain")}
                  </button>
                </div>
              ) : (
                <SignaturePad onSave={(d) => { setIntakeSignature(d); toast.success(t("oc.signatureCaptured")); }} label={t("oc.signHere")} />
              )}
            </div>
          </div>
        </section>

        <div className="flex gap-3 pt-2">
          <button data-testid="order-submit" type="submit" disabled={busy}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-head font-semibold text-sm uppercase tracking-wider px-6 py-3 rounded-lg hover:bg-blue-600 hover:text-primary-foreground transition-colors disabled:opacity-50">
            {busy ? <><SpinnerGap size={16} className="animate-spin" /> {t("oc.submitting")}</> : <><FloppyDisk size={16} /> {t("oc.submit")}</>}
          </button>
          <button type="button" onClick={() => navigate("/auftraege")}
            className="px-6 py-3 text-sm font-head uppercase tracking-wider border border-border text-muted-foreground hover:text-primary-foreground hover:bg-muted transition-colors rounded-lg">
            {t("common.cancel")}
          </button>
        </div>
      </form>
      {showCamera && (
        <CameraCapture onCapture={addCapturedFile} onClose={() => setShowCamera(false)} />
      )}
    </div>
  );
}