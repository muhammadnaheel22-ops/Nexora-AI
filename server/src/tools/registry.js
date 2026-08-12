import { transaction } from "../config/database.js";
import { webSearchTool } from "./webSearch.js";
import { calculatorTool } from "./calculator.js";
import { fileSearchTool } from "./fileSearch.js";
import { databaseTool } from "./database.js";
import { persistAndEmit } from "../services/workflowEventService.js";
import { safeToolPreview } from "../utils/sanitize.js";

const tools = new Map(
  [webSearchTool, calculatorTool, fileSearchTool, databaseTool].map((tool) => [
    tool.name,
    tool,
  ]),
);

export const agentToolPermissions = {
  core: [],
  scout: ["webSearch", "fileSearch"],
  logic: ["calculator", "fileSearch", "database"],
  forge: ["calculator", "fileSearch", "database"],
  scribe: ["fileSearch"],
  sentinel: [],
  memory: ["fileSearch", "database"],
};

export function toolDescriptions(agentName, taskAllowedTools = null) {
  const roleAllowed = agentToolPermissions[agentName] || [];

  const granted =
    taskAllowedTools === null
      ? roleAllowed
      : roleAllowed.filter((name) => taskAllowedTools.includes(name));

  return granted
    .map((name) => ({
      name,
      description: tools.get(name)?.description,
    }))
    .filter((item) => item.description);
}

async function saveSuccessfulToolCall({
  agentRunId,
  toolName,
  input,
  output,
  executionTimeMs,
}) {
  await transaction(async (connection) => {
    await connection.execute(
      `
        INSERT INTO tool_calls
        (
          agent_run_id,
          tool_name,
          input_data,
          output_data,
          status,
          execution_time_ms,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        String(agentRunId),
        toolName,
        JSON.stringify(input ?? null),
        JSON.stringify(output ?? null),
        "completed",
        executionTimeMs,
      ],
    );

    await connection.execute(
      `
        UPDATE agent_runs
        SET tool_calls = tool_calls + 1
        WHERE id = ?
      `,
      [String(agentRunId)],
    );
  });
}

async function saveFailedToolCall({
  agentRunId,
  toolName,
  input,
  executionTimeMs,
  errorMessage,
}) {
  await transaction(async (connection) => {
    await connection.execute(
      `
        INSERT INTO tool_calls
        (
          agent_run_id,
          tool_name,
          input_data,
          status,
          execution_time_ms,
          error_message,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `,
      [
        String(agentRunId),
        toolName,
        JSON.stringify(input ?? null),
        "failed",
        executionTimeMs,
        errorMessage || "Unknown tool error",
      ],
    );

    await connection.execute(
      `
        UPDATE agent_runs
        SET tool_calls = tool_calls + 1
        WHERE id = ?
      `,
      [String(agentRunId)],
    );
  });
}

export async function executeTool({
  agentName,
  taskAllowedTools = [],
  toolName,
  input,
  agentRunId,
  workflowRunId,
  userId,
  emit,
  signal,
}) {
  const roleAllowed = agentToolPermissions[agentName] || [];

  if (
    !roleAllowed.includes(toolName) ||
    !taskAllowedTools.includes(toolName)
  ) {
    throw new Error(
      `Tool "${toolName}" is not permitted for this ${agentName} task`,
    );
  }

  const tool = tools.get(toolName);

  if (!tool) {
    throw new Error(`Unknown tool "${toolName}"`);
  }

  const started = Date.now();

  try {
    const output = await tool.execute(input, {
      userId,
      signal,
    });

    const executionTimeMs = Date.now() - started;

    await saveSuccessfulToolCall({
      agentRunId,
      toolName,
      input,
      output,
      executionTimeMs,
    });

    await persistAndEmit({
      workflowRunId,
      type: "tool_call",
      agent: agentName,
      message: `${agentName} used ${toolName}`,
      data: {
        tool: toolName,
        executionTimeMs,
        input: safeToolPreview(input, 500),
        output: safeToolPreview(output, 900),
      },
      emit,
    });

    return output;
  } catch (error) {
    const executionTimeMs = Date.now() - started;

    await saveFailedToolCall({
      agentRunId,
      toolName,
      input,
      executionTimeMs,
      errorMessage: error?.message,
    }).catch(() => {});

    await persistAndEmit({
      workflowRunId,
      type: "tool_error",
      agent: agentName,
      message: `${toolName} failed`,
      data: {
        tool: toolName,
        error: error?.message || "Unknown tool error",
        executionTimeMs,
      },
      emit,
    }).catch(() => {});

    throw error;
  }
}