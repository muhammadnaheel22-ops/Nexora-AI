import { Background, Controls, Handle, MarkerType, Position, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CheckCircle2, Clock3, LoaderCircle, XCircle } from "lucide-react";

const agentLabels = {
  core: "Nexora Core",
  scout: "Nexora Scout",
  logic: "Nexora Logic",
  forge: "Nexora Forge",
  memory: "Nexora Memory",
  scribe: "Nexora Scribe",
  sentinel: "Nexora Sentinel",
  final: "Final Response"
};

const positions = {
  core: { x: 240, y: 0 },
  scout: { x: 0, y: 145 },
  logic: { x: 160, y: 145 },
  forge: { x: 320, y: 145 },
  memory: { x: 480, y: 145 },
  scribe: { x: 240, y: 300 },
  sentinel: { x: 240, y: 445 },
  final: { x: 240, y: 590 }
};

function statusIcon(status) {
  if (status === "COMPLETED") return <CheckCircle2 size={13} />;
  if (["FAILED", "TIMEOUT", "CANCELLED"].includes(status)) return <XCircle size={13} />;
  if (status === "RUNNING") return <LoaderCircle className="animate-spin" size={13} />;
  return <Clock3 size={13} />;
}

function AgentNode({ data }) {
  return <div className={`workflow-node ${data.status === "RUNNING" ? "workflow-active" : ""}`}>
    <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-violet-500/60" />
    <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-violet-500/60" />
    <div className="flex items-center justify-between gap-3"><b>{data.label}</b><span className="text-zinc-500">{statusIcon(data.status)}</span></div>
    <div className="mt-1 line-clamp-2 min-h-7 text-[10px] leading-3 text-zinc-500">{data.task || data.status}</div>
    <div className="mt-2 flex flex-wrap gap-1 text-[9px] text-zinc-500">
      {data.executionMs != null && <span>{(data.executionMs / 1000).toFixed(1)}s</span>}
      {data.tokenUsage != null && <span>· {data.tokenUsage} tok</span>}
      {data.toolCalls > 0 && <span>· {data.toolCalls} tools</span>}
    </div>
    {data.dependencies?.length > 0 && <div className="mt-1 truncate text-[9px] text-zinc-600">deps: {data.dependencies.join(", ")}</div>}
  </div>;
}
const nodeTypes = { agent: AgentNode };

export default function WorkflowPanel({ activities = [] }) {
  const ids = ["core", "scout", "logic", "forge", "memory", "scribe", "sentinel", "final"];
  const meta = Object.fromEntries(ids.map((name) => [name, { status: "PENDING", toolCalls: 0 }]));
  for (const event of activities) {
    if (event.agent && meta[event.agent] && event.type === "agent_started") {
      meta[event.agent].status = "RUNNING";
      meta[event.agent].task = event.data?.objective;
      meta[event.agent].dependencies = event.data?.dependencies || [];
    }
    if (event.agent && meta[event.agent] && event.type === "agent_completed") {
      meta[event.agent].status = "COMPLETED";
      meta[event.agent].executionMs = event.data?.executionMs;
      meta[event.agent].tokenUsage = event.data?.tokenUsage;
    }
    if (event.agent && meta[event.agent] && event.type === "review_completed") {
      meta[event.agent].status = "COMPLETED";
      meta[event.agent].executionMs = event.data?.executionMs;
      meta[event.agent].task = `Review score ${event.data?.score ?? "—"}`;
    }
    if (event.agent && meta[event.agent] && event.type === "agent_failed") meta[event.agent].status = "FAILED";
    if (event.agent && meta[event.agent] && event.type === "tool_call") meta[event.agent].toolCalls += 1;
    if (event.type === "finalizing") meta.core.status = "RUNNING";
    if (event.type === "state_changed" && event.data?.state === "COMPLETED") {
      meta.core.status = "COMPLETED";
      meta.final.status = "COMPLETED";
      meta.final.task = "Response delivered";
    }
  }
  const nodes = ids.map((id) => ({ id, type: "agent", position: positions[id], data: { label: agentLabels[id], ...meta[id] } }));
  const arrow = { markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 } };
  const edges = [
    ...["scout", "logic", "forge", "memory"].map((target) => ({ id: `core-${target}`, source: "core", target, ...arrow })),
    ...["scout", "logic", "forge", "memory"].map((source) => ({ id: `${source}-scribe`, source, target: "scribe", ...arrow })),
    { id: "scribe-sentinel", source: "scribe", target: "sentinel", ...arrow },
    { id: "sentinel-final", source: "sentinel", target: "final", ...arrow }
  ];
  return <div className="h-[680px] overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
    <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView panOnScroll zoomOnScroll={false} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false}>
      <Background gap={18} /><Controls showInteractive={false} />
    </ReactFlow>
  </div>;
}
