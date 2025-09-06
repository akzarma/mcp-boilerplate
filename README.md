# MCP Boilerplate — React MCP Chat UI + Custom Toolset Server

![CI](https://github.com/akzarma/mcp-boilerplate/actions/workflows/ci.yml/badge.svg)

Production‑ready starter that pairs a React chat UI with a Node.js Model Context Protocol (MCP) server. Use this to build agentic UIs that can discover and call your custom tools over a simple HTTP transport.

What you get
- React‑based MCP chat UI: List tools, call tools via slash‑commands, render JSON responses.
- Node.js MCP server: Express + `@modelcontextprotocol/sdk` with a handful of sample tools (echo, math, time, web title fetch).
- TypeScript throughout: Strict types and clean build steps.
- Minimal, extensible architecture: Clear separation of concerns so you can add tools or swap UI pieces without friction.
- CI ready: GitHub Actions workflow that installs, builds, and type‑checks both packages.

Why this is useful
- Fast path to prototyping: Spin up a working MCP client/server in minutes.
- Great for custom toolsets: Add domain‑specific tools (APIs, DB queries, file ops) and call them from an LLM‑assisted chat.
- Search‑friendly structure and terms: “React MCP chat UI”, “MCP custom tools”, “Node MCP server”, “TypeScript boilerplate”, “tool calling”.
- Simple deploy story: The server is just an Express app; the client is a static Vite build.

Architecture
- `packages/mcp-server`: Express app exposing an MCP HTTP endpoint using `StreamableHTTPServerTransport`.
  - Tools implemented with Zod‑validated arguments.
  - Returns JSON in MCP content blocks for easy client parsing.
- `packages/mcp-client`: Vite + React SPA connecting with `StreamableHTTPClientTransport`.
  - Lists tools and calls them using slash commands: `/tool <name> <jsonArgs>`.

Quick start
- Install deps: `npm install` (run at the repo root)
- Start server (http://localhost:5179/mcp): `npm run server:dev`
- Start client (http://localhost:5174): `npm run client:dev`

Configuration
- Client MCP URL: `VITE_MCP_HTTP_URL` (default `http://localhost:5179/mcp`)
- Server port/path: `MCP_PORT` (default `5179`), `MCP_PATH` (default `/mcp`)

Sample tools included
- `ping`: health check
- `echo`: echoes a message
- `math.add`: adds two numbers
- `time.now`: current ISO timestamp
- `http.getTitle`: fetches a page and extracts the `<title>`

Calling tools from the UI
- Click “List Tools” to see what the server exposes
- Use slash commands in the input box:
  - `/tool math.add {"a":2,"b":3}`
  - `/tool http.getTitle {"url":"https://example.com"}`

Add your own MCP tools
1) Create a tool in `packages/mcp-server/src/index.ts`:
```
mcp.tool(
  "my.coolTool",
  "Say hello to a name",
  { name: z.string() },
  async ({ name }) => ({ content: [{ type: "text", text: JSON.stringify({ hello: name }) }] })
);
```
2) Restart the server and click “List Tools” in the UI.

Integrating with LLMs / agents
- This repo shows the transport and UI patterns for MCP. You can wire this UI or server into your agent stack (e.g., OpenAI, Vercel AI SDK, LangChain) to let models discover and call tools.

Monorepo scripts
- `npm run dev`: start client and server together
- `npm run server:dev`: start only the MCP server
- `npm run client:dev`: start only the React client
- `npm run build`: build both packages

License
- MIT — see `LICENSE`.

