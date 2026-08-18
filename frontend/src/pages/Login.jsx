import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Wall, Eye, EyeSlash, SpinnerGap } from "@phosphor-icons/react";

const BG = "https://images.unsplash.com/photo-1522743791393-522312deeebf?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MTJ8MHwxfHNlYXJjaHwyfHxiZXJsaW4lMjBtb2Rlcm4lMjBidWlsZGluZyUyMGFic3RyYWN0fGVufDB8fHx8MTc4NTczOTAyNXww&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const res = await login(email.trim(), password);
    setBusy(false);
    if (res.ok) navigate("/");
    else setError(res.error);
  };

  return (
    <div className="min-h-screen flex">
      {/* Language switcher (top-right, absolute) */}
      <div className="absolute top-4 end-4 right-4 z-20">
        <LanguageSwitcher />
      </div>
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 relative border-r border-border overflow-hidden">
        <img src={BG} alt="Berlin" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/30" />
        <div className="relative z-10 p-12 flex items-center gap-3">
          <Wall size={34} weight="duotone" className="text-accent" />
          <div>
            <div className="font-head font-bold text-lg tracking-tight leading-none">REPARATUR</div>
            <div className="font-mono text-[11px] tracking-[0.35em] text-muted-foreground mt-1">BERLIN · ERP</div>
          </div>
        </div>
        <div className="relative z-10 p-12">
          <h1 className="font-head font-bold text-4xl xl:text-5xl tracking-tighter uppercase leading-[0.95]">
            {t("login.heroTitle1")}<br />{t("login.heroTitle2")}
          </h1>
          <p className="text-muted-foreground mt-6 max-w-sm text-sm leading-relaxed">
            {t("login.heroDesc")}
          </p>
          <div className="mt-8 flex gap-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/70">
            <span>{t("login.tag1")}</span><span>·</span><span>{t("login.tag2")}</span><span>·</span><span>{t("login.tag3")}</span>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <Wall size={28} weight="duotone" className="text-accent" />
            <span className="font-head font-bold text-base">REPARATUR BERLIN</span>
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground mb-2">{t("login.anmeldung")}</div>
          <h2 className="font-head font-bold text-2xl tracking-tight mb-8">{t("login.welcome")}</h2>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">{t("login.email")}</label>
              <input
                data-testid="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@repair.de"
                className="w-full bg-background border border-border px-3 py-2.5 text-sm rounded-lg outline-none focus:border-accent transition-colors font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-2">{t("login.password")}</label>
              <div className="relative">
                <input
                  data-testid="login-password"
                  type={show ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-background border border-border px-3 py-2.5 pr-10 text-sm rounded-lg outline-none focus:border-accent transition-colors font-mono"
                />
                <button type="button" onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary-foreground">
                  {show ? <EyeSlash size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div data-testid="login-error" className="text-sm text-red-400 border border-red-900 bg-red-950/40 px-3 py-2 font-mono">
                {error}
              </div>
            )}

            <button
              data-testid="login-submit"
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-head font-semibold text-sm uppercase tracking-wider py-3 rounded-lg hover:bg-blue-600 hover:text-primary-foreground transition-colors disabled:opacity-50"
            >
              {busy ? <><SpinnerGap size={16} className="animate-spin" /> {t("login.submitting")}</> : t("login.submit")}
            </button>
          </form>

          <p className="text-[11px] text-muted-foreground/70 mt-8 font-mono leading-relaxed">
            {t("login.noRegister")}
          </p>
        </div>
      </div>
    </div>
  );
}