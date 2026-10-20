import { getLang } from "./i18n";

export type AiVersion = { lang: string; prompt: string; options: string[]; explanation: string | null; hint: string | null };
export type AiQuestion = {
  id: string | null;
  kind: "mcq" | "truefalse";
  style: "knowledge" | "scenario" | "practical";
  difficulty: "easy" | "medium" | "hard";
  correct: number;
  seconds: number;
  points: number;
  source_ref: string | null;
  versions: AiVersion[];
};
export type AiQuiz = {
  title: string;
  topics: string[];
  objectives: string[];
  source_outline: string;
  plan: string | null;
  questions: AiQuestion[];
};

const nullableStr = { type: ["string", "null"] };

const QUESTION = {
  type: "object",
  additionalProperties: false,
  required: ["id", "kind", "style", "difficulty", "correct", "seconds", "points", "source_ref", "versions"],
  properties: {
    id: nullableStr,
    kind: { type: "string", enum: ["mcq", "truefalse"] },
    style: { type: "string", enum: ["knowledge", "scenario", "practical"] },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
    correct: { type: "integer", description: "0-based index of the correct option, identical for every language version" },
    seconds: { type: "integer" },
    points: { type: "integer" },
    source_ref: { ...nullableStr, description: "Slide/page or section the question is grounded in" },
    versions: {
      type: "array",
      description: "One entry per requested language, same meaning, same option order",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["lang", "prompt", "options", "explanation", "hint"],
        properties: {
          lang: { type: "string", description: "Language code" },
          prompt: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          explanation: nullableStr,
          hint: nullableStr,
        },
      },
    },
  },
};

const QUIZ_PROPS = {
  title: { type: "string" },
  topics: { type: "array", items: { type: "string" } },
  objectives: { type: "array", items: { type: "string" } },
  source_outline: {
    type: "string",
    description: "Faithful structured outline of the source content: headings, key facts, definitions, numbers, processes, terminology",
  },
  plan: { ...nullableStr, description: "Optional session plan / agenda text when the trainer asks for one" },
  questions: { type: "array", items: QUESTION },
};

export const QUIZ_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "topics", "objectives", "source_outline", "plan", "questions"],
  properties: QUIZ_PROPS,
};

export const ASSISTANT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reply", "languages", ...QUIZ_SCHEMA.required],
  properties: {
    reply: { type: "string", description: "Short message to the trainer describing what changed" },
    languages: {
      type: "object",
      additionalProperties: false,
      required: ["mode", "primary", "secondary"],
      properties: {
        mode: { type: "string", enum: ["single", "dual"] },
        primary: { type: "string" },
        secondary: nullableStr,
      },
    },
    ...QUIZ_PROPS,
  },
};

type Glossary = Array<{ term: string; translations: Record<string, string> }>;

function langLine(langs: string[]) {
  return langs.map((c) => `${getLang(c).name} (code "${c}")`).join(" and ");
}

function glossaryBlock(glossary: Glossary, langs: string[]) {
  if (!glossary.length) return "No organization glossary.";
  return (
    "ORGANIZATION GLOSSARY (mandatory terminology):\n" +
    glossary
      .map((g) => {
        const parts = langs
          .filter((l) => l !== "en")
          .map((l) => `${getLang(l).name}: ${g.translations[l]?.trim() ? g.translations[l] : `keep "${g.term}" unchanged`}`);
        return `- "${g.term}" → ${parts.join("; ") || "keep unchanged"}`;
      })
      .join("\n")
  );
}

export const TRANSLATION_RULES = `TRANSLATION RULES:
- Every language version is the SAME underlying question: same learning objective, same facts, same option order and the same correct index.
- Never add, drop or change facts while translating.
- Keep brand names, product names, scientific/INN drug names, standard abbreviations and acronyms (e.g. mg, mL, BP, GMP, SOP) exactly as in the source unless the glossary gives an approved term.
- Preserve all numbers, units, dosages and ranges exactly.
- Use natural, professional phrasing in each language; Arabic must be written in Arabic script.`;

