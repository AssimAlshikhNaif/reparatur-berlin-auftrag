import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { WhatsappLogo, EnvelopeSimple, ChatText, PaperPlaneRight, WarningCircle } from "@phosphor-icons/react";
import { toast } from "sonner";

const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp", icon: WhatsappLogo, color: "#25D366" },
  { key: "sms", label: "SMS", icon: ChatText, color: "#3B82F6" },
  { key: "email", label: "E-Mail", icon: EnvelopeSimple, color: "#f59e0b" },
];

export default function CommunicationPanel({ order, onSent }) {
  const { t } = useTranslation();
  const [channel, setChannel] = useState("whatsapp");
  const [status, setStatus] = useState({ sms: false, whatsapp: false, email: false });
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState(t("comm.subjectDefault", { nr: order.auftragsnummer }));
  const [busy, setBusy] = useState(false);

  const TEMPLATES = [t("comm.tpl1"), t("comm.tpl2"), t("comm.tpl3")];

  useEffect(() => {
    api.get("/communication/status").then((r) => setStatus(r.data)).catch(() => {});
  }, []);

  const target = channel === "email" ? order.customer_email : order.customer_phone;
  const configured = status[channel];
  const channelLabel = channel === "email" ? "E-Mail" : channel === "sms" ? "SMS" : "WhatsApp";
  const notConfiguredTitle = channel === "email" ? t("comm.notConfiguredTitleEmail") : channel === "sms" ? t("comm.notConfiguredTitleSms") : t("comm.notConfiguredTitleWa");

  const send = async () => {
    const text = message.trim();
    if (!text) { toast.error(t("comm.enterMessage")); return; }
    if (!target) { toast.error(channel === "email" ? t("comm.noEmail") : t("comm.noPhone")); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/orders/${order.id}/notify`, {
        channel, message: text, subject: channel === "email" ? subject : undefined,
      });
      const st = data.result?.status;
      if (st === "sent") toast.success(t("comm.sent", { ch: channel.toUpperCase(), to: data.to }));
      else if (st === "not_configured") toast.info(t("comm.notConfiguredToast", { ch: channel.toUpperCase() }));
      else toast.warning(`${channel.toUpperCase()}: ${st}`);
      setMessage("");
      onSent && onSent();
    } catch (e) {
      toast.error(e.response?.data?.detail || t("comm.sendError"));
    } finally { setBusy(false); }
  };

  return (
    <div data-testid="communication-panel" className="space-y-3">
      <div className="flex items-center gap-2">
        {CHANNELS.map((c) => {
          const Icon = c.icon;
          const active = channel === c.key;
          return (
            <button key={c.key} type="button" data-testid={`comm-channel-${c.key}`} onClick={() => setChannel(c.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-head font-semibold uppercase tracking-wider rounded-lg border transition-colors ${active ? "border-accent bg-accent/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
              <Icon size={15} weight="fill" style={{ color: c.color }} /> {c.label}
              {!status[c.key] && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-500" />}
            </button>
          );
        })}
      </div>

      {!configured && (
        <div data-testid="comm-not-configured" className="flex items-start gap-2 text-[11px] font-mono text-amber-300 border border-amber-800/60 bg-amber-950/20 rounded-lg px-3 py-2">
          <WarningCircle size={14} className="mt-0.5 shrink-0" />
          <span>{notConfiguredTitle} {t("comm.notConfiguredHint")}</span>
        </div>
      )}

      <div className="font-mono text-xs text-muted-foreground">
        {t("comm.to")} <span className="text-foreground">{target || t("comm.noTarget")}</span>
      </div>

      {channel === "email" && (
        <input data-testid="comm-subject" value={subject} onChange={(e) => setSubject(e.target.value)}
          placeholder={t("comm.subject")} className="w-full bg-background border border-border px-3 py-2 text-sm rounded-lg outline-none focus:border-accent" />
      )}

      <div className="flex flex-wrap gap-1.5">
        {TEMPLATES.map((tpl, i) => (
          <button key={i} type="button" data-testid={`comm-template-${i}`} onClick={() => setMessage(tpl)}
            className="text-[10px] font-mono border border-border px-2 py-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-left">
            {t("comm.template", { n: i + 1 })}
          </button>
        ))}
      </div>

      <textarea data-testid="comm-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
        placeholder={t("comm.messagePlaceholder")}
        className="w-full bg-background border border-border px-3 py-2.5 text-sm rounded-lg outline-none focus:border-accent transition-colors" />

      <button data-testid="comm-send" onClick={send} disabled={busy || !target}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-head font-semibold text-sm uppercase tracking-wider py-2.5 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50">
        <PaperPlaneRight size={16} weight="fill" /> {t("comm.sendVia", { ch: channelLabel })}
      </button>
    </div>
  );
}
