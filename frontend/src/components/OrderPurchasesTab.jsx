import React, { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { ShoppingCart, Plus, Check, Trash, Link as LinkIcon, CurrencyDollar, Clock } from "@phosphor-icons/react";

export default function OrderPurchasesTab({ orderId }) {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [itemName, setItemName] = useState("");
  const [supplierUrl, setSupplierUrl] = useState("");
  const [notes, setNotes] = useState("");

  // حالات خاصة بمعالجة الطلب من قبل الأدمن/الموظف
  const [processingId, setProcessingId] = useState(null);
  const [processForm, setProcessForm] = useState({ price: "", estimated_days: "", status: "BESTELLT" });

  const loadPurchases = useCallback(async () => {
    try {
      const { data } = await api.get(`/purchases/order/${orderId}`);
      setPurchases(data);
    } catch (e) {
      // تجاهل الخطأ في حال عدم وجود بيانات
    }
  }, [orderId]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  const handleRequestPart = async (e) => {
    e.preventDefault();
    if (!itemName.trim() && !supplierUrl.trim()) {
      toast.error("Bitte Artikelname oder Link angeben");
      return;
    }

    setLoading(true);
    try {
      await api.post(`/purchases/request`, {
        order_id: orderId,
        item_name: itemName,
        supplier_url: supplierUrl,
        notes: notes,
      });
      toast.success("Ersatzteil-Anfrage erfolgreich gesendet");
      setItemName("");
      setSupplierUrl("");
      setNotes("");
      loadPurchases();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Senden der Anfrage");
    } finally {
      setLoading(false);
    }
  };

  const handleProcessSubmit = async (purchaseId) => {
    try {
      await api.patch(`/purchases/${purchaseId}/process`, {
        price: parseFloat(processForm.price) || 0,
        estimated_days: parseInt(processForm.estimated_days) || 0,
        status: processForm.status,
      });
      toast.success("Bestellung erfolgreich aktualisiert");
      setProcessingId(null);
      setProcessForm({ price: "", estimated_days: "", status: "BESTELLT" });
      loadPurchases();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Fehler beim Aktualisieren");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <ShoppingCart size={16} className="text-accent" />
        <h2 className="font-head font-semibold text-sm tracking-tight">Ersatzteil-Beschaffung & Anfragen</h2>
      </div>

      {/* قائمة الطلبات الحالية */}
      {purchases.length === 0 ? (
        <div className="text-xs font-mono text-muted-foreground/70 py-3 text-center">
          Keine Beschaffungsanfragen für diesen Auftrag.
        </div>
      ) : (
        <div className="space-y-3">
          {purchases.map((p) => (
            <div key={p._id} className="border border-border/60 px-3 py-2.5 bg-background/50 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="text-sm text-foreground flex items-center gap-2">
                    <span className="font-medium">{p.item_name}</span>
                    {p.supplier_url && (
                      <a href={p.supplier_url} target="_blank" rel="noreferrer" className="text-accent hover:underline flex items-center gap-1 text-xs">
                        <LinkIcon size={12} /> Link
                      </a>
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    Angefragt von: {p.requested_by_name} ({p.requested_by_role}) · Preis: {Number(p.price || 0).toFixed(2)} € · Status: <span className="uppercase text-accent font-semibold">{p.status}</span>
                  </div>
                  {p.notes && <div className="text-xs text-muted-foreground/80">Hinweis: {p.notes}</div>}
                </div>

                {/* زر فتح نافذة المعالجة للأدمن/الموظف */}
                <button
                  onClick={() => {
                    setProcessingId(p._id);
                    setProcessForm({ price: p.price || "", estimated_days: p.estimated_days || "", status: p.status || "BESTELLT" });
                  }}
                  className="text-xs font-mono uppercase tracking-wider border border-border px-3 py-1.5 hover:bg-muted transition-colors"
                >
                  Bearbeiten
                </button>
              </div>

              {/* نموذج المعالجة السريع عند الضغط على تعديل */}
              {processingId === p._id && (
                <div className="border-t border-border/60 pt-3 mt-2 space-y-2 bg-card/40 p-3 rounded">
                  <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Bestellung freigeben / aktualisieren</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-mono text-muted-foreground mb-1">Preis (€)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={processForm.price}
                        onChange={(e) => setProcessForm({ ...processForm, price: e.target.value })}
                        className="w-full bg-background border border-border px-2 py-1 text-xs rounded outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-muted-foreground mb-1">Tage (Lieferung)</label>
                      <input
                        type="number"
                        value={processForm.estimated_days}
                        onChange={(e) => setProcessForm({ ...processForm, estimated_days: e.target.value })}
                        className="w-full bg-background border border-border px-2 py-1 text-xs rounded outline-none font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-muted-foreground mb-1">Status</label>
                      <select
                        value={processForm.status}
                        onChange={(e) => setProcessForm({ ...processForm, status: e.target.value })}
                        className="w-full bg-background border border-border px-2 py-1 text-xs rounded outline-none font-mono uppercase"
                      >
                        <option value="ANGEFRAGT">Angefragt</option>
                        <option value="BESTELLT">Bestellt</option>
                        <option value="GELIEFERT">Geliefert</option>
                        <option value="STORNIERT">Storniert</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setProcessingId(null)}
                      className="px-3 py-1 text-xs border border-border text-muted-foreground hover:bg-muted"
                    >
                      Abbrechen
                    </button>
                    <button
                      onClick={() => handleProcessSubmit(p._id)}
                      className="px-3 py-1 text-xs bg-primary text-primary-foreground font-semibold uppercase tracking-wider hover:bg-blue-600"
                    >
                      Speichern
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* نموذج طلب قطعة جديدة للفنيين */}
      <form onSubmit={handleRequestPart} className="border-t border-border pt-3 space-y-3">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Neue Ersatzteil-Anfrage senden</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Artikelname (z.B. OLED Display iPhone 13)"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="bg-background border border-border px-3 py-2 text-sm rounded-lg outline-none focus:border-accent"
          />
          <input
            type="text"
            placeholder="Supplier URL (Link)"
            value={supplierUrl}
            onChange={(e) => setSupplierUrl(e.target.value)}
            className="bg-background border border-border px-3 py-2 text-sm rounded-lg outline-none focus:border-accent font-mono text-xs"
          />
        </div>
        <input
          type="text"
          placeholder="Notizen (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-background border border-border px-3 py-2 text-sm rounded-lg outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-xs font-head font-semibold uppercase tracking-wider px-4 py-2 hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          <Plus size={14} /> Anfrage absenden
        </button>
      </form>
    </div>
  );
}