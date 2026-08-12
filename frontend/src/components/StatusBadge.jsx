import { STATUS_LABELS, STATUS_STYLES } from "@/lib/constants";
import { Warning } from "@phosphor-icons/react";
import { useTranslation } from "react-i18next";

export function StatusBadge({ status }) {
  const { t } = useTranslation();
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={`inline-flex items-center px-2 py-0.5 text-xs font-mono uppercase tracking-wider border rounded-lg ${STATUS_STYLES[status] || "bg-muted text-foreground/80 border-border"}`}
    >
      {t(`status.${status}`, STATUS_LABELS[status] || status)}
    </span>
  );
}

export function SlaBadge({ days }) {
  return (
    <span
      data-testid="sla-badge"
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono uppercase tracking-wider border rounded-lg bg-red-950 text-red-300 border-red-600 sla-alert"
    >
      <Warning size={12} weight="fill" /> SLA {days}T
    </span>
  );
}
