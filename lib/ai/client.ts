import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// AI provider adapter (CLAUDE.md section 4). Picks a provider at runtime:
//   ANTHROPIC_API_KEY → Claude;  else GROQ_API_KEY → Groq;  else demo mode.
// Callers never know which provider answered, and always get schema-validated output or an error.

export type Provider = "anthropic" | "groq" | "demo";

export function activeProvider(): Provider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GROQ_API_KEY) return "groq";
  return "demo";
}

const ANTHROPIC_MODEL = "claude-sonnet-5";
const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
const GROQ_VISION_MODEL = process.env.GROQ_VISION_MODEL ?? "qwen/qwen3.8-27b";
const TIMEOUT_MS = 20_000;

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

type Request<T extends z.ZodType> = { system: string; prompt: string; schema: T; maxTokens?: number };

export async function callStructured<T extends z.ZodType>(req: Request<T>): Promise<{ data: z.infer<T>; provider: Provider; model: string }> {
  const provider = activeProvider();
  if (provider === "anthropic") return { data: await callAnthropic(req), provider, model: ANTHROPIC_MODEL };
  if (provider === "groq") return { data: await callGroq(req), provider, model: GROQ_MODEL };
  throw new AiUnavailableError("No AI provider configured");
}

let anthropic: Anthropic | null = null;

async function callAnthropic<T extends z.ZodType>({ system, prompt, schema, maxTokens = 4000 }: Request<T>): Promise<z.infer<T>> {
  anthropic ??= new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 1 });
  try {
    const response = await anthropic.messages.parse({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: zodOutputFormat(schema) },
    });
    if (response.stop_reason === "refusal") throw new AiUnavailableError("Model declined the request");
    if (response.parsed_output == null) throw new AiUnavailableError("Model output didn't match the schema");
    return schema.parse(response.parsed_output);
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    if (err instanceof Anthropic.APIError) throw new AiUnavailableError(`Anthropic API error ${err.status ?? ""}`.trim());
    throw new AiUnavailableError("Anthropic request failed");
  }
}

async function callGroq<T extends z.ZodType>({ system, prompt, schema, maxTokens = 4000 }: Request<T>): Promise<z.infer<T>> {
  // Groq's free tier: OpenAI-compatible chat completions in JSON mode. We describe the schema in the
  // prompt and validate the result with zod ourselves.
  const jsonSchema = JSON.stringify(z.toJSONSchema(schema));
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${system}\n\nRespond with a single JSON object matching this JSON Schema exactly:\n${jsonSchema}` },
        { role: "user", content: prompt },
      ],
    }),
  }).catch(() => {
    throw new AiUnavailableError("Groq request failed");
  });
  if (!res.ok) throw new AiUnavailableError(`Groq API error ${res.status}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content;
  if (!text) throw new AiUnavailableError("Groq returned no content");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new AiUnavailableError("Groq returned invalid JSON");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw new AiUnavailableError("Groq output didn't match the schema");
  return parsed.data;
}

// ------------------------------------------------------------------------------------------------
// Vision: transcribe document images (photos, handwriting) that on-device OCR can't read well.

export type ImageInput = { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string };

const TRANSCRIBE_PROMPT = `Transcribe all text in this document exactly as written, line by line.
Keep numbers, dates and abbreviations as they appear. Write [illegible] for any word you cannot read; never guess.
Output only the transcription as plain text: no commentary, no markdown.`;

export async function transcribeImages(images: ImageInput[]): Promise<{ text: string; provider: Provider; model: string }> {
  const provider = activeProvider();
  if (provider === "anthropic") {
    anthropic ??= new Anthropic({ timeout: 45_000, maxRetries: 1 });
    try {
      const response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              ...images.map((i) => ({ type: "image" as const, source: { type: "base64" as const, media_type: i.mediaType, data: i.base64 } })),
              { type: "text" as const, text: TRANSCRIBE_PROMPT },
            ],
          },
        ],
      });
      if (response.stop_reason === "refusal") throw new AiUnavailableError("Model declined the request");
      const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
      return { text: cleanTranscript(text), provider, model: ANTHROPIC_MODEL };
    } catch (err) {
      if (err instanceof AiUnavailableError) throw err;
      throw new AiUnavailableError(err instanceof Anthropic.APIError ? `Anthropic API error ${err.status ?? ""}`.trim() : "Anthropic request failed");
    }
  }
  if (provider === "groq") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: GROQ_VISION_MODEL,
        temperature: 0,
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: TRANSCRIBE_PROMPT },
              ...images.map((i) => ({ type: "image_url", image_url: { url: `data:${i.mediaType};base64,${i.base64}` } })),
            ],
          },
        ],
      }),
    }).catch(() => {
      throw new AiUnavailableError("Groq request failed");
    });
    if (!res.ok) throw new AiUnavailableError(`Groq API error ${res.status}`);
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content;
    if (!text) throw new AiUnavailableError("Groq returned no content");
    return { text: cleanTranscript(text), provider, model: GROQ_VISION_MODEL };
  }
  throw new AiUnavailableError("AI vision needs an AI provider (GROQ_API_KEY or ANTHROPIC_API_KEY).");
}

// Models sometimes wrap output in a code fence or add reasoning tags; keep only the transcript.
function cleanTranscript(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").replace(/^```[a-z]*\n?|```$/gim, "").trim();
}
