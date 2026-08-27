import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import api, { formatApiErrorDetail } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { toast } from "sonner";
import { MagnifyingGlass, Warning, Plus, Trash, PlusCircle, Package, CurrencyEur, Handbag, Eye } from "@phosphor-icons/react";

const inputCls = "bg-background border border-border/80 px-3 py-2 text-sm rounded-lg outline-none focus:border-accent transition-colors";

function InventoryStatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-card border border-border/80 p-4 rounded-xl flex items-center justify-between shadow-sm">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="font-mono text-2xl font-bold text-foreground mt-1">{value}</div>
      </div>
      <div className={`p-2.5 rounded-lg bg-secondary/50 ${color}`}>
        <Icon size={20} />
      </div>
    </div>
  );
}

export default function Inventory() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const isAdmin = user?.role === "admin";
  const isTech = user?.role === "techniker";
  const isMitarbeiter = user?.role === "mitarbeiter";

  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    sku: "",
    part_type: "Display",
    brand: "Apple",
    device_model: "",
    price: "",
    quantity: "",
    min_stock: "3"
  });

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/inventory");
      setItems(data || []);
    } catch (err) {
      console.error("Lager-Ladefehler:", err);
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || t("inv.loadError"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = items.filter((i) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return i.sku?.toLowerCase().includes(s) || i.device_model?.toLowerCase().includes(s) || i.part_type?.toLowerCase().includes(s) || i.brand?.toLowerCase().includes(s);
  });

  const adjust = async (item, delta) => {
    if (isMitarbeiter) return;
    const currentQty = Number(item.quantity) || 0;
    const newQty = currentQty + delta;
    if (newQty < 0) return;

    try {
      const payload = {
        sku: String(item.sku || "").trim(),
        part_type: String(item.part_type || "Display"),
        brand: String(item.brand || "Apple"),
        device_model: String(item.device_model || "").trim(),
        price: Number(item.price) || 0,
        quantity: Number(newQty),
        min_stock: Number(item.min_stock || 3)
      };

      await api.patch(`/inventory/${item.id}`, payload);

      if (delta < 0) {
        toast.info(t("inv.used", { type: item.part_type, model: item.device_model }));
      } else {
        toast.success(t("inv.stockUpdated"));
      }
      load();
    } catch (err) {
      console.error("Fehler Details:", err.response || err);
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || t("inv.updateError"));
    }
  };

  const remove = async (item) => {
    if (!isAdmin) return;
    try {
      await api.delete(`/inventory/${item.id}`);
      toast.success(t("inv.deleted"));
      load();
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || t("inv.deleteError"));
    }
  };

  const add = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    try {
      const payload = {
        sku: String(form.sku || "").trim(),
        part_type: String(form.part_type || "Display"),
        brand: String(form.brand || "Apple"),
        device_model: String(form.device_model || "").trim(),
        price: parseFloat(form.price) || 0,
        quantity: parseInt(form.quantity, 10) || 0,
        min_stock: parseInt(form.min_stock, 10) || 3,
        branch_id: user?.branch_id || null
      };

      await api.post("/inventory", payload);
      toast.success(t("inv.created"));
      setShowAdd(false);
      setForm({ sku: "", part_type: "Display", brand: "Apple", device_model: "", price: "", quantity: "", min_stock: "3" });
      load();
    } catch (err) {
      console.error("Add Fehler Details:", err.response || err);
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || t("inv.createError"));
    }
  };

  const lowCount = items.filter((i) => i.quantity <= (i.min_stock || 3) || i.low_stock).length;
  const totalStock = items.reduce((acc, i) => acc + (Number(i.quantity) || 0), 0);
  const totalValue = items.reduce((acc, i) => acc + ((Number(i.quantity) || 0) * Number(i.price || 0)), 0);

  return (
    <div className="space-y-6 pb-12">
      <PageHeader label={t("inv.label")} title={t("inv.title")}>
        {isAdmin && (
          <button data-testid="add-inventory-button" onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground text-xs font-head font-semibold uppercase tracking-wider px-4 py-2.5 rounded-lg hover:bg-blue-600 transition-colors shadow-sm">
            <PlusCircle size={18} weight="bold" /> {t("inv.addButton")}
          </button>
        )}
      </PageHeader>

      <div className="px-6 md:px-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <InventoryStatCard label={t("inv.statTotal")} value={items.length} icon={Package} color="text-accent" />
        <InventoryStatCard label={t("inv.statStock")} value={totalStock} icon={Package} color="text-blue-400" />
        <InventoryStatCard label={t("inv.statValue")} value={`${totalValue.toFixed(2)} €`} icon={CurrencyEur} color="text-emerald-400" />
      </div>

      <div className="px-6 md:px-8">
        <div className="bg-card border border-border/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="relative flex-1 max-w-md">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input data-testid="inventory-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("inv.searchPlaceholder")}
              className={`${inputCls} w-full pl-9 font-mono`} />
          </div>

          <div className="flex items-center gap-3">
            {lowCount > 0 && (
              <span className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-amber-400 border border-amber-500/30 bg-amber-500/10 px-3 py-2 rounded-lg animate-pulse">
                <Warning size={15} weight="fill" /> {t("inv.reorderAlert", { n: lowCount })}
              </span>
            )}
            {isMitarbeiter && (
              <span className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground border border-border/60 bg-secondary/30 px-3 py-2 rounded-lg">
                <Eye size={15} /> {t("inv.readOnly")}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-6 md:px-8">
        <div className="border border-border/80 rounded-xl bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/20">
                  <th className="px-6 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 font-medium">{t("inv.colModel")}</th>
                  <th className="px-4 py-3 font-medium">{t("inv.colType")}</th>
                  <th className="px-4 py-3 font-medium text-right">{t("inv.colPrice")}</th>
                  <th className="px-4 py-3 font-medium text-center">{t("inv.colStock")}</th>
                  <th className="px-4 py-3 font-medium text-center">{t("inv.colMin")}</th>
                  <th className="px-6 py-3 font-medium text-right">{t("inv.colAction")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 font-mono text-xs text-muted-foreground">{t("inv.loading")}</td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-8 font-mono text-xs text-muted-foreground">{t("inv.empty")}</td>
                  </tr>
                ) : (
                  filtered.map((i) => {
                    const isLow = i.quantity <= (i.min_stock || 3);
                    return (
                      <tr key={i.id} data-testid={`inventory-row-${i.sku}`}
                        className={`hover:bg-muted/30 transition-colors ${isLow ? "bg-amber-500/5" : ""}`}>
                        <td className="px-6 py-3.5 font-mono text-foreground font-semibold whitespace-nowrap">{i.sku}</td>
                        <td className="px-4 py-3.5 text-foreground whitespace-nowrap font-medium">{i.brand} {i.device_model}</td>
                        <td className="px-4 py-3.5 text-muted-foreground">{i.part_type}</td>
                        <td className="px-4 py-3.5 text-right font-mono text-foreground">{Number(i.price).toFixed(2)} €</td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className={`font-mono font-bold ${isLow ? "text-amber-400" : "text-foreground"}`}>{i.quantity}</span>
                            {isLow && <Warning size={14} weight="fill" className="text-amber-400" />}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center font-mono text-muted-foreground">{i.min_stock || 3}</td>

                        <td className="px-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {(isTech || isAdmin) && (
                              <button
                                title={t("inv.consumeTitle")}
                                onClick={() => adjust(i, -1)}
                                disabled={i.quantity <= 0}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono border border-border/80 bg-secondary/40 rounded-md hover:bg-secondary text-foreground disabled:opacity-30 transition-colors"
                              >
                                <Handbag size={13} />
                                <span>{t("inv.consume")}</span>
                              </button>
                            )}

                            {isAdmin && (
                              <button data-testid={`inc-${i.sku}`} onClick={() => adjust(i, 1)} className="p-1.5 border border-border/80 rounded-md hover:bg-muted text-foreground transition-colors">
                                <Plus size={13} />
                              </button>
                            )}

                            {isAdmin && (
                              <button data-testid={`del-${i.sku}`} onClick={() => remove(i)} className="p-1.5 border border-red-900/40 bg-red-950/20 rounded-md hover:bg-red-950/50 text-red-400 transition-colors">
                                <Trash size={13} />
                              </button>
                            )}

                            {isMitarbeiter && (
                              <span className="text-[11px] font-mono text-muted-foreground italic">{t("inv.viewOnly")}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAdd && isAdmin && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={add} className="bg-card border border-border rounded-xl max-w-lg w-full p-6 space-y-5 shadow-xl">
            <h3 className="font-head font-semibold text-lg">{t("inv.addTitle")}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <input data-testid="inv-sku" required placeholder={t("inv.phSku")} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className={`${inputCls} font-mono`} />
              <input required placeholder={t("inv.phModel")} value={form.device_model} onChange={(e) => setForm({ ...form, device_model: e.target.value })} className={inputCls} />
              <select value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className={inputCls}>
                {["Apple", "Samsung", "Google", "Xiaomi", "Sonstige"].map((b) => <option key={b}>{b}</option>)}
              </select>
              <select value={form.part_type} onChange={(e) => setForm({ ...form, part_type: e.target.value })} className={inputCls}>
                {["Display", "Akku", "Ladebuchse", "Rückseite / Backcover", "Kamera", "Lautsprecher"].map((p) => <option key={p}>{p}</option>)}
              </select>
              <input required type="number" step="0.01" placeholder={t("inv.phPrice")} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputCls} />
              <input required type="number" placeholder={t("inv.phStock")} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className={inputCls} />
              <input required type="number" placeholder={t("inv.phMin")} value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} className={`${inputCls} col-span-2`} />
            </div>
            <div className="flex gap-3 pt-2">
              <button data-testid="inv-save" type="submit" className="flex-1 bg-primary text-primary-foreground font-head font-semibold text-xs uppercase tracking-wider py-2.5 rounded-lg hover:bg-blue-600 transition-colors">{t("inv.save")}</button>
              <button type="button" onClick={() => setShowAdd(false)} className="px-6 border border-border rounded-lg text-xs font-mono uppercase tracking-wider text-muted-foreground hover:bg-muted transition-colors">{t("inv.cancel")}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
