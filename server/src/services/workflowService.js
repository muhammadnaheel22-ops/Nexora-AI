import { query, transaction } from "../config/database.js";
import { env } from "../config/env.js";
import { agentDisplay, agentDbValue } from "../agents/names.js";
import { getConversationMemory, getLongTermMemory } from "./memoryService.js";
import { setWorkflowState, persistAndEmit } from "./workflowEventService.js";
import { withTimeout } from "../utils/timeout.js";
import { AppError, TimeoutError } from "../utils/errors.js";
import { nexoraCoreAgent } from "../agents/nexoraCore.js";
import { nexoraSentinelAgent } from "../agents/nexoraSentinel.js";
import { getAgent } from "../agents/index.js";
import { getAgentConfig } from "./agentConfigService.js";

const TASK_STATUS = new Set(["pending", "running", "completed", "failed", "retrying", "cancelled", "timeout"]);
const RUN_STATUS = new Set(["running", "completed", "failed", "cancelled", "timeout"]);
const asTaskStatus = (value) => {
  const status = String(value || "pending").toLowerCase();
  return TASK_STATUS.has(status) ? status : "failed";
};
const asRunStatus = (value) => {
  const status = String(value || "running").toLowerCase();
  return RUN_STATUS.has(status) ? status : "failed";
};
const json = (value) => value === undefined || value === null ? null : JSON.stringify(value);

export function getReadyTasks(tasks, completed) {
  return tasks.filter((task) => !completed.has(task.id) && task.dependencies.every((dep) => completed.has(dep)));
}

function dependencyContext(task, results, sharedContext = {}) {
  const upstream = Object.fromEntries(
    task.dependencies.filter((dep) => results.has(dep)).map((dep) => [dep, results.get(dep)]),
  );
  return task.agent === "memory" ? { ...upstream, ...sharedContext } : upstream;
}

function usageParts(usage, fallbackTotal = 0) {
  const inputTokens = Number(usage?.prompt_tokens ?? usage?.input_tokens ?? usage?.inputTokens ?? 0);
  const outputTokens = Number(usage?.completion_tokens ?? usage?.output_tokens ?? usage?.outputTokens ?? 0);
  const tokenUsage = Number(usage?.total_tokens ?? usage?.totalTokens ?? fallbackTotal ?? inputTokens + outputTokens);
  return { inputTokens, outputTokens, tokenUsage };
}

