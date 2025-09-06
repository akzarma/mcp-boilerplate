import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

let client: Client | null = null;

export async function connectMcp(url = (import.meta as any).env?.VITE_MCP_HTTP_URL || "http://localhost:5179/mcp") {
  if (client) return client;
  const transport = new StreamableHTTPClientTransport(new URL(url));
  client = new Client(
    { name: "mcp-chat-ui", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  await client.connect(transport as any);
  return client;
}

export function isMcpConnected() { return !!client; }

export async function listTools(): Promise<any[]> {
  if (!client) throw new Error("MCP not connected");
  try {
    // @ts-ignore
    const res = await (client as any).listTools?.({});
    if (res?.tools) return res.tools;
  } catch {}
  // @ts-ignore raw request fallback
  const raw = await (client as any).request?.({ method: "tools/list", params: {} });
  return raw?.tools || [];
}

export async function callTool(name: string, args: unknown): Promise<any> {
  if (!client) throw new Error("MCP not connected");
  const res = await client.callTool({ name, arguments: args, timeout: 60_000 });
  const first = (res as any)?.content?.[0];
  if (first?.type === "text") {
    const t = first.text as string;
    try { return JSON.parse(t); } catch { return t; }
  }
  return res as any;
}

