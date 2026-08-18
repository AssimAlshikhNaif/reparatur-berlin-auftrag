import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Translate, CaretDown, Check } from "@phosphor-icons/react";
import { SUPPORTED_LANGUAGES } from "@/i18n";

const LABELS = { de: "Deutsch", en: "English", ar: "العربية" };
const SHORT = { de: "DE", en: "EN", ar: "AR" };

export default function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = (i18n.resolvedLanguage || i18n.language || "de").split("-")[0];

  const change = (lng) => {
    i18n.changeLanguage(lng);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        data-testid="language-switcher"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-border hover:bg-muted transition-colors text-xs font-mono uppercase tracking-wider text-foreground"
        title="Sprache / Language / اللغة"
        aria-label="Language"
      >
        <Translate size={16} className="text-muted-foreground" />
        <span data-testid="language-current">{SHORT[current] || "DE"}</span>
        <CaretDown size={12} className="text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div data-testid="language-menu"
            className="absolute end-0 right-0 mt-2 w-40 z-40 bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
            {SUPPORTED_LANGUAGES.map((lng) => (
              <button
                key={lng}
                data-testid={`language-option-${lng}`}
                onClick={() => change(lng)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors ${current === lng ? "text-accent" : "text-foreground"}`}
              >
                <span>{LABELS[lng]}</span>
                {current === lng && <Check size={14} weight="bold" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
