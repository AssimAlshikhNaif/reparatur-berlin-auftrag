import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { ThemeToggle } from "@/context/ThemeContext";
import { ROLE_LABELS } from "@/lib/constants";
import NotificationBell from "@/components/NotificationBell";
import GlobalSearch from "@/components/GlobalSearch";
import {
  Gauge, Wrench, Package, Users, QrCode, PlusCircle,
  SignOut, List, X, Wall, ChartBar,
} from "@phosphor-icons/react";

const NAV = [
  { to: "/", label: "Dashboard", icon: Gauge, roles: ["admin", "mitarbeiter", "techniker"], end: true },
  { to: "/auftraege", label: "Aufträge", icon: Wrench, roles: ["admin", "mitarbeiter", "techniker"] },
  { to: "/auftrag/neu", label: "Neuer Auftrag", icon: PlusCircle, roles: ["admin", "mitarbeiter"] },
  { to: "/scannen", label: "QR Scannen", icon: QrCode, roles: ["admin", "mitarbeiter", "techniker"] },
  { to: "/ersatzteile", label: "Ersatzteile", icon: Package, roles: ["admin", "mitarbeiter", "techniker"] }, // متاح للأدمن، الموظف، والتقني
  { to: "/analyse", label: "Analyse", icon: ChartBar, roles: ["admin"] },
  { to: "/benutzer", label: "Benutzer", icon: Users, roles: ["admin"] },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
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
            <div className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground mt-1">BERLIN · ERP</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 py-3">
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
              <span>{n.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="border-t border-border p-4">
        <div className="mb-3">
          <div className="text-sm font-medium text-foreground truncate" data-testid="current-user-name">{user.name}</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-accent mt-0.5">
            {ROLE_LABELS[user.role]}
          </div>
        </div>
        <button
          data-testid="logout-button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider border border-border text-foreground/80 hover:bg-muted hover:text-primary-foreground transition-colors rounded-lg"
        >
          <SignOut size={14} /> Abmelden
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background grid-texture">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-border bg-background/70 backdrop-blur-sm sticky top-0 h-screen">
        <SidebarInner />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <Wall size={22} weight="duotone" className="text-accent" />
          <span className="font-head font-bold text-sm">REPARATUR BERLIN</span>
        </div>
        <button data-testid="mobile-menu-toggle" onClick={() => setOpen(!open)} className="text-foreground">
          {open ? <X size={24} /> : <List size={24} />}
        </button>
      </div>
      {open && (
        <div className="md:hidden fixed inset-0 z-30 pt-14 bg-background/95 flex flex-col">
          <SidebarInner />
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        <div className="flex items-center gap-3 h-12 px-6 border-b border-border sticky top-0 bg-background/80 backdrop-blur-xl z-20">
          <div className="flex-1 min-w-0 hidden sm:block">
            <GlobalSearch />
          </div>
          <div className="flex-1 sm:hidden" />
          {user.role === "admin" && <NotificationBell />}
          <ThemeToggle />
        </div>
        {children}
      </main>
    </div>
  );
}