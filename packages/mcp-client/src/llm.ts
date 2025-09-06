import * as webllm from "@mlc-ai/web-llm";

let engine: webllm.MLCEngine | null = null;
let modelDownloadProgress = 0;

const DEFAULT_MODEL = "Qwen2.5-1.5B-Instruct-q4f16_1-MLC"; // balanced small instruct model

export function getLlmProgress() { return modelDownloadProgress; }
export function isLlmReady() { return !!engine; }

export async function ensureLlm(model: string = DEFAULT_MODEL) {
  if (engine) return engine;
  engine = await webllm.CreateMLCEngine(model, {
    initProgressCallback: (p) => {
      modelDownloadProgress = Math.round((p.progress || 0) * 100);
    },
  });
  return engine;
}

export async function summarizeTool(name: string, args: unknown, result: unknown): Promise<string> {
  await ensureLlm();
  const sys = "You are a helpful assistant. Read a tool call (name, args, result) and reply with a short, friendly natural-language explanation. If the result is JSON, interpret key values and describe them succinctly. Keep it under 4 sentences.";
  const prompt = `Tool: ${name}\nArgs: ${safe(args)}\nResult: ${safe(result)}\n\nExplain:`;
  const out = await (engine as webllm.MLCEngine).chat.completions.create({
    messages: [
      { role: "system", content: sys },
      { role: "user", content: prompt },
    ],
    stream: false,
    temperature: 0.2,
    max_tokens: 220,
  } as any);
  // @ts-ignore types may vary slightly between versions
  const text: string | undefined = out?.choices?.[0]?.message?.content;
  return text || "(no response)";
}

function safe(v: unknown) {
  try { return JSON.stringify(v); } catch { return String(v); }
}

// Plan a tool call from a natural-language message using the available tools list.
export async function planToolCall(tools: any[], userMessage: string): Promise<{ name: string; args: any } | null> {
  await ensureLlm();
  const catalog = tools.map((t) => ({ name: t.name, description: t.description || "", schema: t.input_schema || null }));
  const sys = `You are a planner that chooses a single MCP tool and arguments for a user request.
You MUST respond with strict JSON only: {"name":"<tool>","args":{...}} or {"name":null,"args":{}} if none apply.
Pick the most relevant tool from the list. If an argument is missing, infer a sensible default when safe; otherwise return name:null.`;
  const prompt = `Tools: ${JSON.stringify(catalog)}\n\nUser: ${userMessage}\n\nReturn JSON only.`;
  const out = await (engine as webllm.MLCEngine).chat.completions.create({
    messages: [
      { role: "system", content: sys },
      { role: "user", content: prompt },
    ],
    stream: false,
    temperature: 0,
    max_tokens: 200,
  } as any);
  // @ts-ignore
  const text: string | undefined = out?.choices?.[0]?.message?.content;
  if (!text) return null;
  // attempt to extract JSON
  const parsed = tryParseJson(text);
  if (!parsed || typeof parsed !== 'object') return null;
  if (!('name' in parsed)) return null;
  return parsed as any;
}

function tryParseJson(s: string): any | null {
  const direct = safeParse(s);
  if (direct) return direct;
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return safeParse(s.slice(start, end + 1));
  }
  return null;
}

function safeParse(s: string): any | null {
  try { return JSON.parse(s); } catch { return null; }
}
