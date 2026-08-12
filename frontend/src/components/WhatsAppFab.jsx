import { useState } from "react";
import api from "@/lib/api";
import { WhatsappLogo, X, PaperPlaneRight } from "@phosphor-icons/react";
import { toast } from "sonner";

const TEMPLATES = [
  "Ihr Gerät ist repariert und abholbereit. Bitte bringen Sie Ihren Abholschein mit.",
  "Wir haben Ihr Gerät erhalten und mit der Diagnose begonnen.",
  "Für Ihre Reparatur ist Ihre Freigabe des Kostenvoranschlags erforderlich.",
];

export default function WhatsAppFab({ order, onLogged }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const phone = order.customer_phone || "";

  const send = async () => {
    const text = message.trim();
    if (!text) { toast.error("Bitte Nachricht eingeben"); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/orders/${order.id}/whatsapp`, { message: text });
      const wa = `https://wa.me/${data.wa_number}?text=${encodeURIComponent(text)}`;
      window.open(wa, "_blank", "noopener");
      toast.success("WhatsApp geöffnet & protokolliert");
      setMessage("");
      setOpen(false);
      onLogged && onLogged();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Fehler beim Senden");
    } finally { setBusy(false); }
  };

  return (
    <>
      <button
        data-testid="whatsapp-fab"
        onClick={() => setOpen(true)}
        aria-label="WhatsApp an Kunden"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#25D366] text-foreground flex items-center justify-center shadow-lg hover:scale-105 hover:bg-[#1ebe5b] transition-transform"
      >
        <WhatsappLogo size={28} weight="fill" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-background border border-border w-full max-w-md">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[#25D366]/10">
              <div className="flex items-center gap-2">
                <WhatsappLogo size={20} weight="fill" className="text-[#25D366]" />
                <h3 className="font-head font-semibold text-sm">WhatsApp an Kunden</h3>
              </div>
              <button data-testid="whatsapp-close" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-primary-foreground"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="font-mono text-xs text-muted-foreground">An: <span className="text-foreground">{phone || "— keine Nummer —"}</span></div>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATES.map((t, i) => (
                  <button key={i} data-testid={`wa-template-${i}`} onClick={() => setMessage(t)}
                    className="text-[10px] font-mono border border-border px-2 py-1 text-muted-foreground hover:text-primary-foreground hover:bg-muted transition-colors text-left">
                    Vorlage {i + 1}
                  </button>
                ))}
              </div>
              <textarea data-testid="whatsapp-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
                placeholder="Nachricht an den Kunden…"
                className="w-full bg-background border border-border px-3 py-2.5 text-sm rounded-lg outline-none focus:border-[#25D366] transition-colors" />
              <button data-testid="whatsapp-send" onClick={send} disabled={busy || !phone}
                className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-foreground font-head font-semibold text-sm uppercase tracking-wider py-3 rounded-lg hover:bg-[#1ebe5b] transition-colors disabled:opacity-50">
                <PaperPlaneRight size={16} weight="fill" /> Per WhatsApp senden
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
