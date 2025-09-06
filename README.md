# MCP Boilerplate

Minimal starter with:
- React client chat UI that connects to an MCP HTTP server and calls tools
- Node MCP server with a few sample tools

Monorepo structure:
- `packages/mcp-server`: Express + MCP server with sample tools
- `packages/mcp-client`: Vite + React chat UI that can list/call tools

Quick start:
- Install: `npm install` (from `mcp-boilerplate`)
- Dev server: `npm run server:dev`
- Dev client: `npm run client:dev`

Client expects the server at `http://localhost:5179/mcp` by default. Configure via `VITE_MCP_HTTP_URL`.

