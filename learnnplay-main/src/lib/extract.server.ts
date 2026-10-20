import { strFromU8, unzipSync } from "fflate";

function decodeXml(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

/** Pulls paragraph text out of a DrawingML XML part (slides, notes). */
function xmlParagraphs(xml: string): string[] {
  const paras: string[] = [];
  for (const p of xml.match(/<a:p[\s>][\s\S]*?<\/a:p>/g) ?? []) {
    const runs = [...p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) => decodeXml(m[1] ?? ""));
    const line = runs.join("").trim();
    if (line) paras.push(line);
  }
  return paras;
}

/** Extracts slide-by-slide text (including tables and speaker notes) from a .pptx file. */
export function extractPptx(bytes: Uint8Array): string {
  const files = unzipSync(bytes, {
    filter: (f) => /^ppt\/(slides|notesSlides)\/[a-zA-Z]+\d+\.xml$/.test(f.name),
  });
  const num = (n: string) => Number(n.match(/(\d+)\.xml$/)?.[1] ?? 0);
  const slides = Object.keys(files)
    .filter((n) => n.startsWith("ppt/slides/"))
    .sort((a, b) => num(a) - num(b));
  const out: string[] = [];
  for (const name of slides) {
    const n = num(name);
    const body = xmlParagraphs(strFromU8(files[name]!));
    const notesFile = files[`ppt/notesSlides/notesSlide${n}.xml`];
    const notes = notesFile
      ? xmlParagraphs(strFromU8(notesFile)).filter((l) => !/^\d+$/.test(l))
      : [];
    if (!body.length && !notes.length) continue;
    out.push(
      `--- Slide ${n} ---\n${body.join("\n")}${notes.length ? `\n[Speaker notes]\n${notes.join("\n")}` : ""}`,
    );
  }
  return out.join("\n\n");
}
