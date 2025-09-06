const API_BASE = import.meta?.env?.VITE_MCP_HTTP_URL?.replace(/\/mcp$/, "") || "http://localhost:5179";

export async function summarizeTool(name: string, args: unknown, result: unknown): Promise<string> {
  try {
    const r = await fetch(`${API_BASE}/llm/summarize`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, args, result }),
    });
    const j = await r.json();
    return j?.text || "(no response)";
  } catch (e) {
    // Fallback trivial summary if server not reachable
    return `Called ${name}. Result: ${safe(args)} -> ${safe(result)}`;
  }
}

export async function planToolCall(tools: any[], userMessage: string): Promise<{ name: string | null; args: any } | null> {
  try {
    const r = await fetch(`${API_BASE}/llm/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tools, user: userMessage }),
    });
    const j = await r.json();
    return j;
  } catch {
    return null;
  }
}

function safe(v: unknown) { try { return JSON.stringify(v); } catch { return String(v); } }