export function buildPrompt(o: {
  langs: string[];
  count: number;
  difficulty: string;
  types: string[];
  seconds: number;
  points: number;
  scenario: boolean;
  explanations: boolean;
  hints: boolean;
  grounding: "strict" | "general";
  glossary: Glossary;
}) {
  return `TASK: First read and understand the training content above (slides, headings, bullets, tables, key facts, definitions, processes, examples, numbers, terminology). Identify the topics and learning objectives. Then write exactly ${o.count} quiz questions.

LANGUAGES: Produce every question in ${langLine(o.langs)}. Each question's "versions" array must contain exactly one entry for each of these codes: ${o.langs.map((l) => `"${l}"`).join(", ")}. Title, topics, objectives and source_outline should be in ${getLang(o.langs[0]).name}.

GROUNDING: ${
    o.grounding === "strict"
      ? "UPLOADED CONTENT ONLY. Every question, correct answer and explanation must be directly supported by the uploaded content. Do not use outside facts. Distractors must be plausible but clearly wrong according to the content."
      : "UPLOADED CONTENT + GENERAL KNOWLEDGE. Base most questions on the uploaded content; you may supplement with well-established general knowledge in the same subject, but never contradict the content."
  }

SETTINGS:
- Difficulty: ${o.difficulty === "mixed" ? "a mix of easy, medium and hard" : o.difficulty}
- Question types allowed: ${o.types.map((t) => (t === "mcq" ? "multiple choice with exactly 4 options" : "true/false with options [True, False] translated")).join("; ")}
- ${o.scenario ? "Include scenario-based and practical, on-the-job questions (about half)." : "Mostly knowledge-check questions."}
- Timer: ${o.seconds} seconds per question (true/false may use fewer). Points: ${o.points} per question.
- Explanations: ${o.explanations ? "write a one-to-two sentence explanation in every language" : "set explanation to null"}.
- Hints: ${o.hints ? "write a short hint in every language that does not give the answer away" : "set hint to null"}.
- Set source_ref to the slide/page/section number. Set id to null. Set plan to null.
- Vary the position of the correct answer.

${TRANSLATION_RULES}

${glossaryBlock(o.glossary, o.langs)}`;
}

export function assistantPrompt(o: {
  command: string;
  languages: { mode: string; primary: string; secondary?: string | null | undefined };
  title: string;
  sourceText: string | null;
  grounding: "strict" | "general";
  questions: unknown[];
  glossary: Glossary;
}) {
  const current = [o.languages.primary, ...(o.languages.mode === "dual" && o.languages.secondary ? [o.languages.secondary] : [])];
  return `TRAINER COMMAND: """${o.command}"""

CURRENT QUIZ TITLE: ${o.title}
CURRENT LANGUAGES: ${langLine(current)} (mode: ${o.languages.mode})
CURRENT QUESTIONS (JSON, each has id, kind, correct, seconds, points and versions per language):
${JSON.stringify(o.questions)}

SOURCE CONTENT (extracted from the uploaded training file):
${o.sourceText ? o.sourceText.slice(0, 150_000) : "(not available — work only from the current questions)"}

GROUNDING: ${o.grounding === "strict" ? "Uploaded content only — never introduce facts not supported by the source content or existing questions." : "Uploaded content plus well-established general knowledge is allowed."}

HOW TO RESPOND:
- Apply the command to THIS quiz. Return the complete updated quiz (all questions that should remain), not just the changes.
- Keep each existing question's "id" when you keep or modify that question; use null for new questions.
- If the command changes languages (e.g. "Make this English + Arabic", "Translate into Hindi"), set "languages" accordingly (max two languages; the language being translated into becomes the secondary unless told otherwise) and make every question's versions match exactly those language codes. Otherwise keep the current languages.
- If asked to translate only explanations, keep prompts/options of that language as they were and translate the explanations.
- If asked for a pre-test and post-test, return questions for both, with pre-test questions first, and describe the split in "reply" and "plan".
- If asked for a training session plan (e.g. 60-minute session), put a timed agenda in "plan" and include matching questions.
- "correct" must remain the same 0-based index across all language versions.
- "reply": 1-3 sentences telling the trainer what you changed.
- source_outline: return the source content outline (reuse/condense the source content above).

${TRANSLATION_RULES}

${glossaryBlock(o.glossary, current)}`;
}
