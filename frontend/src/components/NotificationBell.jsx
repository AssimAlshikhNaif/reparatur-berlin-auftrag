import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { toast } from "sonner";
import { Bell, Check, Trash, X } from "@phosphor-icons/react";
import { berlinDateTime } from "@/lib/datetime";

// زيادة فترة التحديث قليلاً (15 ثانية) لمنع تكدس الطلبات واستهلاك اتصالات المتصفح
const POLL_MS = 15000;

function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const tones = [880, 1320];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = now + i * 0.14;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.18);
    });
    setTimeout(() => ctx.close(), 800);
  } catch (e) {}
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const branchId = searchParams.get("branch_id") || "";
  const { t } = useTranslation();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const seenIds = useRef(new Set());
  const initialised = useRef(false);
  const soundOn = useRef(true);
  
  // مرجع لإلغاء الطلبات المتداخلة لمنع حدوث Stalled أو تداخل في الشبكة
  const abortControllerRef = useRef(null);

  const poll = useCallback(async () => {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const params = { limit: 50 };
      if (branchId) {
        params.branch_id = branchId;
      }

      const { data } = await api.get("/notifications", { 
        params,
        signal: abortControllerRef.current.signal 
      });
      const fetchedItems = data.items || [];

      setItems(fetchedItems);
      setUnread(data.unread !== undefined ? data.unread : fetchedItems.filter(n => !n.read).length);

      if (!initialised.current) {
        fetchedItems.forEach((n) => seenIds.current.add(n.id));
        initialised.current = true;
        return;
      }

      const fresh = fetchedItems.filter((n) => !seenIds.current.has(n.id));
      fresh.forEach((n) => seenIds.current.add(n.id));
      if (fresh.length > 0) {
        if (soundOn.current) playBeep();
        const top = fresh[0];
        toast(top.title, {
          description: top.message,
          action: top.order_id
            ? { label: t("notif.open"), onClick: () => navigate(`/auftrag/${top.order_id}`) }
            : undefined,
        });
      }
    } catch (e) {
      if (e.name !== "CanceledError" && e.name !== "AbortError") {
        /* ignore network cancellation */
      }
    }
  }, [branchId, navigate, t]);

  useEffect(() => {
    initialised.current = false;
    seenIds.current.clear();
    poll();
    const iv = setInterval(poll, POLL_MS);
    return () => {
      clearInterval(iv);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [poll, branchId]);

  const markAllRead = async () => {
    try {
      const params = branchId ? { branch_id: branchId } : {};
      await api.post("/notifications/read", null, { params });
      setUnread(0);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (e) {}
  };

  const clearAll = async () => {
    try {
      const params = branchId ? { branch_id: branchId } : {};
      await api.delete("/notifications", { params });
      setItems([]);
      setUnread(0);
    } catch (e) {}
  };

  const toggleOpen = () => {
    setOpen((o) => !o);
  };

  const openItem = async (n) => {
    setOpen(false);

    if (!n.read) {
      try {
        const params = branchId ? { branch_id: branchId } : {};
        await api.post(`/notifications/${n.id}/read`, null, { params });
        setItems((prev) => prev.map((item) => item.id === n.id ? { ...item, read: true } : item));
        setUnread((prev) => Math.max(0, prev - 1));
      } catch (e) {}
    }

    if (n.order_id) navigate(`/auftrag/${n.order_id}`);
  };

  return (
    <div className="relative">
      <button
        data-testid="notification-bell"
        onClick={toggleOpen}
        className="relative flex items-center justify-center w-9 h-9 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer"
        title={t("notif.title")}
      >
        <Bell size={18} className={unread > 0 ? "text-accent" : "text-muted-foreground"} weight={unread > 0 ? "fill" : "regular"} />
        {unread > 0 && (
          <span data-testid="notification-count"
            className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-mono font-bold">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div data-testid="notification-panel"
            className="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:left-auto sm:top-auto sm:mt-2 w-auto sm:w-96 max-h-[75vh] overflow-hidden z-40 bg-background border border-border rounded-xl shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-accent" />
                <span className="font-head font-semibold text-sm">{t("notif.title")}</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={markAllRead} title={t("notif.markAllRead")} className="p-1.5 rounded hover:bg-muted text-muted-foreground cursor-pointer"><Check size={15} /></button>
                <button onClick={clearAll} title={t("notif.clearAll")} className="p-1.5 rounded hover:bg-muted text-muted-foreground cursor-pointer"><Trash size={15} /></button>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-muted text-muted-foreground cursor-pointer"><X size={15} /></button>
              </div>
            </div>
            <div className="overflow-y-auto">
              {items.length === 0 ? (
                <div className="text-xs font-mono text-muted-foreground/70 py-8 text-center">{t("notif.empty")}</div>
              ) : (
                items.map((n) => (
                  <button key={n.id} onClick={() => openItem(n)}
                    className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer ${!n.read ? "bg-accent/5" : ""}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-wider text-accent">{n.kind}</span>
                      <span className="font-mono text-[9px] text-muted-foreground">{berlinDateTime(n.at)}</span>
                    </div>
                    <div className="text-sm text-foreground mt-0.5 font-medium">{n.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{n.message}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}