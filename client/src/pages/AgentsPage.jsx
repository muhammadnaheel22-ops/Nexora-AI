import { Activity, BrainCircuit, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import Shell from "../components/Shell.jsx";
import Loading from "../components/Loading.jsx";
import { api } from "../api.js";

export default function AgentsPage() {
  const [data, setData] = useState(null); const [error, setError] = useState("");
  useEffect(() => { api("/agents").then(setData).catch((caught) => setError(caught.message)); }, []);
  return <Shell><div className="page"><header className="page-header"><div><span className="eyebrow">Team</span><h1>Specialists, coordinated</h1><p>Seven focused roles working through Nexora Core.</p></div><span className="live-pill"><span /> System ready</span></header>{error ? <div className="alert">{error}</div> : null}{!data ? <Loading /> : <><section className="agent-grid">{data.team.map((agent, index) => <article className="agent-card" key={agent.name}><span className="agent-number">0{index + 1}</span><span className="agent-icon"><BrainCircuit /></span><small>{agent.role}</small><h2>{agent.name}</h2><p>{agent.description}</p><span className="status-line"><CheckCircle2 size={14} /> Available</span></article>)}</section><section className="surface activity"><div className="section-title"><div><span className="eyebrow">Live log</span><h2>Recent agent activity</h2></div><Activity /></div>{data.events.length ? data.events.map((event) => <div className="event-row" key={event.id}><span className={`event-dot ${event.status}`} /><strong>{event.agent}</strong><span>{event.detail}</span><small>{new Date(event.createdAt).toLocaleString()}</small></div>) : <p className="muted">No agent activity yet.</p>}</section></>}</div></Shell>;
}
