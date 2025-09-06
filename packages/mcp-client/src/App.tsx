import { useEffect, useMemo, useRef, useState } from "react";
import { connectMcp, listTools, callTool, isMcpConnected } from "./mcp";

type Msg = { role: "user" | "assistant" | "system"; text: string };

export default function App() {
  const [ready, setReady] = useState(false);
  const [tools, setTools] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([{
    role: "system",
    text: "Connected UI. Use /tool <name> <jsonArgs> to call tools.",
  }]);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      try {
        await connectMcp();
        setReady(true);
      } catch (e) {
        setMessages((m) => [...m, { role: "system", text: `Failed to connect MCP: ${e}` }]);
      }
    })();
  }, []);

  useEffect(() => {
    const el = boxRef.current; if (!el) return; el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const parseSlash = (s: string) => {
    const m = s.match(/^\s*\/tool\s+(\S+)\s+([\s\S]+)$/);
    if (!m) return null;
    const name = m[1];
    try { const args = JSON.parse(m[2]); return { name, args }; } catch { return { name, args: {} }; }
  };

  const onSend = async () => {
    const text = input.trim(); if (!text) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    const cmd = parseSlash(text);
    if (cmd) {
      if (!isMcpConnected()) await connectMcp();
      try {
        const out = await callTool(cmd.name, cmd.args);
        setMessages((m) => [...m, { role: "assistant", text: JSON.stringify(out, null, 2) }]);
      } catch (e) {
        setMessages((m) => [...m, { role: "assistant", text: `Error: ${e}` }]);
      }
      return;
    }
    // Simple local echo assistant fallback
    setMessages((m) => [...m, { role: "assistant", text: "(local) You said: " + text }]);
  };

  const onListTools = async () => {
    try {
      if (!isMcpConnected()) await connectMcp();
      const t = await listTools();
      setTools(t);
      setMessages((m) => [...m, { role: "assistant", text: `Tools: ${t.map((x:any)=>x.name).join(", ")}` }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: `List tools failed: ${e}` }]);
    }
  };

  const toolHint = useMemo(() => tools.map((t:any)=>`- ${t.name}${t.description?`: ${t.description}`:""}`).join("\n"), [tools]);

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ width: 320, borderRight: "1px solid #eee", padding: 16 }}>
        <h2>MCP Chat</h2>
        <div style={{ fontSize: 12, color: ready?"#0a0":"#a00" }}>Status: {ready?"connected":"connecting..."}</div>
        <div style={{ marginTop: 16 }}>
          <button onClick={onListTools}>List Tools</button>
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 600 }}>Slash command</div>
          <code>/tool &lt;name&gt; &lt;json&gt;</code>
          <div style={{ fontSize: 12, marginTop: 8 }}>Examples:</div>
          <pre style={{ background: "#f7f7f7", padding: 8, fontSize: 12 }}>
            {`/tool math.add {"a":2,"b":3}
/tool http.getTitle {"url":"https://example.com"}`}
          </pre>
          {toolHint && (
            <div>
              <div style={{ fontWeight: 600, marginTop: 8 }}>Available tools</div>
              <pre style={{ background: "#f7f7f7", padding: 8, fontSize: 12, maxHeight: 200, overflow: "auto" }}>{toolHint}</pre>
            </div>
          )}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div ref={boxRef} style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ margin: "8px 0" }}>
              <div style={{ fontSize: 12, color: "#666" }}>{m.role}</div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{m.text}</pre>
            </div>
          ))}
        </div>
        <div style={{ padding: 16, borderTop: "1px solid #eee", display: "flex", gap: 8 }}>
          <input
            style={{ flex: 1, padding: 8, border: "1px solid #ddd", borderRadius: 6 }}
            value={input}
            onChange={(e)=>setInput(e.target.value)}
            placeholder="Type a message or /tool <name> <json>"
            onKeyDown={(e)=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); onSend(); } }}
          />
          <button onClick={onSend}>Send</button>
        </div>
      </div>
    </div>
  );
}
