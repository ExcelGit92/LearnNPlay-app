/**
 * Language registry + localized-question helpers.
 * Add a language by appending one entry to LANGUAGES — nothing else is language-specific.
 */
export type LangCode = string;

export type Language = {
  code: LangCode;
  name: string;
  native: string;
  dir: "ltr" | "rtl";
  /** CSS font-family stack for the script. */
  font: string;
};

const BASE = '"Plus Jakarta Sans", system-ui, sans-serif';

export const LANGUAGES: Language[] = [
  { code: "en", name: "English", native: "English", dir: "ltr", font: BASE },
  { code: "bn", name: "Bangla", native: "বাংলা", dir: "ltr", font: `"Noto Sans Bengali", ${BASE}` },
  {
    code: "hi",
    name: "Hindi",
    native: "हिन्दी",
    dir: "ltr",
    font: `"Noto Sans Devanagari", ${BASE}`,
  },
  {
    code: "ar",
    name: "Arabic",
    native: "العربية",
    dir: "rtl",
    font: `"Noto Sans Arabic", ${BASE}`,
  },
  { code: "es", name: "Spanish", native: "Español", dir: "ltr", font: BASE },
  { code: "fr", name: "French", native: "Français", dir: "ltr", font: BASE },
  { code: "de", name: "German", native: "Deutsch", dir: "ltr", font: BASE },
  { code: "pt", name: "Portuguese", native: "Português", dir: "ltr", font: BASE },
  {
    code: "zh",
    name: "Chinese",
    native: "中文",
    dir: "ltr",
    font: `"Noto Sans SC", "PingFang SC", "Microsoft YaHei", ${BASE}`,
  },
  {
    code: "ja",
    name: "Japanese",
    native: "日本語",
    dir: "ltr",
    font: `"Noto Sans JP", "Hiragino Sans", "Yu Gothic", ${BASE}`,
  },
  {
    code: "ko",
    name: "Korean",
    native: "한국어",
    dir: "ltr",
    font: `"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", ${BASE}`,
  },
  { code: "it", name: "Italian", native: "Italiano", dir: "ltr", font: BASE },
  { code: "tr", name: "Turkish", native: "Türkçe", dir: "ltr", font: BASE },
  { code: "ru", name: "Russian", native: "Русский", dir: "ltr", font: BASE },
  { code: "id", name: "Indonesian", native: "Bahasa Indonesia", dir: "ltr", font: BASE },
  { code: "ms", name: "Malay", native: "Bahasa Melayu", dir: "ltr", font: BASE },
];

export function getLang(code: LangCode | undefined): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]!;
}

export type LanguageConfig = {
  mode: "single" | "dual";
  primary: LangCode;
  secondary?: LangCode;
};

export const DEFAULT_LANGS: LanguageConfig = { mode: "dual", primary: "en", secondary: "bn" };

export function sessionLangs(cfg: LanguageConfig | undefined): LangCode[] {
  const c = cfg ?? DEFAULT_LANGS;
  return c.mode === "dual" && c.secondary && c.secondary !== c.primary
    ? [c.primary, c.secondary]
    : [c.primary];
}

/** l1 = language 1, l2 = language 2, both, preferred = each participant's choice */
export type DisplayMode = "l1" | "l2" | "both" | "preferred";

export const DISPLAY_MODES: Array<{ id: DisplayMode; label: string }> = [
  { id: "l1", label: "Language 1 only" },
  { id: "l2", label: "Language 2 only" },
  { id: "both", label: "Both languages" },
  { id: "preferred", label: "Participant's choice" },
];

export type TranslationStatus =
  "not_translated" | "ai_translated" | "reviewed" | "approved" | "needs_update";

export const STATUS_LABEL: Record<TranslationStatus, string> = {
  not_translated: "Not translated",
  ai_translated: "AI translated",
  reviewed: "Trainer reviewed",
  approved: "Trainer approved",
  needs_update: "Needs update",
};

export type Translation = {
  prompt: string;
  /** Same order/index as the source options, so the correct-answer mapping is shared. */
  options: string[];
  explanation?: string | undefined;
  hint?: string | undefined;
  status: TranslationStatus;
  /** Fingerprint of the source text when this translation was made. */
  sourceHash: string;
};

export function hashSource(prompt: string, options: string[]): string {
  const s = prompt + "\u0001" + options.join("\u0001");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return String(h);
}

/* ------------------------------ glossary ------------------------------ */

export type GlossaryEntry = { id: string; term: string; translations: Record<LangCode, string> };

/** Replace approved terms inside a translated string, keeping protected terms intact. */
export function applyGlossary(text: string, lang: LangCode, glossary: GlossaryEntry[]): string {
  let out = text;
  for (const g of glossary) {
    const target = g.translations[lang];
    if (!g.term.trim()) continue;
    const re = new RegExp(g.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    out = out.replace(re, target?.trim() ? target : g.term);
  }
  return out;
}
