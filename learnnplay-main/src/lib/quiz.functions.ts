import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildPrompt, QUIZ_SCHEMA, type AiQuiz } from "./quiz-ai.server";

const langCfg = z.object({
  mode: z.enum(["single", "dual"]),
  primary: z.string().min(2).max(8),
  secondary: z.string().min(2).max(8).nullable().optional(),
});

function langList(c: z.infer<typeof langCfg>) {
  return c.mode === "dual" && c.secondary && c.secondary !== c.primary
    ? [c.primary, c.secondary]
    : [c.primary];
}

async function loadGlossary(supabase: { from: (t: string) => any }) {
  const { data } = await supabase.from("glossary_entries").select("term, translations");
  return (data ?? []) as Array<{ term: string; translations: Record<string, string> }>;
}

function bytesToBase64(bytes: Uint8Array) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk)
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
}

/** Reads the uploaded deck and asks AI to draft a grounded quiz in the selected languages. */
export const generateQuizFromFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        filePath: z.string().min(3).max(500),
        fileName: z.string().min(1).max(300),
        languages: langCfg,
        count: z.number().int().min(1).max(30),
        difficulty: z.enum(["easy", "medium", "hard", "mixed"]),
        types: z.array(z.enum(["mcq", "truefalse"])).min(1),
        seconds: z.number().int().min(5).max(300),
        points: z.number().int().min(100).max(5000),
        scenario: z.boolean(),
        explanations: z.boolean(),
        hints: z.boolean(),
        grounding: z.enum(["strict", "general"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Check subscription limits for quiz creation
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: orgMember } = await supabaseAdmin
      .from("organization_members")
      .select("org_id")
      .eq("user_id", userId)
      .single();

    if (orgMember) {
      const { canCreateQuiz, canUseAI } = await import("./subscription-limits");
      const quizCheck = await canCreateQuiz(orgMember.org_id);
      const aiCheck = await canUseAI(orgMember.org_id);

      if (!quizCheck.allowed) {
        throw new Error(
          `You've reached your monthly quiz limit (${quizCheck.limit}). Upgrade your plan to create more quizzes.`,
        );
      }

      if (!aiCheck.allowed) {
        throw new Error(
          `You've reached your AI generation limit (${aiCheck.limit}). Upgrade your plan for unlimited AI-powered quizzes.`,
        );
      }
    }

    const lower = data.fileName.toLowerCase();
    if (lower.endsWith(".ppt"))
      throw new Error(
        "Old .ppt files can't be read. Please save the deck as .pptx or PDF and upload again.",
      );

    const { data: blob, error } = await supabase.storage
      .from("training-files")
      .download(data.filePath);
    if (error || !blob)
      throw new Error("Could not read the uploaded file. Please upload it again.");
    const bytes = new Uint8Array(await blob.arrayBuffer());

    let extracted = "";
    const content: Array<
      | { type: "input_text"; text: string }
      | { type: "input_file"; filename: string; file_data: string }
    > = [];
    if (lower.endsWith(".pptx")) {
      const { extractPptx } = await import("./extract.server");
      extracted = extractPptx(bytes);
      if (!extracted.trim()) throw new Error("No readable text was found in this deck.");
      content.push({
        type: "input_text",
        text: `TRAINING CONTENT (${data.fileName}):\n\n${extracted.slice(0, 180_000)}`,
      });
    } else if (lower.endsWith(".pdf")) {
      content.push({
        type: "input_file",
        filename: data.fileName,
        file_data: `data:application/pdf;base64,${bytesToBase64(bytes)}`,
      });
    } else {
      throw new Error("Please upload a .pptx or .pdf file.");
    }

    const glossary = await loadGlossary(supabase);
    const langs = langList(data.languages);
    content.push({
      type: "input_text",
      text: buildPrompt({ ...data, langs, glossary }),
    });

    const { callStructured, AiError } = await import("./ai.server");
    try {
      const ai = await callStructured<AiQuiz>({
        instructions:
          "You are LearnNPlay's training-assessment author. You read corporate, pharmaceutical and technical training material and write accurate, fair quiz questions. Always answer in the requested JSON schema.",
        content,
        schemaName: "quiz",
        schema: QUIZ_SCHEMA,
      });
      return { ai, langs, extracted: extracted || ai.source_outline };
    } catch (e) {
      if (e instanceof AiError) throw new Error(e.message);
      throw e;
    }
  });

/** AI Assistant: applies a natural-language command to the current quiz. */
export const runAssistantCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        command: z.string().min(2).max(2000),
        languages: langCfg,
        title: z.string().max(300),
        sourceText: z.string().max(200_000).nullable(),
        grounding: z.enum(["strict", "general"]),
        questions: z.array(z.any()).max(60),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const glossary = await loadGlossary(context.supabase);
    const { callStructured, AiError } = await import("./ai.server");
    const { ASSISTANT_SCHEMA, assistantPrompt } = await import("./quiz-ai.server");
    try {
      const ai = await callStructured<
        AiQuiz & {
          reply: string;
          languages: { mode: "single" | "dual"; primary: string; secondary: string | null };
        }
      >({
        instructions:
          "You are LearnNPlay's AI Assistant for trainers. You modify the trainer's CURRENT quiz according to their command and return the full updated quiz. Never invent unrelated content. Always answer in the requested JSON schema.",
        content: [{ type: "input_text", text: assistantPrompt({ ...data, glossary }) }],
        schemaName: "assistant_result",
        schema: ASSISTANT_SCHEMA,
      });
      return { ai };
    } catch (e) {
      if (e instanceof AiError) throw new Error(e.message);
      throw e;
    }
  });
