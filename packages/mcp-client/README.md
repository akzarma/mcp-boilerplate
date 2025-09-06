# @boilerplate/mcp-client

React chat UI that connects to the MCP HTTP server and can list/call tools.

Run locally:
- Dev: `npm run dev` (opens on port 5174)

Configure:
- `VITE_MCP_HTTP_URL` (default `http://localhost:5179/mcp`)

Usage:
- Type normal messages for chat context (local only)
- Use a slash command to call tools: `/tool <name> <jsonArgs>`
  - Example: `/tool math.add {"a":2, "b":3}`
  - Example: `/tool http.getTitle {"url":"https://example.com"}`
- Click “List Tools” to query the server for available tools.

