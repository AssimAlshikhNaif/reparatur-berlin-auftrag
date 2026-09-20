import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PaperPlaneRight, ChatCircleDots, Microphone, Stop, Trash } from "@phosphor-icons/react";

export default function OrderChat({ orderId }) {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const listRef = useRef(null);

  // حالات التسجيل الصوتي
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const handleDeleteMessage = async (messageId) => {
    try {
        // استخدام api بدلاً من fetch لتضمين التوكن والرابط الأساسي تلقائياً
        const response = await api.delete(`/orders/${orderId}/messages/${messageId}`);
        
        if (response.status === 200 || response.data) {
            setMessages(prev => prev.filter(m => m.id !== messageId));
        }
    } catch (error) {
        console.error("Fehler beim Löschen der Nachricht:", error);
        alert("Nachricht konnte nicht gelöscht werden.");
    }
  };

  useEffect(() => {
    let isMounted = true;
    let abortController = null;

    const fetchMessages = async () => {
      if (abortController) {
        abortController.abort();
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
    const interval = setInterval(fetchMessages, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      if (abortController) {
        abortController.abort();
      }
    };
  }, [orderId]);

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // بدء التسجيل الصوتي
  const startRecording = async () => {
    audioChunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mikrofon-Zugriff verweigert oder Fehler:", err);
      alert("Mikrofon konnte nicht gestartet werden.");
    }
  };

  // إيقاف التسجيل الصوتي
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // إلغاء التسجيل الصوتي المسجل
  const cancelRecording = () => {
    setAudioBlob(null);
    setIsRecording(false);
  };

  // إرسال الرسالة (نص أو ملف صوتي أو كلاهما)
  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() && !audioBlob) return;

    const messageText = text.trim();
    const currentAudio = audioBlob;

    setText("");
    setAudioBlob(null);

    const formData = new FormData();
    if (messageText) {
      formData.append("message", messageText);
    }
    if (currentAudio) {
      formData.append("audio_file", currentAudio, "voice_message.webm");
    }

    try {
      const { data } = await api.post(`/orders/${orderId}/messages`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      setMessages((prev) => [...prev, data]);
    } catch (err) {
      console.error("Fehler beim Senden der Nachricht:", err);
      alert("Fehler beim Senden der Nachricht.");
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
              <div className={`relative max-w-[78%] px-3 py-2 border group ${
                mine ? "bg-accent/15 border-accent/40" : isTech ? "bg-amber-950/30 border-amber-800/50" : "bg-card border-border"
              }`}>
                {/* زر الحذف (يظهر عند التمرير أو بشكل مباشر) */}
                {mine && (
                  <button
                    onClick={() => handleDeleteMessage(m.id)}
                    className="absolute top-1 right-1 text-muted-foreground hover:text-red-500 text-xs px-1 opacity-60 hover:opacity-100 transition-opacity"
                    title="Nachricht löschen"
                  >
                    ✕
                  </button>
                )}

                <div className="flex items-center gap-2 mb-0.5 pr-4">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{m.sender_name}</span>
                  <span className={`font-mono text-[9px] uppercase px-1 ${isTech ? "text-amber-400" : "text-accent"}`}>
                    {m.sender_role === "techniker" ? "TECH" : m.sender_role === "admin" ? "ADMIN" : "MA"}
                  </span>
                </div>

                {/* عرض النص إن وجد */}
                {m.message && <div className="text-sm text-foreground break-words pr-2">{m.message}</div>}

                {/* عرض مشغل الصوت إذا كان هناك ملف صوتي */}
                {m.audio_url && (
                  <div className="mt-2">
                    <audio controls className="w-full max-w-[240px] h-8">
                      <source src={`http://127.0.0.1:8001${m.audio_url}`} type="audio/webm" />
                      Ihr Browser unterstützt kein Audio-Element.
                    </audio>
                  </div>
                )}

                <div className="text-[9px] font-mono text-muted-foreground/70 mt-1">
                  {new Date(m.created_at || Date.now()).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* شريط الإدخال وأزرار الصوت */}
      <form onSubmit={send} className="flex flex-col gap-2 p-3 border-t border-border bg-card/40">
        {isRecording && (
          <div className="flex items-center justify-between bg-red-950/30 border border-red-800/50 px-3 py-1.5 rounded-lg text-xs text-red-400 font-mono">
            <span>🔴 Aufnahme läuft...</span>
            <button
              type="button"
              onClick={stopRecording}
              className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] hover:bg-red-700"
            >
              Stopp
            </button>
          </div>
        )}

        {audioBlob && !isRecording && (
          <div className="flex items-center justify-between bg-accent/10 border border-accent/30 px-3 py-1.5 rounded-lg text-xs text-accent font-mono">
            <span>🎤 Sprachnachricht bereit zum Senden</span>
            <button
              type="button"
              onClick={cancelRecording}
              className="text-muted-foreground hover:text-red-400"
            >
              <Trash size={16} />
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("chat.placeholder")}
            className="flex-1 bg-black border border-border px-3 py-2 text-sm rounded-lg outline-none focus:border-accent transition-colors"
          />

          {/* زر الميكروفون للتسجيل */}
          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              title="Sprachaufnahme starten"
              className="bg-secondary text-secondary-foreground px-3 rounded-lg hover:bg-secondary/80 transition-colors"
            >
              <Microphone size={18} />
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="bg-red-600 text-white px-3 rounded-lg hover:bg-red-700 transition-colors animate-pulse"
            >
              <Stop size={18} />
            </button>
          )}

          <button
            type="submit"
            className="bg-primary text-primary-foreground px-4 rounded-lg hover:bg-blue-600 transition-colors"
          >
            <PaperPlaneRight size={16} weight="fill" />
          </button>
        </div>
      </form>
    </div>
  );
}