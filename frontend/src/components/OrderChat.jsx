import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import api, { getToken } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PaperPlaneRight, ChatCircleDots } from "@phosphor-icons/react";

export default function OrderChat({ orderId }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const listRef = useRef(null);

  // جلب الرسائل عند تحميل المكون أو تغيير رقم العقد، مع تحديث تلقائي كل 3 ثوانٍ (Polling)
// جلب الرسائل مع تحديث آمن كل 15 ثانية وتجنب تداخل الطلبات
  useEffect(() => {
    let isMounted = true;
    let abortController = null;

    const fetchMessages = async () => {
      if (abortController) {
        abortController.abort(); // إلغاء الطلب السابق إذا لم ينتهِ بعد
      }
      abortController = new AbortController();

      try {
        const { data } = await api.get(`/orders/${orderId}/messages`, {
          signal: abortController.signal,
        });
        if (isMounted) {
          setMessages(data);
        }
      } catch (err) {
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          console.error("Fehler beim Laden der Nachrichten:", err);
        }
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 15000); // رفع المدة إلى 15 ثانية لتخفيف الضغط تماماً

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (abortController) {
        abortController.abort();
      }
    };
  }, [orderId]);

  useEffect(() => {
    // Scroll only the chat's own message list to the bottom — never the page/window.
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    const messageText = text.trim();
    setText(""); // تفريغ الحقل فوراً لتجربة مستخدم سلسة

    try {
      // إرسال الرسالة عبر طلب HTTP POST العادي والمستقر
      const { data } = await api.post(`/orders/${orderId}/messages`, {
        message: messageText,
      });
      // تحديث القائمة المحلية فوراً
      setMessages((prev) => [...prev, data]);
    } catch (err) {
      console.error("Fehler beim Senden der Nachricht:", err);
    }
  };

  return (
    <div className="flex flex-col h-[480px] border border-border bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60">
        <div className="flex items-center gap-2">
          <ChatCircleDots size={18} className="text-accent" />
          <h3 className="font-head font-semibold text-sm">{t("chat.title")}</h3>
        </div>
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {t("chat.active")}
        </span>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-xs font-mono text-muted-foreground/70 py-8">
            {t("chat.empty")}
          </div>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === user.id;
          const isTech = m.sender_role === "techniker";
          return (
            <div key={m.id || Math.random()} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[78%] px-3 py-2 border ${
                mine ? "bg-accent/15 border-accent/40" : isTech ? "bg-amber-950/30 border-amber-800/50" : "bg-card border-border"
              }`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{m.sender_name}</span>
                  <span className={`font-mono text-[9px] uppercase px-1 ${isTech ? "text-amber-400" : "text-accent"}`}>
                    {m.sender_role === "techniker" ? "TECH" : m.sender_role === "admin" ? "ADMIN" : "MA"}
                  </span>
                </div>
                <div className="text-sm text-foreground break-words">{m.message}</div>
                <div className="text-[9px] font-mono text-muted-foreground/70 mt-1">
                  {new Date(m.created_at || Date.now()).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={send} className="flex gap-2 p-3 border-t border-border">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("chat.placeholder")}
          className="flex-1 bg-black border border-border px-3 py-2 text-sm rounded-lg outline-none focus:border-accent transition-colors"
        />
        <button type="submit"
          className="bg-primary text-primary-foreground px-4 rounded-lg hover:bg-blue-600 hover:text-primary-foreground transition-colors">
          <PaperPlaneRight size={16} weight="fill" />
        </button>
      </form>
    </div>
  );
}