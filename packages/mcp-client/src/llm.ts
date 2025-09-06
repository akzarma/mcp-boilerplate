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

