import { Bot, FileText, MessageSquare, MessagesSquare } from "lucide-react";
import { createElement, useEffect, useState } from "react";
import Shell from "../components/Shell.jsx";
import Loading from "../components/Loading.jsx";
import { api } from "../api.js";

const metrics = [["conversations", "Conversations", MessageSquare], ["messages", "Messages", MessagesSquare], ["documents", "Documents", FileText]];
export default function DashboardPage() {
  const [data, setData] = useState(null); const [error, setError] = useState("");
  useEffect(() => { api("/dashboard").then(setData).catch((caught) => setError(caught.message)); }, []);
  return <Shell><div className="page"><header className="page-header"><div><span className="eyebrow">Overview</span><h1>Dashboard</h1><p>Activity across your Nexora workspace.</p></div></header>{error ? <div className="alert">{error}</div> : null}{!data ? <Loading /> : <><section className="metric-grid">{metrics.map(([key, label, Icon]) => <article className="metric" key={key}><span>{createElement(Icon, { size: 20 })}</span><small>{label}</small><strong>{Number(data.metrics[key] || 0).toLocaleString()}</strong></article>)}</section><section className="dashboard-grid"><article className="surface"><div className="section-title"><div><span className="eyebrow">Recent</span><h2>Conversations</h2></div></div>{data.recent.length ? data.recent.map((item) => <div className="list-row" key={item.id}><span className="row-icon"><MessageSquare size={16} /></span><div><strong>{item.title}</strong><small>{new Date(item.updatedAt).toLocaleString()}</small></div></div>) : <p className="muted">Start a conversation to see activity here.</p>}</article><article className="surface"><div className="section-title"><div><span className="eyebrow">Execution</span><h2>Agent activity</h2></div></div>{data.agents.length ? data.agents.map((item) => <div className="list-row" key={`${item.agent}-${item.status}`}><span className="row-icon"><Bot size={16} /></span><div><strong>{item.agent}</strong><small>{item.status}</small></div><b>{item.value}</b></div>) : <p className="muted">Agent events appear after your first message.</p>}</article></section></>}</div></Shell>;
}
