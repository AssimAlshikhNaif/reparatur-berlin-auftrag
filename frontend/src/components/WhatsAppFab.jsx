import { useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { WhatsappLogo, X, PaperPlaneRight } from "@phosphor-icons/react";
import { toast } from "sonner";

export default function WhatsAppFab({ order, onLogged }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const TEMPLATES = [t("comm.tpl1"), t("comm.tpl2"), t("comm.tpl3")];
  const phone = order.customer_phone || "";

  const send = async () => {
    const text = message.trim();
    if (!text) { toast.error(t("wa.enterMessage")); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/orders/${order.id}/whatsapp`, { message: text });
      const wa = `https://wa.me/${data.wa_number}?text=${encodeURIComponent(text)}`;
      window.open(wa, "_blank", "noopener");
      toast.success(t("wa.opened"));
      setMessage("");
      setOpen(false);
      onLogged && onLogged();
    } catch (e) {
      toast.error(e.response?.data?.detail || t("wa.sendError"));
    } finally { setBusy(false); }
  };

  return (
    <>
      <button
        data-testid="whatsapp-fab"
        onClick={() => setOpen(true)}
        aria-label={t("wa.title")}
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
                <h3 className="font-head font-semibold text-sm">{t("wa.title")}</h3>
              </div>
              <button data-testid="whatsapp-close" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-primary-foreground"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="font-mono text-xs text-muted-foreground">{t("wa.to")} <span className="text-foreground">{phone || t("wa.noNumber")}</span></div>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATES.map((tpl, i) => (
                  <button key={i} data-testid={`wa-template-${i}`} onClick={() => setMessage(tpl)}
                    className="text-[10px] font-mono border border-border px-2 py-1 text-muted-foreground hover:text-primary-foreground hover:bg-muted transition-colors text-left">
                    {t("wa.template", { n: i + 1 })}
                  </button>
                ))}
              </div>
              <textarea data-testid="whatsapp-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
                placeholder={t("wa.messagePlaceholder")}
                className="w-full bg-background border border-border px-3 py-2.5 text-sm rounded-lg outline-none focus:border-[#25D366] transition-colors" />
              <button data-testid="whatsapp-send" onClick={send} disabled={busy || !phone}
                className="w-full flex items-center justify-center gap-2 bg-[#25D366] text-foreground font-head font-semibold text-sm uppercase tracking-wider py-3 rounded-lg hover:bg-[#1ebe5b] transition-colors disabled:opacity-50">
                <PaperPlaneRight size={16} weight="fill" /> {t("wa.send")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
