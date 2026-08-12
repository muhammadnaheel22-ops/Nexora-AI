import { generateStructured, streamText, usageTotal } from "../services/aiService.js";
import { executionPlanSchema } from "./contracts.js";
import { CORE_SYSTEM, FINALIZER_SYSTEM } from "./prompts.js";
import { agentToolPermissions } from "../tools/registry.js";

function fallbackPlan(userRequest, documentIds = []) {
  const tasks = [];
  if (documentIds.length) {
    tasks.push({ id: "memory", agent: "memory", objective: `Retrieve relevant uploaded-document and memory context for: ${userRequest}`, dependencies: [], tools: ["fileSearch"] });
  }
  tasks.push({ id: "research", agent: "scout", objective: `Research and gather evidence needed for: ${userRequest}`, dependencies: [], tools: ["webSearch", "fileSearch"] });
  tasks.push({ id: "analysis", agent: "logic", objective: `Analyze the available evidence and derive the most useful insights for: ${userRequest}`, dependencies: documentIds.length ? ["memory", "research"] : ["research"], tools: ["calculator", "fileSearch", "database"] });
  tasks.push({ id: "write", agent: "scribe", objective: `Create the user-facing deliverable for: ${userRequest}`, dependencies: tasks.map((t) => t.id), tools: [] });
  return { goal: userRequest, strategy: "hybrid", tasks, finalFormat: "Polished Markdown matching the user's request" };
}

function isAcyclic(tasks) {
  const ids = new Set(tasks.map((t) => t.id));
  const resolved = new Set();
  const remaining = new Map(tasks.map((t) => [t.id, t]));
  while (remaining.size) {
    const ready = [...remaining.values()].filter((task) => task.dependencies.every((dep) => ids.has(dep) && resolved.has(dep)));
    if (!ready.length) return false;
    for (const task of ready) { resolved.add(task.id); remaining.delete(task.id); }
  }
  return true;
}

function sanitizePlan(plan, userRequest, documentIds) {
  const unique = [];
  const seen = new Set();
  for (const task of plan.tasks) {
    let id = task.id.trim().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || `task-${unique.length + 1}`;
    while (seen.has(id)) id = `${id}-${unique.length + 1}`;
    seen.add(id);
    const allowed = new Set(agentToolPermissions[task.agent] || []);
    unique.push({ ...task, id, dependencies: task.dependencies.filter((d) => d !== id), tools: task.tools.filter((tool) => allowed.has(tool)) });
  }
  const ids = new Set(unique.map((t) => t.id));
  for (const task of unique) task.dependencies = [...new Set(task.dependencies.filter((dep) => ids.has(dep)))];
  if (!unique.some((t) => t.agent === "scribe")) {
    unique.push({ id: "final-writing", agent: "scribe", objective: `Create the user-facing deliverable for: ${userRequest}`, dependencies: unique.map((t) => t.id), tools: [] });
  }
  return isAcyclic(unique) ? { ...plan, tasks: unique } : fallbackPlan(userRequest, documentIds);
}

export const nexoraCoreAgent = {
  name: "core",
  async createPlan({ userRequest, conversationMemory, longTermMemory, documentIds = [], signal }) {
    try {
      const response = await generateStructured({
        schema: executionPlanSchema,
        schemaName: "nexora execution plan",
        signal,
        messages: [
          { role: "system", content: CORE_SYSTEM },
          { role: "user", content: [
            `User request:\n${userRequest}`,
            `Recent conversation context:\n${JSON.stringify(conversationMemory).slice(0, 12000)}`,
            `Long-term memory/context:\n${JSON.stringify(longTermMemory).slice(0, 6000)}`,
            `Selected uploaded document IDs:\n${JSON.stringify(documentIds)}`,
            `Required task agents: scout|logic|forge|scribe|memory. Sentinel is system-managed and must not be planned.`,
            `Required JSON shape:\n{\n  "goal":"...",\n  "strategy":"sequential|parallel|hybrid",\n  "tasks":[{"id":"unique-id","agent":"scout|logic|forge|scribe|memory","objective":"...","dependencies":["other-task-id"],"tools":["webSearch|calculator|fileSearch|database"]}],\n  "finalFormat":"..."\n}`
          ].join("\n\n") }
        ]
      });
      return { plan: sanitizePlan(response.data, userRequest, documentIds), tokenUsage: usageTotal(response.usage) };
    } catch (error) {
      if (error.code === "AI_NOT_CONFIGURED") throw error;
      return { plan: fallbackPlan(userRequest, documentIds), tokenUsage: 0, fallbackReason: error.message };
    }
  },
  async finalize({ userRequest, results, draft, review, onToken, signal }) {
    return streamText({
      messages: [
        { role: "system", content: FINALIZER_SYSTEM },
        { role: "user", content: [
          `Original request:\n${userRequest}`,
          `Specialist results:\n${JSON.stringify(results, null, 2).slice(0, 30000)}`,
          `Nexora Scribe draft:\n${String(draft || "").slice(0, 30000)}`,
          `Nexora Sentinel review:\n${JSON.stringify(review, null, 2).slice(0, 10000)}`,
          "Return only the final answer for the user."
        ].join("\n\n") }
      ],
      onToken,
      signal
    });
  }
};
