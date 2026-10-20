// Server-only helper for structured AI calls through the Lovable AI Gateway (Responses API).
const GATEWAY = "https://ai.gateway.lovable.dev/v1/responses";
export const AI_MODEL = "openai/gpt-6-astra";

export class AiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type ContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_file"; filename: string; file_data: string };

/** Streams a strict-JSON-schema Responses call and returns the parsed object. */
export async function callStructured<T>(opts: {
  instructions: string;
  content: ContentPart[];
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiError("AI is not configured for this project.", 500);

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      instructions: opts.instructions,
      input: [{ role: "user", content: opts.content }],
      stream: true,
      store: false,
      reasoning: { effort: "low", summary: "auto" },
      include: ["reasoning.encrypted_content"],
      text: {
        format: { type: "json_schema", name: opts.schemaName, strict: true, schema: opts.schema },
      },
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    let msg = body;
    try {
      const j = JSON.parse(body) as { error?: { message?: string }; message?: string };
      msg = j.error?.message ?? j.message ?? body;
    } catch {
      /* keep raw */
    }
    if (res.status === 402)
      throw new AiError(
        "AI credits are used up for this workspace. Add credits to keep generating.",
        402,
      );
    if (res.status === 429)
      throw new AiError("The AI is busy right now. Please try again in a minute.", 429);
    if (res.status === 403) throw new AiError(msg || "AI access was denied for this request.", 403);
    throw new AiError(msg || `AI request failed (${res.status})`, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let finalText: string | null = null;
  let refusal: string | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const data = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("");
      if (!data || data === "[DONE]") continue;
      let evt: {
        type?: string;
        delta?: string;
        text?: string;
        refusal?: string;
        response?: { error?: { message?: string } };
        message?: string;
      };
      try {
        evt = JSON.parse(data);
      } catch {
        continue;
      }
      if (evt.type === "response.output_text.delta" && evt.delta) text += evt.delta;
      else if (evt.type === "response.output_text.done" && typeof evt.text === "string")
        finalText = evt.text;
      else if (evt.type === "response.refusal.done")
        refusal = evt.refusal ?? "The AI declined this request.";
      else if (evt.type === "response.failed" || evt.type === "error")
        throw new AiError(
          evt.response?.error?.message ?? evt.message ?? "AI generation failed.",
          502,
        );
    }
  }

  if (refusal) throw new AiError(refusal, 422);
  const out = finalText ?? text;
  if (!out.trim()) throw new AiError("The AI returned an empty answer. Please try again.", 502);
  try {
    return JSON.parse(out) as T;
  } catch {
    throw new AiError("The AI answer could not be read. Please try again.", 502);
  }
}
