import type { ReactNode } from "react";
import { getLang, LANGUAGES, type LangCode } from "@/lib/i18n";

/** Wraps text with the right lang/dir/font so RTL and mixed scripts render correctly. */
export function LangText({
  lang,
  as: Tag = "span",
  className = "",
  children,
}: {
  lang: LangCode;
  as?: "span" | "p" | "h1" | "h2" | "div";
  className?: string;
  children: ReactNode;
}) {
  const l = getLang(lang);
  return (
    <Tag lang={l.code} dir={l.dir} className={`${className} [unicode-bidi:plaintext]`} style={{ fontFamily: l.font }}>
      {children}
    </Tag>
  );
}

export function LanguageSelect({
  value,
  onChange,
  exclude,
  className = "",
  id,
}: {
  value: LangCode;
  onChange: (code: LangCode) => void;
  exclude?: LangCode | undefined;
  className?: string;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`rounded-xl border border-border bg-background px-3 py-2 text-sm ${className}`}
    >
      {LANGUAGES.filter((l) => l.code !== exclude).map((l) => (
        <option key={l.code} value={l.code}>
          {l.name} · {l.native}
        </option>
      ))}
    </select>
  );
}

export function LangBadge({ lang, className = "" }: { lang: LangCode; className?: string }) {
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${className}`}>
      {getLang(lang).code}
    </span>
  );
}
