"use client";

import { useWms } from "../store/store";
import type { L10n, Lang } from "../domain/types";
import { en } from "./en";
import { statusLabel } from "./status";
import { th, type DictKey } from "./th";

const dicts: Record<Lang, Record<DictKey, string>> = { th, en };

export interface T {
  lang: Lang;
  /** Dictionary lookup (shared labels; key parity is type-checked). */
  t: (key: DictKey) => string;
  /** Inline Thai/English pair for page-specific copy. */
  tr: (thText: string, enText: string) => string;
  /** Pick the active language from an L10n object. */
  l: (x: L10n) => string;
  /** Label for a status / enum value. */
  st: (value: string) => string;
}

export function makeT(lang: Lang): T {
  return {
    lang,
    t: (key) => dicts[lang][key],
    tr: (a, b) => (lang === "th" ? a : b),
    l: (x) => x[lang],
    st: (v) => statusLabel(v, lang),
  };
}

export function useT(): T {
  const lang = useWms((s) => s.data.settings.lang);
  return makeT(lang);
}