async function createTask({ workflowRunId, conversationId, agent, taskKey, objective, dependencies = [], status = "pending", attempt = 0 }) {
  const result = await query(
    `INSERT INTO agent_tasks
      (workflow_run_id, conversation_id, task_key, agent_name, task, dependencies, status, attempt, started_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      workflowRunId,
      conversationId,
      taskKey,
      agentDbValue(agent),
      objective,
      json(dependencies),
      asTaskStatus(status),
      attempt,
      asTaskStatus(status) === "running" ? new Date() : null,
    ],
  );
  return { id: result.insertId, workflowRunId, conversationId, agentName: agentDbValue(agent), taskKey, task: objective, dependencies, status: asTaskStatus(status), attempt };
}

async function updateTask(id, data = {}) {
  const sets = [];
  const values = [];
  if ("status" in data) { sets.push("status = ?"); values.push(asTaskStatus(data.status)); }
  if ("attempt" in data) { sets.push("attempt = ?"); values.push(data.attempt); }
  if ("startedAt" in data) { sets.push("started_at = ?"); values.push(data.startedAt); }
  if ("completedAt" in data) { sets.push("completed_at = ?"); values.push(data.completedAt); }
  if ("errorMessage" in data) { sets.push("error_message = ?"); values.push(data.errorMessage); }
  if ("result" in data) { sets.push("result = ?"); values.push(json(data.result)); }
  if (!sets.length) return;
  sets.push("updated_at = NOW()");
  values.push(id);
  await query(`UPDATE agent_tasks SET ${sets.join(", ")} WHERE id = ?`, values);
}

async function createRun(taskId, agent) {
  const result = await query(
    `INSERT INTO agent_runs (task_id, agent_name, status, started_at, created_at)
     VALUES (?, ?, 'running', NOW(), NOW())`,
    [taskId, agentDbValue(agent)],
  );
  return { id: result.insertId, taskId, agentName: agentDbValue(agent), status: "running" };
}

async function finishRun(runId, { status, started, response = null, errorMessage = null }) {
  const usage = usageParts(response?.usage, response?.tokenUsage || 0);
  await query(
    `UPDATE agent_runs SET status = ?, execution_time_ms = ?, input_tokens = ?, output_tokens = ?, token_usage = ?, error_message = ?, completed_at = NOW() WHERE id = ?`,
    [asRunStatus(status), Date.now() - started, usage.inputTokens, usage.outputTokens, usage.tokenUsage, errorMessage, runId],
  );
}

async function executeAgentTask({ task, record, results, userId, workflowRunId, documentIds, emit, signal, reviewFeedback = null, sharedContext = {} }) {
  const config = await getAgentConfig(task.agent);
  if (config.enabled === false) throw new AppError(`${config.displayName || agentDisplay(task.agent)} is disabled`, 503, "AGENT_DISABLED");
  const agent = getAgent(task.agent);
  let lastError;

  for (let attempt = (record.attempt || 0) + 1; attempt <= env.MAX_AGENT_RETRIES + 1; attempt += 1) {
    if (signal?.aborted) throw new AppError("Workflow cancelled", 499, "CANCELLED");

    await updateTask(record.id, { status: "running", attempt, startedAt: new Date(), errorMessage: null });
    const run = await createRun(record.id, task.agent);
    await persistAndEmit({ workflowRunId, type: "agent_started", agent: task.agent, message: `${agentDisplay(task.agent)} started`, data: { taskId: task.id, attempt }, emit });
    const started = Date.now();

    try {
      const response = await withTimeout(
        (timeoutSignal) => agent.run({
          task: task.objective,
          context: dependencyContext(task, results, sharedContext),
          documentIds,
          allowedTools: task.tools || [],
          agentRunId: run.id,
          workflowRunId,
          userId,
          emit,
          signal: timeoutSignal,
          reviewFeedback,
        }),
        env.AGENT_TIMEOUT_MS,
        `${agentDisplay(task.agent)} agent`,
        signal,
      );

      results.set(task.id, response.output);
      await updateTask(record.id, { status: "completed", result: response.output, completedAt: new Date() });
      await finishRun(run.id, { status: "completed", started, response });
      await persistAndEmit({ workflowRunId, type: "agent_completed", agent: task.agent, message: `${agentDisplay(task.agent)} completed`, data: { taskId: task.id }, emit });
      return response.output;
    } catch (error) {
      lastError = error;
      const cancelled = signal?.aborted || error.code === "CANCELLED";
      const timedOut = error instanceof TimeoutError;
      const finalAttempt = cancelled || attempt >= env.MAX_AGENT_RETRIES + 1;
      const status = cancelled ? "cancelled" : timedOut ? "timeout" : "failed";
      await finishRun(run.id, { status, started, errorMessage: error.message }).catch(() => {});
      await updateTask(record.id, {
        status: finalAttempt ? status : "retrying",
        errorMessage: error.message,
        completedAt: finalAttempt ? new Date() : null,
      }).catch(() => {});
      await persistAndEmit({ workflowRunId, type: finalAttempt ? "agent_failed" : "agent_retry", agent: task.agent, message: finalAttempt ? `${agentDisplay(task.agent)} failed` : `${agentDisplay(task.agent)} retrying`, data: { error: error.message, attempt }, emit }).catch(() => {});
      if (cancelled) throw new AppError("Workflow cancelled", 499, "CANCELLED");
    }
  }
  throw lastError;
}

function draftFrom(plan, results) {
  for (const task of [...plan.tasks].reverse()) {
    const result = results.get(task.id);
    if (task.agent === "scribe" && result?.content) return result.content;
    if (task.agent === "forge" && result?.solution) return result.solution;
  }
  return JSON.stringify(Object.fromEntries(results), null, 2);
}

async function review({ workflowRunId, conversationId, userRequest, results, draft, signal, attempt }) {
  const task = await createTask({
    workflowRunId,
    conversationId,
    agent: "sentinel",
    taskKey: `review-${attempt}`,
    objective: "Review the draft against the original request.",
    status: "running",
    attempt,
  });
  const run = await createRun(task.id, "sentinel");
  const started = Date.now();
  try {
    const response = await withTimeout(
      (timeoutSignal) => nexoraSentinelAgent.run({ userRequest, results: Object.fromEntries(results), draft, signal: timeoutSignal }),
      env.AGENT_TIMEOUT_MS,
      "Nexora Sentinel",
      signal,
    );
    await updateTask(task.id, { status: "completed", result: response.output, completedAt: new Date() });
    await finishRun(run.id, { status: "completed", started, response });
    return response.output;
  } catch (error) {
    const status = signal?.aborted ? "cancelled" : error instanceof TimeoutError ? "timeout" : "failed";
    await updateTask(task.id, { status, errorMessage: error.message, completedAt: new Date() }).catch(() => {});
    await finishRun(run.id, { status, started, errorMessage: error.message }).catch(() => {});
    throw error;
  }
}

async function planWorkflow({ workflowRunId, conversationId, userRequest, conversationMemory, longTermMemory, documentIds, signal }) {
  const task = await createTask({ workflowRunId, conversationId, agent: "core", taskKey: "core-plan", objective: "Create the execution plan.", status: "running" });
  const run = await createRun(task.id, "core");
  const started = Date.now();
  try {
    const response = await withTimeout(
      (timeoutSignal) => nexoraCoreAgent.createPlan({ userRequest, conversationMemory, longTermMemory, documentIds, signal: timeoutSignal }),
      env.AGENT_TIMEOUT_MS,
      "Nexora Core planning",
      signal,
    );
    await updateTask(task.id, { status: "completed", result: response.plan, completedAt: new Date() });
    await finishRun(run.id, { status: "completed", started, response: { tokenUsage: response.tokenUsage || 0 } });
    return response.plan;
  } catch (error) {
    await updateTask(task.id, { status: "failed", errorMessage: error.message, completedAt: new Date() }).catch(() => {});
    await finishRun(run.id, { status: "failed", started, errorMessage: error.message }).catch(() => {});
    throw error;
  }
}

async function finalizeWorkflow({ workflowRunId, conversationId, userRequest, results, draft, reviewResult, onToken, signal }) {
  const task = await createTask({ workflowRunId, conversationId, agent: "core", taskKey: "core-final", objective: "Create the final answer.", status: "running" });
  const run = await createRun(task.id, "core");
  const started = Date.now();
  try {
    const final = await nexoraCoreAgent.finalize({ userRequest, results: Object.fromEntries(results), draft, review: reviewResult, onToken, signal });
    await updateTask(task.id, { status: "completed", result: { final: true }, completedAt: new Date() });
    await finishRun(run.id, { status: "completed", started, response: { usage: final.usage, tokenUsage: final.usage?.total_tokens || 0 } });
    return final;
  } catch (error) {
    await updateTask(task.id, { status: "failed", errorMessage: error.message, completedAt: new Date() }).catch(() => {});
    await finishRun(run.id, { status: "failed", started, errorMessage: error.message }).catch(() => {});
    throw error;
  }
}

export async function createWorkflowRun({ conversationId, userId, userRequest }) {
  const result = await query(
    `INSERT INTO workflow_runs
      (user_id, conversation_id, user_request, state, final_response, token_usage, started_at, created_at, updated_at)
     VALUES (?, ?, ?, 'IDLE', '', 0, NOW(), NOW(), NOW())`,
    [userId, conversationId, userRequest],
  );
  return { id: result.insertId, conversationId, userId, userRequest, state: "IDLE" };
}

export async function runWorkflow({ workflowRunId, conversationId, userId, userRequest, documentIds = [], emit, onToken, signal }) {
  const results = new Map();
  try {
    await setWorkflowState(workflowRunId, "PLANNING", emit, "Nexora Core analyzing request");
    const [conversationMemory, longTermMemory] = await Promise.all([
      getConversationMemory(conversationId),
      getLongTermMemory(userId),
    ]);

    const plan = await planWorkflow({ workflowRunId, conversationId, userRequest, conversationMemory, longTermMemory, documentIds, signal });
    await query(`UPDATE workflow_runs SET plan = ?, updated_at = NOW() WHERE id = ?`, [json(plan), workflowRunId]);
    await persistAndEmit({ workflowRunId, type: "plan_created", agent: "core", message: "Plan created", data: { plan }, emit });
    await setWorkflowState(workflowRunId, "EXECUTING", emit);

    const records = new Map();
    for (const task of plan.tasks) {
      records.set(task.id, await createTask({
        workflowRunId,
        conversationId,
        agent: task.agent,
        taskKey: task.id,
        objective: task.objective,
        dependencies: task.dependencies,
        status: "pending",
      }));
    }

    const completed = new Set();
    const sharedContext = { recentConversation: conversationMemory, longTermMemory };
    while (completed.size < plan.tasks.length) {
      const ready = getReadyTasks(plan.tasks, completed);
      if (!ready.length) throw new AppError("Execution plan contains unresolved dependencies", 500, "INVALID_PLAN");
      await setWorkflowState(workflowRunId, "WAITING_FOR_AGENT", emit, "Nexora specialists are working");
      await Promise.all(ready.map(async (task) => {
        const output = await executeAgentTask({ task, record: records.get(task.id), results, userId, workflowRunId, documentIds, emit, signal, sharedContext });
        completed.add(task.id);
        return output;
      }));
      await setWorkflowState(workflowRunId, "EXECUTING", emit);
    }

    let draft = draftFrom(plan, results);
    let reviewResult = null;
    for (let i = 0; i <= env.MAX_REVIEW_RETRIES; i += 1) {
      await setWorkflowState(workflowRunId, "REVIEWING", emit, "Nexora Sentinel reviewing");
      reviewResult = await review({ workflowRunId, conversationId, userRequest, results, draft, emit, signal, attempt: i + 1 });
      if (reviewResult.approved || i >= env.MAX_REVIEW_RETRIES) break;
      await setWorkflowState(workflowRunId, "RETRYING", emit, "Improving the draft");
      const scribeTask = plan.tasks.find((task) => task.agent === "scribe");
      if (scribeTask) {
        const rerunRecord = await createTask({ workflowRunId, conversationId, agent: "scribe", taskKey: `${scribeTask.id}-review-${i + 1}`, objective: scribeTask.objective, dependencies: scribeTask.dependencies, status: "pending" });
        await executeAgentTask({ task: scribeTask, record: rerunRecord, results, userId, workflowRunId, documentIds, emit, signal, reviewFeedback: reviewResult, sharedContext });
        draft = draftFrom(plan, results);
      }
    }

    const final = await finalizeWorkflow({ workflowRunId, conversationId, userRequest, results, draft, reviewResult, onToken, signal });
    const totalsRows = await query(
      `SELECT COALESCE(SUM(ar.token_usage),0) tokenUsage, COALESCE(SUM(ar.input_tokens),0) inputTokens, COALESCE(SUM(ar.output_tokens),0) outputTokens
       FROM agent_runs ar JOIN agent_tasks at ON at.id = ar.task_id WHERE at.workflow_run_id = ?`,
      [workflowRunId],
    );
    const totals = totalsRows[0] || {};

    await transaction(async (connection) => {
      await connection.query(
        `UPDATE workflow_runs SET final_response = ?, token_usage = ?, completed_at = NOW(), updated_at = NOW() WHERE id = ?`,
        [final.text, Number(totals.tokenUsage || 0), workflowRunId],
      );
      await connection.query(
        `INSERT INTO usage_logs (user_id, conversation_id, model_name, input_tokens, output_tokens, total_tokens, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [userId, conversationId, env.AI_MODEL, Number(totals.inputTokens || 0), Number(totals.outputTokens || 0), Number(totals.tokenUsage || 0)],
      );
    });

    await setWorkflowState(workflowRunId, "COMPLETED", emit, "Final response generated");
    return { finalText: final.text, plan, review: reviewResult, results: Object.fromEntries(results), tokenUsage: Number(totals.tokenUsage || 0) };
  } catch (error) {
    const state = signal?.aborted ? "CANCELLED" : error instanceof TimeoutError ? "TIMEOUT" : "FAILED";
    await query(`UPDATE workflow_runs SET state = ?, error = ?, completed_at = NOW(), updated_at = NOW() WHERE id = ?`, [state, error.message, workflowRunId]).catch(() => {});
    await persistAndEmit({ workflowRunId, type: "workflow_failed", agent: "core", message: "Workflow failed", data: { state, error: error.message }, emit }).catch(() => {});
    throw error;
  }
}
