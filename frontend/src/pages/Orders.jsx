import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge, SlaBadge } from "@/components/StatusBadge";
import ContractPrint from "@/components/ContractPrint";
import { STATUS_LABELS } from "@/lib/constants";
import { MagnifyingGlass, PlusCircle, Funnel, Warning, ShieldCheck, ArrowsClockwise, Printer, X } from "@phosphor-icons/react";

export default function Orders() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const branchId = searchParams.get("branch_id") || "";
  const branchName = searchParams.get("branch_name") || "";
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [printOrder, setPrintOrder] = useState(null);
  
  // حالة لتخزين أعداد الطلبات لكل تبويب لعرضها بشكل دقيق
 const [statusCounts, setStatusCounts] = useState({
    all: 0,
    ANGENOMMEN: 0,
    DIAGNOSE: 0,
    IN_BEARBEITUNG: 0,
    FERTIG: 0,
    ABGEHOLT: 0,
    REKLAMATION: 0,
    STORNIERT: 0
  });

  const canManage = user.role === "admin" || user.role === "mitarbeiter";

  const load = async () => {
    try {
      setLoading(true);

      if (statusFilter === "REKLAMATION") {
        try {
          const { data } = await api.get("/reklamationen");
          const filteredData = Array.isArray(data) 
            ? data.filter((o) => (!branchId || o.branch_id === branchId) && o.status !== "ABGEHOLT") 
            : [];
          setOrders(filteredData);
        } catch (err) {
          console.error("Reklamationen load error:", err);
          setOrders([]);
        }
      } else {
        const params = {};
        if (statusFilter) params.status = statusFilter;
        if (branchId) params.branch_id = branchId;
        
        if (!statusFilter) {
          params.limit = 10000;
        }

        const { data } = await api.get("/orders", { params });
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Orders load error:", err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCounts = async () => {
    try {
      const params = {};
      if (branchId) params.branch_id = branchId;
      params.limit = 10000;

      const [ordersRes, rekRes] = await Promise.all([
        api.get("/orders", { params }),
        api.get("/reklamationen").catch(() => ({ data: [] }))
      ]);

      const rawData = ordersRes.data;
      const allOrders = Array.isArray(rawData) 
        ? rawData 
        : (Array.isArray(rawData?.orders) ? rawData.orders : (Array.isArray(rawData?.items) ? rawData.items : []));
        
      const allRek = Array.isArray(rekRes.data) ? (branchId ? rekRes.data.filter(o => o.branch_id === branchId) : rekRes.data) : [];

      // شروط شاملة لكل مسميات حالة التشخيص / الواردة
      const diagnoseCount = allOrders.filter(o => {
        const status = String(o.status || "").trim().toUpperCase();
        return status === "DIAGNOSE" || status === "ANGENOMMEN" || status === "AKZEPTIERT" || status === "WARTEN FREIGABE" || status === "NACH DIAGNOSE / FREIGABE";
      }).length;
      
      const inBearbeitungCount = allOrders.filter(o => {
        const status = String(o.status || "").trim().toUpperCase();
        return status === "IN_BEARBEITUNG" || status === "WARTEN ERSATZTEIL" || status === "ZUGEWIESEN";
      }).length;
      
      const fertigCount = allOrders.filter(o => String(o.status || "").trim().toUpperCase() === "FERTIG").length;
      const abgeholtCount = allOrders.filter(o => String(o.status || "").trim().toUpperCase() === "ABGEHOLT").length;
      
      const activeRek = allRek.filter(o => String(o.status || "").trim().toUpperCase() !== "ABGEHOLT");
      const reklamationCount = activeRek.length;
      
      const storniertCount = allOrders.filter(o => {
        const status = String(o.status || "").trim().toUpperCase();
        return status === "STORNIERT" || status === "ABGELEHNT";
      }).length;

      const allActiveCount = diagnoseCount + inBearbeitungCount + fertigCount + reklamationCount + storniertCount;

      setStatusCounts({
        all: allActiveCount,
        ANGENOMMEN: diagnoseCount,
        DIAGNOSE: diagnoseCount,
        IN_BEARBEITUNG: inBearbeitungCount,
        FERTIG: fertigCount,
        ABGEHOLT: abgeholtCount,
        REKLAMATION: reklamationCount,
        STORNIERT: storniertCount
      });
    } catch (err) {
      console.error("Error fetching status counts:", err);
    }
  };
    // دالة لتصفير الرسائل غير المقروءة عند فتح الطلب
  const handleOrderClick = async (order) => {
    const orderId = order.id || order._id;
    
    // إذا كان هناك رسائل غير مقروءة، قم بإرسال طلب للباك إند لتصفيرها
    if (order.unread_messages_count > 0) {
      try {
        await api.post(`/orders/${orderId}/mark-read`);
        
        // تحديث القائمة محلياً لتختفي الشارة الحمراء فوراً
        setOrders((prevOrders) =>
          prevOrders.map((item) =>
            (item.id === orderId || item._id === orderId)
              ? { ...item, unread_messages_count: 0 }
              : item
          )
        );
      } catch (err) {
        console.error("Error marking messages as read:", err);
      }
    }

    // الانتقال إلى صفحة تفاصيل الطلب بشكل طبيعي
    navigate(`/auftrag/${orderId}`);
  };

  useEffect(() => { 
    load(); 
    fetchCounts();
    /* eslint-disable-next-line */ 
  }, [statusFilter, branchId]);

  const clearBranchFilter = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("branch_id");
    next.delete("branch_name");
    setSearchParams(next);
  };

  const filtered = orders.filter((o) => {
    if (!statusFilter && o.status === "ABGEHOLT") {
      return false;
    }

    if (!q) return true;
    const s = q.toLowerCase();
    return (
      o.auftragsnummer.toLowerCase().includes(s) ||
      o.device_model?.toLowerCase().includes(s) ||
      o.device_brand?.toLowerCase().includes(s) ||
      (o.customer_name || "").toLowerCase().includes(s)
    );
  });
  
  return (
    <div>
      <PageHeader label={t("orders.label")} title={t("orders.title")}>
      {canManage && (
        <button
          data-testid="header-new-order"
          onClick={() => navigate("/auftrag/neu")}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-xs font-head font-semibold uppercase tracking-wider px-4 py-2.5 rounded-lg hover:bg-blue-600 hover:text-primary-foreground transition-colors"
        >
          <PlusCircle size={16} weight="bold" /> {t("orders.newOrder")}
        </button>
      )}
    </PageHeader>

    {branchId && (
      <div className="px-6 md:px-8 pt-4">
        <div data-testid="branch-filter-badge" className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 text-primary text-xs font-mono px-3 py-1.5 rounded-lg">
          <span>{t("orders.filteredByBranch", "Filiale")}: {branchName || branchId}</span>
          <button data-testid="branch-filter-clear" onClick={clearBranchFilter} className="hover:opacity-70">
            <X size={13} weight="bold" />
          </button>
        </div>
      </div>
    )}

    {/* Quick filter tabs with Counts */}
    <div className="flex flex-wrap items-center gap-2 px-6 md:px-8 pt-4">
      {[
        { key: "", label: "Alle", countKey: "all" },
        { key: "ANGENOMMEN", label: "Diagnose", countKey: "ANGENOMMEN" },
        { key: "IN_BEARBEITUNG", label: "In Bearbeitung", countKey: "IN_BEARBEITUNG" },
        { key: "FERTIG", label: "Fertig", countKey: "FERTIG" },
        { key: "ABGEHOLT", label: "Abgeholt", countKey: "ABGEHOLT" },
        { key: "REKLAMATION", label: "Reklamation", countKey: "REKLAMATION" },
        { key: "STORNIERT", label: "Storniert", countKey: "STORNIERT" },
      ].map((tab) => {
        const count = statusCounts[tab.countKey] || 0;
        return (
          <button
            key={tab.key || "all"}
            data-testid={`filter-tab-${tab.key ? tab.key.toLowerCase() : "all"}`}
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 text-xs font-head font-semibold uppercase tracking-wider rounded-full border transition-colors flex items-center gap-1.5 ${
              statusFilter === tab.key
                ? (tab.key === "REKLAMATION" ? "border-amber-500 bg-amber-950/40 text-amber-200" : tab.key === "STORNIERT" ? "border-red-500 bg-red-950/60 text-red-200" : "border-accent bg-accent/10 text-foreground")
                : (tab.key === "REKLAMATION" ? "border-amber-700/60 text-amber-300 hover:text-amber-200" : tab.key === "STORNIERT" ? "border-red-700/60 text-red-400 hover:text-red-200" : "border-border text-muted-foreground hover:text-foreground")
            }`}
          >
            <span>{tab.key === "REKLAMATION" ? t("reklamation.badgeReclamation") : tab.key === "STORNIERT" ? "Storniert" : (tab.key === "" ? t("orders.all") : t(`status.${tab.key}`, tab.label))}</span>
            <span className={`px-1.5 py-0.5 text-[10px] rounded-full font-mono ${statusFilter === tab.key ? "bg-accent/20 text-foreground" : "bg-muted text-muted-foreground"}`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>

    {/* Toolbar */}
    <div className="flex flex-col sm:flex-row gap-3 px-6 md:px-8 py-4 border-b border-border/60">
      <div className="relative flex-1 max-w-md">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          data-testid="orders-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("orders.searchPlaceholder")}
          className="w-full bg-background border border-border pl-9 pr-3 py-2 text-sm rounded-lg outline-none focus:border-accent transition-colors font-mono"
        />
      </div>
      <div className="relative">
        <Funnel size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <select
          data-testid="orders-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-background border border-border pl-9 pr-8 py-2 text-sm rounded-lg outline-none focus:border-accent font-mono appearance-none"
        >
          <option value="">{t("orders.allStatus")}</option>
          {Object.keys(STATUS_LABELS).map((k) => (
            <option key={k} value={k}>{t(`status.${k}`, STATUS_LABELS[k])}</option>
          ))}
          <option value="REKLAMATION">{t("reklamation.badgeReclamation")}</option>
          <option value="STORNIERT">Storniert</option>
        </select>
      </div>
    </div>

    {/* Table */}
    <div className="max-h-[75vh] overflow-y-auto overflow-x-auto border-t border-b border-border/60">
      {loading ? (
        <div className="p-8 font-mono text-muted-foreground">{t("orders.loading")}</div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center font-mono text-muted-foreground text-sm">{t("orders.empty")}</div>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-background/95 backdrop-blur-sm z-30">
            <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <th className="px-6 md:px-8 py-3 font-medium">{t("orders.colNumber")}</th>
              <th className="px-4 py-3 font-medium">{t("orders.colDevice")}</th>
              <th className="px-4 py-3 font-medium">{t("orders.colBranch")}</th>
              {user.role !== "techniker" && <th className="px-4 py-3 font-medium">{t("orders.colCustomer")}</th>}
              {user.role !== "techniker" && <th className="px-4 py-3 font-medium">{t("orders.colStaff")}</th>}
              <th className="px-4 py-3 font-medium">{t("orders.colTech")}</th>
              <th className="px-4 py-3 font-medium">{t("orders.colStatus")}</th>
              <th className="px-4 py-3 font-medium">{t("orders.colCreated")}</th>
              <th className="px-4 py-3 font-medium text-right sticky right-0 bg-background/95 backdrop-blur-sm z-20 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.2)]">
                {t("orders.colAction")}
              </th>
            </tr>
          </thead>
          {/* Table Body */}
<tbody>
  {filtered.map((o) => {
    // تحديد لون خلفية الصف لكل حالة بشكل احترافي ومتوافق مع الوضعين
    const getRowBgClass = (status) => {
      switch (String(status || "").toUpperCase()) {
        case "DIAGNOSE":
        case "ANGENOMMEN":
        case "WARTEN_FREIGABE":
        case "NACH DIAGNOSE / FREIGABE":
          return "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20";
        case "IN_BEARBEITUNG":
        case "WARTEN_ERSATZTEIL":
        case "ZUGEWIESEN":
          return "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20";
        case "FERTIG":
          return "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20";
        case "ABGEHOLT":
          return "bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/20";
        case "STORNIERT":
        case "ABGELEHNT":
          return "bg-red-500/10 hover:bg-red-500/20 border-red-500/30";
        default:
          return "hover:bg-muted/60";
      }
    };

    return (
      <tr
        key={o.id}
        data-testid={`order-row-${o.auftragsnummer}`}
        onClick={() => handleOrderClick(o)}
        className={`border-b border-border/40 cursor-pointer transition-all group ${getRowBgClass(o.status)}`}
      >
        <td className="px-6 md:px-8 py-3 font-mono text-foreground whitespace-nowrap">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-base">{o.auftragsnummer}</span>
            
            {/* عرض خانة إعلام الزبون وتاريخ الاستلام مباشرة بجانب رقم الطلب في حالة FERTIG */}
            {String(o.status || "").toUpperCase() === "FERTIG" && (
              <div className="flex items-center gap-1.5 ml-2 bg-background/90 border border-border px-2.5 py-1 rounded-md shadow-xs" onClick={(e) => e.stopPropagation()}>
                <label className="inline-flex items-center gap-1.5 text-[11px] font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(o.customer_notified)}
                    onChange={async (e) => {
                      const isChecked = e.target.checked;
                      try {
                        await api.patch(`/orders/${o.id}`, { customer_notified: isChecked });
                        o.customer_notified = isChecked;
                        toast.success("Kundenstatus aktualisiert");
                      } catch (err) {
                        toast.error("Fehler beim Aktualisieren");
                      }
                    }}
                    className="w-4 h-4 rounded border-border accent-emerald-500 cursor-pointer"
                  />
                  <span className={o.customer_notified ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                    {o.customer_notified ? "Benachrichtigt" : "Nicht benachrichtigt"}
                  </span>
                </label>

                <span className="text-border">|</span>

                <span className="text-xs font-mono font-bold text-foreground">
                  Abhol.: {o.pickup_date ? o.pickup_date.split("T")[0] : "Kein Datum"}
                </span>
              </div>
            )}
            
            {/* مؤشر الاستلام الذكي (Heute / Morgen ⚠️) */}
            {String(o.status || "").toUpperCase() === "FERTIG" && o.pickup_date && (
              (() => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const pickupDate = new Date(o.pickup_date);
                pickupDate.setHours(0, 0, 0, 0);
                const diffDays = Math.round((pickupDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                if (diffDays === 0) {
                  return <span className="px-2 py-0.5 text-[11px] bg-emerald-600 text-white border border-emerald-400 rounded-md font-bold shadow-sm" title="Abholung heute!">Heute</span>;
                } else if (diffDays === 1) {
                  return <span className="px-2 py-0.5 text-[11px] bg-amber-600 text-white border border-amber-400 rounded-md font-bold animate-pulse shadow-sm" title="Abholung morgen!">Morgen ⚠️</span>;
                }
                return null;
              })()
            )}

            {/* مؤشر رسائل الدردشة */}
            {o.unread_messages_count > 0 && (
              <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-full animate-pulse shadow-md">
                💬 {o.unread_messages_count}
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-foreground/90 whitespace-nowrap font-medium">{o.device_brand} {o.device_model}</td>
        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{o.branch_name}</td>
        {user.role !== "techniker" && <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{o.customer_name}</td>}
        {user.role !== "techniker" && <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{o.created_by_name || "—"}</td>}
        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{o.assigned_techniker_name || <span className="text-muted-foreground/70">—</span>}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Badge مع ألوان احترافية ومميزة */}
            {(() => {
              const status = String(o.status || "").toUpperCase();
              switch (status) {
                case "DIAGNOSE":
                case "ANGENOMMEN":
                  return <span className="px-2.5 py-1 text-xs font-mono font-bold uppercase rounded bg-blue-500/20 text-blue-400 border border-blue-500/40">Diagnose</span>;
                case "IN_BEARBEITUNG":
                  return <span className="px-2.5 py-1 text-xs font-mono font-bold uppercase rounded bg-amber-500/20 text-amber-400 border border-amber-500/40">In Bearbeitung</span>;
                case "FERTIG":
                  return <span className="px-2.5 py-1 text-xs font-mono font-bold uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">Fertig</span>;
                case "ABGEHOLT":
                  return <span className="px-2.5 py-1 text-xs font-mono font-bold uppercase rounded bg-purple-500/20 text-purple-400 border border-purple-500/40">Abgeholt</span>;
                case "REKLAMATION":
                  return <span className="px-2.5 py-1 text-xs font-mono font-bold uppercase rounded bg-orange-500/20 text-orange-400 border border-orange-500/40">Reklamation</span>;
                case "STORNIERT":
                case "ABGELEHNT":
                  return <span className="px-2.5 py-1 text-xs font-mono font-bold uppercase rounded bg-red-500/20 text-red-400 border border-red-500/40">Storniert</span>;
                default:
                  return <span className="px-2.5 py-1 text-xs font-mono font-bold uppercase rounded bg-muted text-muted-foreground border border-border">{o.status}</span>;
              }
            })()}
          </div>
        </td>
        <td className="px-4 py-3 text-muted-foreground font-mono text-xs whitespace-nowrap">
          {o.created_at ? o.created_at.split("T")[0] : "—"}
        </td>
        <td className="px-4 py-3 text-right sticky right-0 bg-background/95 backdrop-blur-sm z-20 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.2)]">
          {/* أزرار الإجراءات الخاصة بالصف */}
        </td>
      </tr>
    );
  })}
</tbody>
        </table>
      )}
    </div>
    {printOrder && <ContractPrint order={printOrder} branchName={printOrder.branch_name} onClose={() => setPrintOrder(null)} />}
  </div>
);
}