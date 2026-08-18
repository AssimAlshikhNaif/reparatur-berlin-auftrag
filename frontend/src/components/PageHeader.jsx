export function PageHeader({ label, title, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-border px-6 md:px-8 py-6">
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-1">{label}</div>
        <h1 className="font-head font-bold text-2xl md:text-3xl tracking-tight text-foreground">{title}</h1>
      </div>
      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}
