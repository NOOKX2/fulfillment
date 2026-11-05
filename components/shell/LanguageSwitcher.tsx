"use client";

import { actions } from "@/lib/store/actions";
import { useWms } from "@/lib/store/store";
import { useT } from "@/lib/i18n/useT";

/** TH | EN segmented control, labelled in each language's own script. */
export function LanguageSwitcher({ onDark = false }: { onDark?: boolean }) {
  const lang = useWms((s) => s.data.settings.lang);
  const { t } = useT();
  const item = (value: "th" | "en", label: string) => {
    const active = lang === value;
    return (
      <button
        type="button"
        aria-pressed={active}
        lang={value}
        onClick={() => actions.setLang(value)}
        className={`min-h-9 px-3 text-sm font-semibold ${
          active
            ? "bg-gold text-ink"
            : onDark
              ? "text-white hover:bg-white/10"
              : "bg-white text-ink hover:bg-silver"
        }`}
      >
        {label}
      </button>
    );
  };
  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className={`inline-flex overflow-hidden rounded-control border ${onDark ? "border-white" : "border-ink"}`}
    >
      {item("th", "ไทย")}
      {item("en", "English")}
    </div>
  );
}
