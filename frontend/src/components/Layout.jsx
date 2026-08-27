import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/context/ThemeContext";
import { ROLE_LABELS } from "@/lib/constants";
import NotificationBell from "@/components/NotificationBell";
import GlobalSearch from "@/components/GlobalSearch";
import BranchDropdown from "@/components/BranchDropdown";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import {
  Gauge, Wrench, Package, Users, QrCode, PlusCircle,
  SignOut, List, X, Wall, ChartBar, ShoppingCart, ListChecks,
} from "@phosphor-icons/react";

const NAV = [
  { to: "/", key: "dashboard", icon: Gauge, roles: ["admin", "mitarbeiter", "techniker"], end: true },
  { to: "/auftraege", key: "orders", icon: Wrench, roles: ["admin", "mitarbeiter", "techniker"] },
  { to: "/auftrag/neu", key: "newOrder", icon: PlusCircle, roles: ["admin", "mitarbeiter"] },
  { to: "/scannen", key: "scan", icon: QrCode, roles: ["admin", "mitarbeiter", "techniker"] },
  { to: "/ersatzteile", key: "parts", icon: Package, roles: ["admin", "mitarbeiter", "techniker"] },
  { to: "/beschaffung", key: "procurement", icon: ShoppingCart, roles: ["admin", "mitarbeiter"] },
  { to: "/analyse", key: "analytics", icon: ChartBar, roles: ["admin"] },
  { to: "/aktivitaet", key: "activity", icon: ListChecks, roles: ["admin"] },
  { to: "/benutzer", key: "users", icon: Users, roles: ["admin"] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const items = NAV.filter((n) => n.roles.includes(user.role));

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const SidebarInner = () => (
    <>
      <div className="px-5 py-6 border-b border-border">
        <div className="flex items-center gap-2">
          <Wall size={26} weight="duotone" className="text-accent" />
          <div>
            <div className="font-head font-bold text-sm tracking-tight leading-none">REPARATUR</div>
            <div className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground mt-1">{t("brand.tagline")}</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 py-3 overflow-y-auto">
        {items.map((n) => {
          const Icon = n.icon;
          return (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              data-testid={`nav-${n.to.replace(/\//g, "") || "home"}`}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-3 text-sm border-l-2 transition-colors ${
                  isActive
                    ? "border-accent bg-card text-foreground"
                    : "border-transparent text-muted-foreground hover:text-primary-foreground hover:bg-muted/60"
                }`
              }
            >
              <Icon size={18} weight="regular" />
              <span>{t(`nav.${n.key}`)}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-border p-4">
        <div className="mb-3">
          <div className="text-sm font-medium text-foreground truncate" data-testid="current-user-name">{user.name}</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-accent mt-0.5">
            {t(`roles.${user.role}`, ROLE_LABELS[user.role])}
          </div>
        </div>
        <button
          data-testid="logout-button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider border border-border text-foreground/80 hover:bg-muted hover:text-primary-foreground transition-colors rounded-lg cursor-pointer"
        >
          <SignOut size={14} /> {t("common.logout")}
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background grid-texture flex w-full max-w-full overflow-x-hidden relative">
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-60 shrink-0 border-r border-border bg-background/70 backdrop-blur-sm sticky top-0 h-screen z-30">
        <div className="h-full flex flex-col">
          <SidebarInner />
        </div>
      </aside>

      {/* Mobile top bar (شريط الموبايل العلوي مع زر القائمة الثلاثية الذي كان مفقوداً) */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-3 h-14 border-b border-border bg-background/95 backdrop-blur-xl w-full max-w-full box-border">
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <Wall size={22} weight="duotone" className="text-accent shrink-0" />
          <span className="font-head font-bold text-xs truncate">REPARATUR BERLIN</span>
        </div>
        <button data-testid="mobile-menu-toggle" onClick={() => setOpen(!open)} className="text-foreground p-1 shrink-0 cursor-pointer">
          {open ? <X size={22} /> : <List size={22} />}
        </button>
      </div>

      {/* Mobile menu dropdown */}
      {open && (
        <div className="md:hidden fixed inset-0 z-30 pt-14 bg-background/95 flex flex-col w-full max-w-full overflow-y-auto overflow-x-hidden">
          <SidebarInner />
        </div>
      )}

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0 overflow-x-hidden w-full max-w-full">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 py-2.5 px-3 sm:px-6 border-b border-border sticky top-0 bg-background/95 backdrop-blur-md z-30 w-full max-w-full box-border">
          
          {/* قسم الفروع والبحث */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            {user.role === "admin" && <div className="shrink-0"><BranchDropdown /></div>}
            <div className="flex-1 md:w-80">
              <GlobalSearch compact={true} />
            </div>
          </div>
          
          {/* قسم الإشعارات، اللغة، والوضع الليلي */}
          <div className="flex items-center justify-end gap-2 shrink-0 pt-1 md:pt-0 border-t md:border-t-0 border-border/40">
            {(user.role === "admin" || user.role === "mitarbeiter" || user.role === "techniker") && <NotificationBell />}
            <LanguageSwitcher />
            <ThemeToggle />
          </div>

        </div>
        <div className="flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}