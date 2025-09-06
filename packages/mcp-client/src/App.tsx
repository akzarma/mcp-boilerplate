import { useEffect, useMemo, useRef, useState } from "react";
import { connectMcp, listTools, callTool, isMcpConnected } from "./mcp";
import "./app.css";

type Msg = { role: "user" | "assistant" | "system"; text: string };
type Attachment = {
  id: string;
  name: string;
  type: string;
  size: number;
  file?: File;
  previewUrl?: string;
  url?: string; // use if you host files elsewhere
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [tools, setTools] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        await connectMcp();
        setReady(true);
        setMessages((m) => [
          ...m,
          { role: "assistant", text: "Hi! I’m your MCP Assistant. Ask me to call tools or just chat. Try /tool <name> <json>." },
        ]);
      } catch (e) {
        setMessages((m) => [...m, { role: "system", text: `Failed to connect MCP: ${e}` }]);
      }
    })();
  }, []);

  useEffect(() => {
    const el = scrollRef.current; if (!el) return; el.scrollTop = el.scrollHeight;
  }, [messages.length, attachments.length]);

  const parseSlash = (s: string) => {
    const m = s.match(/^\s*\/tool\s+(\S+)\s+([\s\S]+)$/);
    if (!m) return null;
    const name = m[1];
    try { const args = JSON.parse(m[2]); return { name, args }; } catch { return { name, args: {} }; }
  };

  const copyText = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  const onPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items || [];
    let hasFile = false;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "file") {
        const file = it.getAsFile();
        if (file) {
          hasFile = true;
          const id = crypto.randomUUID();
          const previewUrl = URL.createObjectURL(file);
          setAttachments((prev) => [
            ...prev,
            { id, name: file.name, type: file.type, size: file.size, file, previewUrl },
          ]);
        }
      }
    }
    if (hasFile) e.preventDefault();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const id = crypto.randomUUID();
    const previewUrl = URL.createObjectURL(f);
    setAttachments((prev) => [...prev, { id, name: f.name, type: f.type, size: f.size, file: f, previewUrl }]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const att = prev.find((a) => a.id === id);
      if (att?.previewUrl) { try { URL.revokeObjectURL(att.previewUrl); } catch {}
      }
      return prev.filter((a) => a.id !== id);
    });
  };

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;
    const message = input.trim();
    const pending = attachments.slice();
    setInput("");
    setAttachments([]);
    setMessages((m) => [...m, { role: "user", text: message || "(sent attachments)" }]);

    const cmd = parseSlash(message);
    if (cmd) {
      try {
        if (!isMcpConnected()) await connectMcp();
        const out = await callTool(cmd.name, cmd.args);
        setMessages((m) => [...m, { role: "assistant", text: JSON.stringify(out, null, 2) }]);
      } catch (e) {
        setMessages((m) => [...m, { role: "assistant", text: `Error: ${e}` }]);
      }
      return;
    }

    // Local echo fallback for plain chat
    setMessages((m) => [...m, { role: "assistant", text: "(local) I received your message." }]);
  };

  const onListTools = async () => {
    try {
      if (!isMcpConnected()) await connectMcp();
      const t = await listTools();
      setTools(t);
      setMessages((m) => [...m, { role: "assistant", text: `Available tools: ${t.map((x:any)=>x.name).join(", ")}` }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: `List tools failed: ${e}` }]);
    }
  };

  const toolHint = useMemo(() => tools.map((t:any)=>`- ${t.name}${t.description?`: ${t.description}`:""}`).join("\n"), [tools]);

  const samples = [
    "Call a health check: /tool ping {}",
    "Add numbers: /tool math.add {\"a\":2,\"b\":3}",
    "What time is it? /tool time.now {}",
    "Fetch a page title: /tool http.getTitle {\"url\":\"https://example.com\"}",
  ];

  return (
    <div className="chat-root">
      <header className="chat-header">
        <div className="chat-header-left">
          <img className="avatar" src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=MCP`} alt="Assistant" />
          <div className="title">MCP Assistant</div>
        </div>
        <div className="status">Status: {ready? "connected" : "connecting..."}</div>
      </header>

      <div className="chat-body" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="intro">
            <img className="avatar small" src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=MCP`} alt="Assistant" />
            <div className="bubble assistant">Hi! I’m your MCP Assistant. Ask me to call tools or just chat. Try the examples below.</div>
          </div>
        )}

        {messages.map((m, i) => {
          const isUser = m.role === "user";
          return (
            <div key={i} className={`msg-row ${isUser?"right":"left"}`}>
              {!isUser && (
                <img className="avatar small" src={`https://api.dicebear.com/7.x/bottts-neutral/svg?seed=MCP`} alt="Assistant" />
              )}
              <div className={`bubble ${isUser?"user":"assistant"}`}>
                <pre className="pre">{m.text}</pre>
                {!isUser && (
                  <div className="bubble-actions">
                    <button className="link" onClick={() => copyText(m.text)}>Copy</button>
                  </div>
                )}
              </div>
              {isUser && (
                <div className="avatar small circle user">U</div>
              )}
            </div>
          );
        })}

        <div className="samples">
          <div className="hint">Examples</div>
          <div className="chips">
            {samples.map((s, i) => (
              <button key={i} className="chip" onClick={() => setInput(s)}>{s}</button>
            ))}
            <button className="chip ghost" onClick={() => setShowSuggestions(true)}>Show more…</button>
          </div>
          {toolHint && (
            <div className="tools">
              <div className="hint">Available tools</div>
              <pre className="pre muted">{toolHint}</pre>
            </div>
          )}
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="attachments">
          {attachments.map((a) => {
            const isImage = a.type.startsWith("image/");
            const isVideo = a.type.startsWith("video/");
            return (
              <div key={a.id} className="att-box">
                {isImage && <img className="att-media" src={a.previewUrl || a.url} alt={a.name} />}
                {isVideo && <video className="att-media" src={a.previewUrl || a.url} muted />}
                {!isImage && !isVideo && <div className="att-fallback">{a.name}</div>}
                <button className="att-remove" onClick={() => removeAttachment(a.id)} aria-label={`Remove ${a.name}`}>×</button>
              </div>
            );
          })}
        </div>
      )}

      <div className="chat-input">
        <textarea
          placeholder="Type a message or /tool <name> <json> (paste images/videos too)"
          value={input}
          rows={1}
          className="ta"
          onChange={(e)=>setInput(e.target.value)}
          onPaste={onPaste}
          onInput={(e)=>{
            const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 128)+"px";
          }}
          onKeyDown={(e)=>{ if(e.key==="Enter" && !e.shiftKey){ e.preventDefault(); handleSend(); } }}
        />
        <input type="file" className="hidden" accept="image/*,video/*,audio/*" ref={fileInputRef} onChange={onFileChange} />
        <button className="btn ghost" onClick={() => fileInputRef.current?.click()}>Attach</button>
        <button className="btn primary" onClick={handleSend} disabled={!input.trim() && attachments.length===0}>Send</button>
        <button className="btn" onClick={onListTools}>List Tools</button>
      </div>

      {showSuggestions && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-box">
            <div className="modal-header">
              <div className="modal-title">Try these ideas</div>
              <button className="btn ghost" onClick={()=>setShowSuggestions(false)}>Close</button>
            </div>
            <div className="modal-body">
              <div className="hint">Basics</div>
              <div className="chips">
                {samples.map((s, i) => (
                  <button key={`b-${i}`} className="chip" onClick={()=>{ setInput(s); setShowSuggestions(false); }}>{s}</button>
                ))}
              </div>
              <div className="hint">Advanced</div>
              <div className="chips scroll">
                {[
                  "Call ping + math: /tool ping {} and /tool math.add {\"a\":5,\"b\":7}",
                  "Chain: /tool time.now {} then /tool echo {\"message\":\"Use this time\"}",
                  "Fetch title: /tool http.getTitle {\"url\":\"https://news.ycombinator.com\"}",
                ].map((t, i) => (
                  <button key={`a-${i}`} className="chip" onClick={()=>{ setInput(t); setShowSuggestions(false); }}>{t}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
