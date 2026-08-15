import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { berlinDateTime } from "@/lib/datetime";
import { ListChecks } from "@phosphor-icons/react";

export default function Activity() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/activity", { params: { limit: 300 } }).then((r) => setItems(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader label={t("activity.subtitle")} title={t("activity.title")} />
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-8 font-mono text-muted-foreground">{t("common.loading")}</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center font-mono text-muted-foreground text-sm">{t("activity.empty")}</div>
        ) : (
          <table className="w-full text-sm" data-testid="activity-table">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="px-6 md:px-8 py-3 font-medium">{t("activity.colOrder")}</th>
                <th className="px-4 py-3 font-medium">{t("activity.colAction")}</th>
                <th className="px-4 py-3 font-medium">{t("activity.colDetail")}</th>
                <th className="px-4 py-3 font-medium">{t("activity.colBy")}</th>
                <th className="px-4 py-3 font-medium">{t("activity.colWhen")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.id} data-testid={`activity-row-${a.id}`}
                  onClick={() => a.order_id && navigate(`/auftrag/${a.order_id}`)}
                  className="border-b border-border/40 cursor-pointer hover:bg-muted transition-colors">
                  <td className="px-6 md:px-8 py-3 font-mono text-foreground whitespace-nowrap">{a.auftragsnummer}</td>
                  <td className="px-4 py-3"><span className="font-mono text-[10px] uppercase tracking-wider text-accent">{a.action}</span></td>
                  <td className="px-4 py-3 text-foreground/80">{a.detail}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{a.by}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{berlinDateTime(a.at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
