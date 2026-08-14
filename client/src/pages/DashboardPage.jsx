import { createElement, useEffect, useState } from "react";
import {
  Activity,
  BrainCircuit,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  RefreshCw,
  Wrench,
  XCircle,
  Zap
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import AppLayout from "../components/UI/AppLayout.jsx";
import { api } from "../services/api.js";

const cards = [
  ["totalConversations", "Conversations", MessageSquare],
  ["totalTasks", "Agent tasks", BrainCircuit],
  ["successfulTasks", "Successful", CheckCircle2],
  ["failedTasks", "Failed", XCircle],
  ["agentsUsed", "Agents used", Zap],
  ["documents", "Documents", FileText],
  ["tokenUsage", "Token usage", Activity],
  ["averageResponseTimeMs", "Avg response", Clock]
];

export default function DashboardPage() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/dashboard").then((response) => setData(response.data));
  }, []);

  return (
    <AppLayout>
      <main className="h-full overflow-auto p-5 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">Operational visibility across your AI team.</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(([key, label, Icon]) => (
              <div className="metric-card" key={key}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">{label}</span>
                  {createElement(Icon, { size: 16, className: "text-violet-500" })}
                </div>
                <div className="mt-3 text-2xl font-semibold">
                  {key === "averageResponseTimeMs"
                    ? `${Math.round((data?.metrics?.[key] || 0) / 1000)}s`
                    : (data?.metrics?.[key] || 0).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="metric-card">
              <div className="flex items-center gap-2 text-xs text-zinc-500"><Wrench size={14} /> Tool calls</div>
              <div className="mt-2 text-xl font-semibold">{data?.observability?.toolCalls || 0}</div>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-2 text-xs text-zinc-500"><Clock size={14} /> Avg tool latency</div>
              <div className="mt-2 text-xl font-semibold">{data?.observability?.averageToolLatencyMs || 0} ms</div>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-2 text-xs text-zinc-500"><RefreshCw size={14} /> Retries</div>
              <div className="mt-2 text-xl font-semibold">{data?.observability?.retries || 0}</div>
            </div>
            <div className="metric-card">
              <div className="flex items-center gap-2 text-xs text-zinc-500"><XCircle size={14} /> Error events</div>
              <div className="mt-2 text-xl font-semibold">{data?.observability?.errorEvents || 0}</div>
            </div>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-2">
            <div className="panel">
              <h2 className="panel-title">Agent performance</h2>
              <div className="h-72">
                <ResponsiveContainer>
                  <BarChart data={data?.agentStats || []}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="displayName" interval={0} angle={-15} textAnchor="end" height={55} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="tasks" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel">
              <h2 className="panel-title">Recent workflows</h2>
              <div className="space-y-2">
                {data?.recentRuns?.map((run) => (
                  <div key={run.id} className="flex items-center justify-between rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{run.userRequest}</div>
                      <div className="mt-1 text-xs text-zinc-500">{new Date(run.createdAt).toLocaleString()}</div>
                    </div>
                    <span className="status-pill">{run.state}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
