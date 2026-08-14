import { Bot, Plus, Send, Sparkles, Trash2, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Shell from "../components/Shell.jsx";
import { api } from "../api.js";

export default function ChatPage() {
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [models, setModels] = useState([]);
  const [model, setModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);
  async function loadConversations() { const data = await api("/conversations"); setConversations(data.conversations); }
  useEffect(() => {
    Promise.all([
      loadConversations(),
      api("/models").then((data) => { setModels(data.models); setModel(data.defaultModel); }),
    ]).catch((caught) => setError(caught.message));
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  async function openConversation(id) { setConversationId(id); const data = await api(`/conversations/${id}/messages`); setMessages(data.messages); }
  async function removeConversation(id) { await api(`/conversations/${id}`, { method: "DELETE" }); if (conversationId === id) { setConversationId(null); setMessages([]); } await loadConversations(); }
  async function send(event) {
    event.preventDefault(); const text = input.trim(); if (!text || busy) return;
    setBusy(true); setError(""); setInput(""); setMessages((current) => [...current, { id: `local-${Date.now()}`, role: "user", content: text }]);
    try { const data = await api("/chat", { method: "POST", body: JSON.stringify({ conversationId: conversationId || undefined, message: text, model: model || undefined }) }); setConversationId(data.conversationId); setMessages((current) => [...current, data.message]); await loadConversations(); }
    catch (caught) { setError(caught.message); } finally { setBusy(false); }
  }
  return <Shell><div className="chat-layout"><aside className="conversation-panel"><div className="panel-heading"><div><span className="eyebrow">History</span><h2>Conversations</h2></div><button className="icon-button" aria-label="New conversation" onClick={() => { setConversationId(null); setMessages([]); }}><Plus /></button></div><div className="conversation-list">{conversations.length ? conversations.map((conversation) => <div className={`conversation-row ${Number(conversation.id) === Number(conversationId) ? "selected" : ""}`} key={conversation.id}><button onClick={() => openConversation(conversation.id)}><strong>{conversation.title}</strong><small>{new Date(conversation.updatedAt).toLocaleDateString()}</small></button><button className="delete-button" aria-label={`Delete ${conversation.title}`} onClick={() => removeConversation(conversation.id)}><Trash2 size={15} /></button></div>) : <p className="muted empty-list">No conversations yet.</p>}</div></aside><section className="chat-main"><header className="page-header"><div><span className="eyebrow">Agent workspace</span><h1>{conversationId ? "Continue the work" : "What should the team solve?"}</h1></div><div className="chat-header-actions"><label className="model-picker"><span>Model</span><select aria-label="Select AI model" value={model} onChange={(event) => setModel(event.target.value)} disabled={busy || !models.length}>{models.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}{entry.free ? " · Free" : ""}</option>)}</select></label><span className="live-pill"><span /> 7 agents ready</span></div></header><div className="messages">{messages.length ? messages.map((message) => <article className={`message ${message.role}`} key={message.id}><span className="message-avatar">{message.role === "user" ? <UserRound size={18} /> : <Bot size={18} />}</span><div><strong>{message.role === "user" ? "You" : "Nexora Core"}</strong><p>{message.content}</p></div></article>) : <div className="chat-empty"><span className="hero-orb"><Sparkles /></span><h2>Build with a coordinated AI team</h2><p>Ask for research, analysis, code, planning, writing, or a decision. Nexora coordinates the right specialists around your goal.</p><div className="prompt-grid">{["Plan a product launch", "Review a technical decision", "Turn notes into a brief", "Research a market"].map((prompt) => <button key={prompt} onClick={() => setInput(prompt)}>{prompt}</button>)}</div></div>}<div ref={endRef} /></div>{error ? <div className="inline-error">{error}</div> : null}<form className="composer" onSubmit={send}><textarea aria-label="Message Nexora" rows={1} placeholder="Give your AI team a goal…" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} /><button className="send-button" disabled={busy || !input.trim()} aria-label="Send message">{busy ? <span className="spinner" /> : <Send size={18} />}</button></form></section></div></Shell>;
}
