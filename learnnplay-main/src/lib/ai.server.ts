// Server-only helper for structured AI calls through Google Gemini API.
import { GoogleGenerativeAI } from "@google/generative-ai";

export const AI_MODEL = "gemini-1.5-pro";

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

/** Streams a structured JSON call using Gemini API and returns the parsed object. */
export async function callStructured<T>(opts: {
  instructions: string;
  content: ContentPart[];
  schemaName: string;
  schema: Record<string, unknown>;
}): Promise<T> {
  const apiKey = process.env["GEMINI_API_KEY"];
  if (!apiKey)
    throw new AiError(
      "AI is not configured for this project. Set GEMINI_API_KEY in environment variables.",
      500,
    );

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: AI_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  // Build the prompt with JSON schema instructions
  const promptParts: string[] = [
    opts.instructions,
    "\n\nIMPORTANT: Return your response as valid JSON only. No markdown, no explanation outside the JSON.",
    "\n\nJSON Schema to follow:",
    JSON.stringify(opts.schema, null, 2),
  ];

  for (const part of opts.content) {
    if (part.type === "input_text") {
      promptParts.push("\n\nCONTENT:\n" + part.text);
    } else if (part.type === "input_file") {
      // Include the file data in the prompt
      promptParts.push(`\n\nUPLOADED FILE: ${part.filename}\n\n${part.file_data}`);
    }
  }

  const fullPrompt = promptParts.join("\n");

  try {
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    let text = response.text();

    // Clean up the response - remove markdown code blocks if present
    text = text.trim();
    if (text.startsWith("```json")) {
      text = text.slice(7);
    }
    if (text.startsWith("```")) {
      text = text.slice(3);
    }
    if (text.endsWith("```")) {
      text = text.slice(0, -3);
    }
    text = text.trim();

    if (!text) throw new AiError("The AI returned an empty answer. Please try again.", 502);

    try {
      return JSON.parse(text) as T;
    } catch (e) {
      console.error("Failed to parse AI response:", text);
      throw new AiError("The AI answer could not be read as JSON. Please try again.", 502);
    }
  } catch (error) {
    if (error instanceof AiError) throw error;

    // Handle Gemini-specific errors
    if (error instanceof Error) {
      if (error.message.includes("API_KEY_INVALID") || error.message.includes("401")) {
        throw new AiError("Invalid Gemini API key. Please check your GEMINI_API_KEY.", 403);
      }
      if (error.message.includes("429") || error.message.includes("quota")) {
        throw new AiError("The AI is busy right now. Please try again in a minute.", 429);
      }
      if (error.message.includes("400")) {
        throw new AiError("Invalid request format. Please try again.", 400);
      }
      throw new AiError(error.message || "AI request failed.", 502);
    }

    throw new AiError("AI generation failed.", 502);
  }
}
