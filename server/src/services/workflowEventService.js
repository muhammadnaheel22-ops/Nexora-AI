import { query } from "../config/database.js";
import { agentDbValue } from "../agents/names.js";

function json(value) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

export async function persistAndEmit({
  workflowRunId,
  type,
  agent = null,
  message = "",
  data = null,
  emit,
}) {
  const agentName = agentDbValue(agent);
  const result = await query(
    `INSERT INTO agent_events
      (workflow_run_id, type, agent_name, message, data, created_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [workflowRunId, type, agentName, String(message || ""), json(data)],
  );

  const event = {
    id: result.insertId,
    workflowRunId,
    type,
    agent,
    agentName,
    message,
    data,
    createdAt: new Date(),
  };

  if (typeof emit === "function") emit(event);
  return event;
}

export async function setWorkflowState(workflowRunId, state, emit, message = null) {
  const normalizedState = String(state || "").toUpperCase();
  await query(
    `UPDATE workflow_runs SET state = ?, updated_at = NOW() WHERE id = ?`,
    [normalizedState, workflowRunId],
  );

  await persistAndEmit({
    workflowRunId,
    type: "state_changed",
    agent: "core",
    message: message || `Workflow state changed to ${normalizedState}`,
    data: { state: normalizedState },
    emit,
  });

  return { workflowRunId, state: normalizedState };
}
