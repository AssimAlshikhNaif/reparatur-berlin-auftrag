export function PageHeader({ label, title, children }) {
  return (
    <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-border/60 bg-card/40 backdrop-blur-md px-6 md:px-8 py-5 shadow-xs transition-all">
      {/* قسم العناوين مع تأثير بصري خفيف */}
      <div className="space-y-1">
        {label && (
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-primary/10 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-primary border border-primary/20">
            {label}
          </div>
        )}
        <h1 className="font-head font-bold text-2xl md:text-3xl tracking-tight text-foreground flex items-center gap-3">
          {title}
        </h1>
      </div>

      {/* قسم الأزرار والعناصر الإضافية (Children) مع ترتيب تناسقي للأجهزة المختلفة */}
      {children && (
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          {children}
        </div>
      )}
    </div>
  );
}