export function PageHeader({ label, title, children, rightAction }) {
  return (
    <div className="border-b border-border/60 bg-card/40 backdrop-blur-md px-6 md:px-8 py-4 shadow-xs">
      {/* الطابق العلوي: اسم الفرع ورقم الطلب يساراً | زر الرجوع يميناً */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
        <div className="flex flex-wrap items-center gap-3">
          {label && (
            <div className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-primary border border-primary/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] transition-all duration-300 hover:scale-105 hover:bg-primary/20 hover:shadow-[0_0_25px_rgba(59,130,246,0.3)] cursor-pointer">
              {label}
            </div>
          )}
          <h1 className="font-head font-bold text-xl md:text-2xl tracking-tight text-foreground">
            <span className="bg-gradient-to-r from-foreground via-foreground/90 to-primary/85 bg-clip-text text-transparent">
              {title}
            </span>
          </h1>
        </div>

        {/* زر الرجوع في أعلى اليمين بشكل ثابت ومنسق */}
        {rightAction && (
          <div className="flex items-center">
            {rightAction}
          </div>
        )}
      </div>

      {/* الطابق السفلي: أزرار وقوائم العمليات فقط */}
      {children && (
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/40">
          {children}
        </div>
      )}
    </div>
  );
}