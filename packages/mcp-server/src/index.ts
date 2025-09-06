import express, { type Request, type Response } from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import fetch from "node-fetch";

const PORT = Number(process.env.MCP_PORT || 5179);
const PATH = String(process.env.MCP_PATH || "/mcp");

export function createMcpExpressApp(basePath: string = PATH) {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "1mb" }));

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  } as any);

  const mcp = new McpServer({ name: "mcp-boilerplate", version: "0.1.0" });

  // Simple tools
  mcp.tool("ping", "Health check", async () => ({ content: [{ type: "text", text: "pong" }] }));

  mcp.tool(
    "echo",
    "Echo back a message",
    { message: z.string() },
    async ({ message }) => ({ content: [{ type: "text", text: JSON.stringify({ message }) }] })
  );

  mcp.tool(
    "math.add",
    "Add two numbers",
    { a: z.number(), b: z.number() },
    async ({ a, b }) => ({ content: [{ type: "text", text: JSON.stringify({ result: a + b }) }] })
  );

  mcp.tool(
    "time.now",
    "Return current ISO timestamp",
    async () => ({ content: [{ type: "text", text: JSON.stringify({ now: new Date().toISOString() }) }] })
  );

  mcp.tool(
    "http.getTitle",
    "Fetch a URL and attempt to extract <title>",
    { url: z.string().url() },
    async ({ url }) => {
      const res = await fetch(url);
      const html = await res.text();
      const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const title = m ? m[1].trim() : null;
      return { content: [{ type: "text", text: JSON.stringify({ url, title }) }] };
    }
  );

  // Bind transport
  app.get(basePath, (req: Request, res: Response) => transport.handleRequest(req as any, res as any));
  app.post(basePath, (req: Request, res: Response) => transport.handleRequest(req as any, res as any, (req as any).body));
  if (basePath !== "/") {
    app.get("/", (req: Request, res: Response) => transport.handleRequest(req as any, res as any));
    app.post("/", (req: Request, res: Response) => transport.handleRequest(req as any, res as any, (req as any).body));
  }

  void mcp.connect(transport);
  
  // Lightweight LLM helpers: try local Ollama first, else fallback template summarizer
  const OLLAMA_URL = process.env.OLLAMA_HOST || "http://localhost:11434";
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2:3b";

  async function ollamaChat(messages: { role: string; content: string }[]) {
    try {
      const r = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: false }),
      });
      if (!r.ok) throw new Error(`Ollama ${r.status}`);
      const j: any = await r.json();
      const text: string | undefined = j?.message?.content;
      return text || null;
    } catch {
      return null;
    }
  }

  function safe(v: any) { try { return JSON.stringify(v); } catch { return String(v); } }

  app.post("/llm/summarize", express.json(), async (req: Request, res: Response) => {
    const { name, args, result } = (req as any).body || {};
    const sys = "You are a helpful assistant. Read a tool call (name, args, result) and reply with a short, friendly natural-language explanation under 4 sentences.";
    const user = `Tool: ${name}\nArgs: ${safe(args)}\nResult: ${safe(result)}\n\nExplain:`;
    const viaOllama = await ollamaChat([
      { role: "system", content: sys },
      { role: "user", content: user },
    ]);
    if (viaOllama) return res.json({ text: viaOllama, provider: "ollama" });
    // Fallback: naive summary
    let text = "";
    if (result && typeof result === "object") {
      const keys = Object.keys(result);
      text = `Called ${name}. I got an object with keys: ${keys.slice(0,8).join(", ")}.`;
    } else {
      text = `Called ${name}. Result: ${String(result).slice(0,200)}`;
    }
    res.json({ text, provider: "fallback" });
  });

  app.post("/llm/plan", express.json(), async (req: Request, res: Response) => {
    const { tools, user } = (req as any).body || {};
    const catalog = (tools || []).map((t: any) => ({ name: t.name, description: t.description || "", schema: t.input_schema || null }));
    const sys = `You choose a single MCP tool and JSON args for a user request. Respond with JSON only: {"name":"<tool>","args":{...}} or {"name":null,"args":{}}.`;
    const prompt = `Tools: ${safe(catalog)}\n\nUser: ${user}\n\nReturn strict JSON only.`;
    const viaOllama = await ollamaChat([
      { role: "system", content: sys },
      { role: "user", content: prompt },
    ]);
    if (viaOllama) {
      try { return res.json(JSON.parse(viaOllama)); } catch {}
    }
    // Fallback: trivial heuristic
    const u = String(user || "").toLowerCase();
    if (u.includes("title") && u.includes("http")) {
      return res.json({ name: "http.getTitle", args: { url: (u.match(/https?:[^\s]+/) || [""])[0] } });
    }
    if (u.match(/\b(add|sum|plus)\b/) && u.match(/\d/)) {
      const nums = (u.match(/-?\d+(?:\.\d+)?/g) || []).slice(0,2).map(Number);
      if (nums.length === 2) return res.json({ name: "math.add", args: { a: nums[0], b: nums[1] } });
    }
    return res.json({ name: null, args: {} });
  });

  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = createMcpExpressApp(PATH);
  app.listen(PORT, () => console.log(`[MCP] listening on http://localhost:${PORT}${PATH}`));
}
