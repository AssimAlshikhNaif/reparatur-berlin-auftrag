import React, { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  ShoppingCart, Plus, Trash, Link as LinkIcon, Clock, Truck, Package,
  CalendarBlank, CheckCircle,
} from "@phosphor-icons/react";
import { PURCHASE_STATUS_LABELS, PURCHASE_STATUS_STYLES, PURCHASE_STATUS_ORDER } from "@/lib/constants";
import { berlinDateTime } from "@/lib/datetime";

const inputCls = "w-full bg-background border border-border px-3 py-2 text-sm rounded-lg outline-none focus:border-accent";

function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border rounded-lg ${PURCHASE_STATUS_STYLES[status] || "bg-muted text-foreground/80 border-border"}`}>
      {PURCHASE_STATUS_LABELS[status] || status}
    </span>
  );
}

export default function OrderPurchasesTab({ orderId, onChange }) {
  const { user } = useAuth();
  const isTech = user.role === "techniker";
  const canManage = user.role === "admin" || user.role === "mitarbeiter";

  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ part_name: "", supplier_url: "", price: "", expected_arrival: "", notes: "" });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/purchases/order/${orderId}`);
      setPurchases(data);
      onChange && onChange(data.length);
    } catch (e) { /* ignore */ }
  }, [orderId, onChange]);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    if (!form.part_name.trim()) { toast.error("Bitte Teilebezeichnung angeben"); return; }
    setLoading(true);
    try {
      const payload = {
        order_id: orderId,
        part_name: form.part_name,
        supplier_url: form.supplier_url,
        notes: form.notes,
        expected_arrival: form.expected_arrival || null,
        status: "ANGEFRAGT",
      };
      if (!isTech && form.price !== "") payload.price = parseFloat(form.price) || 0;
      await api.post("/purchases", payload);
      toast.success("Beschaffung angelegt");
      setForm({ part_name: "", supplier_url: "", price: "", expected_arrival: "", notes: "" });
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Anlegen");
    } finally { setLoading(false); }
  };

  const patch = async (id, updates, msg) => {
    try {
      await api.patch(`/purchases/${id}`, updates);
      if (msg) toast.success(msg);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Aktualisieren");
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/purchases/${id}`);
      toast.success("Beschaffung gelöscht");
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Löschen");
    }
  };

  return (
    <div className="space-y-4" data-testid="purchases-tab">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <ShoppingCart size={16} className="text-accent" />
        <h2 className="font-head font-semibold text-sm tracking-tight">Externe Ersatzteil-Beschaffung & Tracking</h2>
      </div>

      {/* New procurement form */}
      <form onSubmit={create} className="border border-border rounded-lg p-4 bg-card/30 space-y-3">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Neue Beschaffung anlegen</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input data-testid="purchase-part-name" value={form.part_name} onChange={set("part_name")}
            placeholder="Teilebezeichnung (z.B. OLED Display iPhone 13)" className={inputCls} />
          <input data-testid="purchase-supplier-url" value={form.supplier_url} onChange={set("supplier_url")}
            placeholder="Externer Link / URL (Lieferant)" className={`${inputCls} font-mono text-xs`} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Voraussichtliche Ankunft</label>
            <input data-testid="purchase-expected" type="datetime-local" value={form.expected_arrival} onChange={set("expected_arrival")} className={`${inputCls} font-mono text-xs`} />
          </div>
          {!isTech && (
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">Preis (€)</label>
              <input data-testid="purchase-price" type="number" step="0.01" value={form.price} onChange={set("price")} placeholder="0.00" className={`${inputCls} font-mono`} />
            </div>
          )}
        </div>
        <input data-testid="purchase-notes" value={form.notes} onChange={set("notes")} placeholder="Notizen (optional)" className={inputCls} />
        <button type="submit" disabled={loading} data-testid="purchase-submit"
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs font-head font-semibold uppercase tracking-wider px-4 py-2.5 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50">
          <Plus size={14} /> Beschaffung anlegen
        </button>
      </form>

      {/* Procurement list */}
      {purchases.length === 0 ? (
        <div className="text-xs font-mono text-muted-foreground/70 py-6 text-center">
          Keine Beschaffungen für diesen Auftrag.
        </div>
      ) : (
        <div className="space-y-3" data-testid="purchases-list">
          {purchases.map((p) => (
            <div key={p.id} className="border border-border/70 rounded-lg p-3.5 bg-background/50 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground">{p.part_name}</span>
                    <StatusPill status={p.status} />
                    {p.supplier_url && (
                      <a href={p.supplier_url} target="_blank" rel="noreferrer" className="text-accent hover:underline flex items-center gap-1 text-xs">
                        <LinkIcon size={12} /> Link
                      </a>
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    Angelegt von {p.created_by || "—"}
                    {!isTech && p.price != null ? ` · Preis: ${Number(p.price || 0).toFixed(2)} €` : ""}
                  </div>
                  {p.notes && <div className="text-xs text-muted-foreground/80">Hinweis: {p.notes}</div>}
                </div>
                {canManage && (
                  <button data-testid={`purchase-delete-${p.id}`} onClick={() => remove(p.id)}
                    className="p-1.5 border border-border rounded hover:bg-red-950 text-red-400 shrink-0"><Trash size={13} /></button>
                )}
              </div>

              {/* timeline info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock size={12} /> Bestellt: {p.order_timestamp ? berlinDateTime(p.order_timestamp) : "—"}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarBlank size={12} /> Erwartet: {p.expected_arrival ? berlinDateTime(p.expected_arrival) : "—"}
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CheckCircle size={12} /> Angekommen: {p.actual_arrival ? berlinDateTime(p.actual_arrival) : "—"}
                </div>
              </div>

              {/* status controls */}
              <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-2.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1"><Truck size={12} /> Status:</span>
                <select
                  data-testid={`purchase-status-${p.id}`}
                  value={p.status}
                  onChange={(e) => patch(p.id, { status: e.target.value }, "Status aktualisiert")}
                  className="bg-background border border-border px-2 py-1 text-xs rounded outline-none focus:border-accent font-mono uppercase">
                  {PURCHASE_STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>{PURCHASE_STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <div className="flex-1" />
                <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Package size={12} /> Erwartet:
                  <input type="datetime-local"
                    defaultValue={p.expected_arrival ? p.expected_arrival.slice(0, 16) : ""}
                    onBlur={(e) => e.target.value && patch(p.id, { expected_arrival: e.target.value }, "Ankunft aktualisiert")}
                    className="bg-background border border-border px-2 py-1 text-xs rounded outline-none focus:border-accent font-mono" />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
