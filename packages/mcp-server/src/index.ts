import express from "express";
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
  app.get(basePath, (req, res) => transport.handleRequest(req, res));
  app.post(basePath, (req, res) => transport.handleRequest(req, res, req.body));
  if (basePath !== "/") {
    app.get("/", (req, res) => transport.handleRequest(req, res));
    app.post("/", (req, res) => transport.handleRequest(req, res, req.body));
  }

  void mcp.connect(transport);
  return app;
}

if (process.env.NODE_ENV !== "test") {
  const app = createMcpExpressApp(PATH);
  app.listen(PORT, () => console.log(`[MCP] listening on http://localhost:${PORT}${PATH}`));
}

