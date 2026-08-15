import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
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
  const reclamationSource = location.state?.reclamationOf || null;
  const { user } = useAuth();
  const isMitarbeiter = user.role === "mitarbeiter";
  const [branches, setBranches] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [intakeSignature, setIntakeSignature] = useState(null);
  const [signerName, setSignerName] = useState("");
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    branch_id: reclamationSource?.branch_id || "", device_brand: reclamationSource?.device_brand || "Apple",
    device_model: reclamationSource?.device_model || "", imei: reclamationSource?.imei || "",
    imei_unreadable: false,
    device_passcode: "",
    device_lock_type: "none", // none | pattern | pin | password
    issue_description: reclamationSource ? `Reklamation zu ${reclamationSource.auftragsnummer}: ` : "",
    customer_name: reclamationSource?.customer_name || "", customer_phone: reclamationSource?.customer_phone || "",
    customer_email: reclamationSource?.customer_email || "", customer_address: reclamationSource?.customer_address || "",
    estimated_price: "",
    diagnosis_fee: reclamationSource ? "0" : "", labor_cost: reclamationSource ? "0" : "", parts_cost: reclamationSource ? "0" : "",
    warranty_months: 6,
    assigned_techniker_id: "",
  });

  const netTotal = (parseFloat(form.diagnosis_fee) || 0) + (parseFloat(form.labor_cost) || 0) + (parseFloat(form.parts_cost) || 0);
  const taxTotal = netTotal * 0.19;
  const grossTotal = netTotal + taxTotal;

  useEffect(() => {
    (async () => {
      const [b, t] = await Promise.all([api.get("/branches"), api.get("/technicians")]);
      setBranches(b.data);
      setTechnicians(t.data);
      if (isMitarbeiter && user.branch_id) {
        setForm((f) => ({ ...f, branch_id: user.branch_id }));
      } else if (b.data.length) {
        setForm((f) => ({ ...f, branch_id: f.branch_id || b.data[0].id }));
      }
    })();
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  // Strict validation: block save until all required fields are complete.
  const validate = () => {
    const e = {};
    if (!form.branch_id) e.branch_id = "Filiale erforderlich";
    if (!form.device_model.trim()) e.device_model = "Modell erforderlich";
    if (!form.issue_description.trim()) e.issue_description = "Fehlerbeschreibung erforderlich";
    if (!form.imei.trim() && !form.imei_unreadable) e.imei = "IMEI erforderlich (oder 'nicht lesbar' aktivieren)";
    if (!form.customer_name.trim()) e.customer_name = "Kundenname erforderlich";
    if (!form.customer_phone.trim()) e.customer_phone = "Telefon erforderlich";
    // Pricing must be fully completed (fields may be 0, but not left blank)
    ["diagnosis_fee", "labor_cost", "parts_cost"].forEach((k) => {
      if (form[k] === "" || form[k] === null || form[k] === undefined) e[k] = "Pflichtfeld";
    });
    if (form.device_lock_type !== "none" && !form.device_passcode.trim()) {
      e.device_passcode = "Sperrwert erforderlich";
    }
    setErrors(e);
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
    if (!validate()) {
      toast.error("Bitte alle Pflichtfelder vollständig ausfüllen (Kunde, Gerät, Preise).");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        ...form,
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
      };
      const { data } = await api.post("/orders", payload);
      // upload media
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f.file);
        fd.append("media_type", "intake");
        await api.post(`/orders/${data.id}/media`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      }
      toast.success(`Auftrag ${data.auftragsnummer} erstellt`);
      navigate(`/auftrag/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Erstellen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader label={reclamationSource ? "Reklamation / Garantiefall" : "Auftragserstellung"} title={reclamationSource ? "Neue Reklamation" : "Neuer Auftrag"} />
      <form onSubmit={submit} className="p-6 md:p-8 max-w-4xl space-y-8">
        {reclamationSource && (
          <div data-testid="reclamation-banner" className="border border-amber-700 bg-amber-950/30 rounded-lg px-4 py-3 flex items-center gap-3">
            <ShieldCheck size={20} className="text-amber-400 shrink-0" />
            <div>
              <div className="font-mono text-[11px] uppercase tracking-wider text-amber-300">Reklamation / Garantiefall</div>
              <div className="text-sm text-foreground/90">Bezug: Auftrag <span className="font-mono">{reclamationSource.auftragsnummer}</span> · Gerätedaten & Kundendaten wurden übernommen, Preise auf 0,00 € gesetzt.</div>
            </div>
          </div>
        )}
        {/* Geräte + Filiale */}
        <section>
          <h2 className="font-head font-semibold text-lg tracking-tight mb-4 border-b border-border pb-2">Gerät & Filiale</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Filiale</label>
              <select data-testid="order-branch" required value={form.branch_id} onChange={set("branch_id")} disabled={isMitarbeiter}
                className={`${inputCls} ${isMitarbeiter ? "opacity-70 cursor-not-allowed" : ""}`}>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              {isMitarbeiter && (
                <p className="text-[10px] font-mono text-muted-foreground mt-1">Fest Ihrer Filiale zugeordnet (schreibgeschützt).</p>
              )}
            </div>
            <div>
              <label className={labelCls}>Marke</label>
              <select data-testid="order-brand" value={form.device_brand} onChange={set("device_brand")} className={inputCls}>
                {DEVICE_BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Modell</label>
              <input data-testid="order-model" required value={form.device_model} onChange={set("device_model")} placeholder="z.B. iPhone 14 Pro" className={inputCls} />
              {errors.device_model && <p className="text-[10px] font-mono text-red-400 mt-1">{errors.device_model}</p>}
            </div>
            <div>
              <label className={labelCls}>IMEI / Seriennr. <span className="text-red-400">*</span></label>
              <input data-testid="order-imei" value={form.imei} onChange={set("imei")}
                placeholder={form.imei_unreadable ? "Später nachtragen…" : "Pflichtfeld"}
                disabled={form.imei_unreadable}
                className={`${inputCls} font-mono ${form.imei_unreadable ? "opacity-50" : ""}`} />
              <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                <input data-testid="order-imei-unreadable" type="checkbox" checked={form.imei_unreadable}
                  onChange={(e) => setForm({ ...form, imei_unreadable: e.target.checked, imei: e.target.checked ? "" : form.imei })}
                  className="accent-amber-500 w-4 h-4" />
                <span className="text-xs text-amber-300 flex items-center gap-1"><Warning size={13} /> Gerät defekt / IMEI nicht lesbar</span>
              </label>
              {form.imei_unreadable && (
                <p className="text-[10px] font-mono text-amber-400/80 mt-1">Ein Erinnerungshinweis wird im Auftrag angezeigt, bis die IMEI nachgetragen wird.</p>
              )}
            </div>
            {/* --- Geräte-Sperre: Muster / PIN / Passwort --- */}
            <div>
              <label className={labelCls}><LockKey size={12} className="inline mb-0.5 mr-1" />Geräte-Sperre</label>
              <select data-testid="order-lock-type" value={form.device_lock_type}
                onChange={(e) => setForm({ ...form, device_lock_type: e.target.value, device_passcode: "" })}
                className={inputCls}>
                <option value="none">Keine Sperre</option>
                <option value="pattern">Muster (zeichnen)</option>
                <option value="pin">PIN (numerisch)</option>
                <option value="password">Passwort (alphanumerisch)</option>
              </select>
              {form.device_lock_type === "pin" && (
                <input data-testid="order-lock-pin" inputMode="numeric" value={form.device_passcode}
                  onChange={set("device_passcode")} placeholder="z.B. 1234 / 123456"
                  className={`${inputCls} font-mono mt-2`} />
              )}
              {form.device_lock_type === "password" && (
                <input data-testid="order-lock-password" value={form.device_passcode}
                  onChange={set("device_passcode")} placeholder="Alphanumerisches Passwort"
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
              <label className={labelCls}>Garantie (Monate)</label>
              <select data-testid="order-warranty" value={form.warranty_months} onChange={set("warranty_months")} className={inputCls}>
                {[0, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{m === 0 ? "Keine Garantie" : `${m} Monate`}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-5">
            <label className={labelCls}>Fehlerbeschreibung</label>
            <textarea data-testid="order-issue" required value={form.issue_description} onChange={set("issue_description")} rows={3} placeholder="z.B. Display gesprungen, Touch reagiert nicht…" className={inputCls} />
            {errors.issue_description && <p className="text-[10px] font-mono text-red-400 mt-1">{errors.issue_description}</p>}
          </div>
        </section>

        {/* Kunde */}
        <section>
          <h2 className="font-head font-semibold text-lg tracking-tight mb-4 border-b border-border pb-2">Kundendaten</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Name</label>
              <input data-testid="order-customer-name" required value={form.customer_name} onChange={set("customer_name")} className={inputCls} />
              {errors.customer_name && <p className="text-[10px] font-mono text-red-400 mt-1">{errors.customer_name}</p>}
            </div>
            <div>
              <label className={labelCls}>Telefon</label>
              <input data-testid="order-customer-phone" required value={form.customer_phone} onChange={set("customer_phone")} className={`${inputCls} font-mono`} />
              {errors.customer_phone && <p className="text-[10px] font-mono text-red-400 mt-1">{errors.customer_phone}</p>}
            </div>
            <div>
              <label className={labelCls}>E-Mail</label>
              <input data-testid="order-customer-email" type="email" value={form.customer_email} onChange={set("customer_email")} placeholder="Optional" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Adresse</label>
              <input data-testid="order-customer-address" value={form.customer_address} onChange={set("customer_address")} placeholder="Optional" className={inputCls} />
            </div>
          </div>
        </section>

        {/* Zuweisung */}
        <section>
          <h2 className="font-head font-semibold text-lg tracking-tight mb-4 border-b border-border pb-2">Zuweisung</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Techniker (optional)</label>
              <select data-testid="order-technician" value={form.assigned_techniker_id} onChange={set("assigned_techniker_id")} className={inputCls}>
                <option value="">— Später zuweisen —</option>
                {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* Kostenaufschlüsselung */}
        <section>
          <h2 className="font-head font-semibold text-lg tracking-tight mb-4 border-b border-border pb-2 flex items-center gap-2">
            <Receipt size={18} className="text-accent" /> Kostenaufschlüsselung
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className={labelCls}>Diagnosegebühr (€) <span className="text-red-400">*</span></label>
              <input data-testid="order-diagnosis-fee" type="number" step="0.01" value={form.diagnosis_fee} onChange={set("diagnosis_fee")} placeholder="0.00" className={`${inputCls} font-mono`} />
              {errors.diagnosis_fee && <p className="text-[10px] font-mono text-red-400 mt-1">{errors.diagnosis_fee}</p>}
            </div>
            <div>
              <label className={labelCls}>Arbeitskosten (€) <span className="text-red-400">*</span></label>
              <input data-testid="order-labor-cost" type="number" step="0.01" value={form.labor_cost} onChange={set("labor_cost")} placeholder="0.00" className={`${inputCls} font-mono`} />
              {errors.labor_cost && <p className="text-[10px] font-mono text-red-400 mt-1">{errors.labor_cost}</p>}
            </div>
            <div>
              <label className={labelCls}>Materialkosten (€) <span className="text-red-400">*</span></label>
              <input data-testid="order-parts-cost" type="number" step="0.01" value={form.parts_cost} onChange={set("parts_cost")} placeholder="0.00" className={`${inputCls} font-mono`} />
              {errors.parts_cost && <p className="text-[10px] font-mono text-red-400 mt-1">{errors.parts_cost}</p>}
            </div>
          </div>
          <div className="mt-5 border border-border bg-background p-4 max-w-sm ml-auto font-mono text-sm space-y-1.5">
            <div className="flex justify-between text-muted-foreground"><span>Netto</span><span data-testid="cost-net">{netTotal.toFixed(2)} €</span></div>
            <div className="flex justify-between text-muted-foreground"><span>MwSt. (19%)</span><span data-testid="cost-tax">{taxTotal.toFixed(2)} €</span></div>
            <div className="flex justify-between text-foreground font-semibold text-base border-t border-border pt-1.5 mt-1.5"><span>Gesamt</span><span data-testid="cost-gross">{grossTotal.toFixed(2)} €</span></div>
          </div>
        </section>

        {/* Zustandsprotokoll Media */}
        <section>
          <h2 className="font-head font-semibold text-lg tracking-tight mb-4 border-b border-border pb-2">Zustandsprotokoll (Fotos / Videos)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label data-testid="order-media-input-label" className="flex flex-col items-center justify-center border border-dashed border-border py-8 cursor-pointer hover:border-accent transition-colors">
              <Camera size={28} className="text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">Datei hochladen</span>
              <span className="text-[11px] font-mono text-muted-foreground/70 mt-1">Fotos / Videos auswählen</span>
              <input data-testid="order-media-input" type="file" accept="image/*,video/*" multiple onChange={addFiles} className="hidden" />
            </label>
            <button type="button" data-testid="order-open-camera" onClick={() => setShowCamera(true)}
              className="flex flex-col items-center justify-center border border-dashed border-accent/50 py-8 hover:border-accent hover:bg-accent/5 transition-colors">
              <VideoCamera size={28} className="text-accent mb-2" />
              <span className="text-sm text-foreground/80">Live-Kameraaufnahme</span>
              <span className="text-[11px] font-mono text-muted-foreground/70 mt-1">Foto / Video direkt aufnehmen</span>
            </button>
          </div>
          {files.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mt-4">
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
            <Signature size={18} className="text-accent" /> Unterschrift Kunde (Abholschein)
          </h2>
          <div className="border border-amber-900/50 bg-amber-950/20 rounded-lg p-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck size={16} className="text-amber-400" />
              <span className="font-mono text-[11px] uppercase tracking-wider text-amber-400">Haftungsausschluss / Einverständnis</span>
            </div>
            <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{LIABILITY_WAIVER}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
            <div>
              <label className={labelCls}>Name Unterzeichner (optional)</label>
              <input data-testid="order-signer-name" value={signerName} onChange={(e) => setSignerName(e.target.value)}
                placeholder="Standard: Kundenname" className={inputCls} />
            </div>
            <div>
              {intakeSignature ? (
                <div className="space-y-2">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle size={14} weight="fill" /> Unterschrift erfasst
                  </div>
                  <div className="border border-border rounded-lg bg-white p-2 inline-block">
                    <img src={intakeSignature} alt="Unterschrift" className="h-20 object-contain" />
                  </div>
                  <button type="button" onClick={() => setIntakeSignature(null)}
                    className="block text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground underline">
                    Neu unterschreiben
                  </button>
                </div>
              ) : (
                <SignaturePad onSave={(d) => { setIntakeSignature(d); toast.success("Unterschrift erfasst"); }} label="Kunde unterschreibt hier (optional)" />
              )}
            </div>
          </div>
        </section>

        <div className="flex gap-3 pt-2">
          <button data-testid="order-submit" type="submit" disabled={busy}
            className="flex items-center gap-2 bg-primary text-primary-foreground font-head font-semibold text-sm uppercase tracking-wider px-6 py-3 rounded-lg hover:bg-blue-600 hover:text-primary-foreground transition-colors disabled:opacity-50">
            {busy ? <><SpinnerGap size={16} className="animate-spin" /> Speichern…</> : <><FloppyDisk size={16} /> Auftrag erstellen</>}
          </button>
          <button type="button" onClick={() => navigate("/auftraege")}
            className="px-6 py-3 text-sm font-head uppercase tracking-wider border border-border text-muted-foreground hover:text-primary-foreground hover:bg-muted transition-colors rounded-lg">
            Abbrechen
          </button>
        </div>
      </form>
      {showCamera && (
        <CameraCapture onCapture={addCapturedFile} onClose={() => setShowCamera(false)} />
      )}
    </div>
  );
}