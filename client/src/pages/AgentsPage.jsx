import { useEffect, useState } from "react";
import { Bot, BrainCircuit, Database, Hammer, Network, PenLine, Search, ShieldCheck } from "lucide-react";
import AppLayout from "../components/UI/AppLayout.jsx";
import { api } from "../services/api.js";
import { useAuth } from "../context/AuthContext.jsx";

const icons = { core: Network, scout: Search, logic: BrainCircuit, forge: Hammer, scribe: PenLine, sentinel: ShieldCheck, memory: Database };
const tools = { core: [], scout: ["Web Search", "File Search"], logic: ["Calculator", "File Search", "Database Stats"], forge: ["Calculator", "File Search", "Database Stats"], scribe: ["File Search"], sentinel: [], memory: ["File Search", "Database Stats"] };
const fallbackNames = { core: "Nexora Core", scout: "Nexora Scout", logic: "Nexora Logic", forge: "Nexora Forge", scribe: "Nexora Scribe", sentinel: "Nexora Sentinel", memory: "Nexora Memory" };

export default function AgentsPage() {
  const [agents, setAgents] = useState([]);
  const { user } = useAuth();
  async function load() { setAgents((await api.get("/agents")).data.agents); }
  useEffect(() => { load(); }, []);
  async function update(name, patch) {
    const response = await api.patch(`/agents/${name}`, patch);
    setAgents((current) => current.map((agent) => agent.name === name ? { ...agent, ...response.data.agent } : agent));
  }
  return <AppLayout><main className="h-full overflow-auto p-5 lg:p-8"><div className="mx-auto max-w-7xl">
    <h1 className="text-2xl font-semibold">Agent Management</h1>
    <p className="mt-1 text-sm text-zinc-500">Seven specialized Nexora agents with explicit responsibilities, structured contracts, and permission-scoped tools.</p>
    {user?.role === "admin" && <div className="mt-4 rounded-xl border border-violet-500/20 bg-violet-500/10 p-3 text-sm text-violet-700 dark:text-violet-300">Administrator controls are enabled. Changes affect new agent executions immediately.</div>}
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => { const Icon = icons[agent.name] || Bot; return <div className="panel" key={agent.name}>
        <div className="flex items-start justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/10 text-violet-500"><Icon size={19}/></div><span className={`status-pill ${agent.enabled === false ? "opacity-50" : ""}`}>{agent.enabled === false ? "Disabled" : "Active"}</span></div>
        <h2 className="mt-4 font-semibold">{agent.displayName || fallbackNames[agent.name] || agent.name}</h2>
        <div className="mt-1 text-xs font-medium text-violet-500">{agent.role}</div>
        <p className="mt-2 min-h-20 text-sm leading-6 text-zinc-500">{agent.description}</p>
        <div className="mt-4"><div className="text-xs font-medium">Role tools</div><div className="mt-2 flex flex-wrap gap-1.5">{tools[agent.name]?.length ? tools[agent.name].map((tool) => <span key={tool} className="chip">{tool}</span>) : <span className="text-xs text-zinc-500">No direct tools</span>}</div></div>
        <div className="mt-5 grid grid-cols-2 gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"><div><div className="text-xs text-zinc-500">Tasks</div><div className="font-semibold">{agent.tasks || 0}</div></div><div><div className="text-xs text-zinc-500">Success rate</div><div className="font-semibold">{agent.successRate || 0}%</div></div></div>
        {user?.role === "admin" && <div className="mt-4 space-y-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800"><label className="flex items-center justify-between gap-4 text-xs"><span>Enabled</span><input type="checkbox" checked={agent.enabled !== false} onChange={(e) => update(agent.name, { enabled: e.target.checked })}/></label><label className="block text-xs"><span className="mb-1.5 block">Maximum tool calls per task</span><input className="input" type="number" min="0" max="6" value={agent.maxTools ?? 0} onChange={(e) => update(agent.name, { maxTools: Number(e.target.value) })}/></label></div>}
      </div>; })}
    </div>
  </div></main></AppLayout>;
}
