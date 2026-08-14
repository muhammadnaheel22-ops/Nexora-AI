import { Router } from "express";
import { z } from "zod";

import { query } from "../config/database.js";

import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";
import { parseId } from "../utils/ids.js";
import { messageView } from "../utils/presenters.js";

import { agentKeyFromEnum } from "../agents/names.js";

import { requireAdmin } from "../middleware/auth.js";

import {
  listAgentConfigs,
  updateAgentConfig,
} from "../services/agentConfigService.js";

import {
  cancelWorkflow,
  registerWorkflow,
  unregisterWorkflow,
} from "../services/cancellationService.js";

import { createWorkflowRun, runWorkflow } from "../services/workflowService.js";

const router = Router();

const numericId = z.string().regex(/^\d+$/);

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

function parseJson(value, fallback = null) {
  if (value === null || value === undefined) {
    return fallback;
  }

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeWorkflowRun(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,

    plan: parseJson(row.plan, null),

    tokenUsage: Number(row.tokenUsage || 0),
  };
}

function normalizeTask(row) {
  return {
    ...row,

    dependencies: parseJson(row.dependencies, []),

    result: parseJson(row.result, null),

    attempt: Number(row.attempt || 0),

    agent: agentKeyFromEnum(row.agentName),

    runs: [],
  };
}

function normalizeRun(row) {
  return {
    ...row,

    executionTimeMs:
      row.executionTimeMs === null ? null : Number(row.executionTimeMs),

    inputTokens: Number(row.inputTokens || 0),

    outputTokens: Number(row.outputTokens || 0),

    tokenUsage: Number(row.tokenUsage || 0),

    toolCallsCount: Number(row.toolCallsCount || 0),

    agent: agentKeyFromEnum(row.agentName),

    toolCalls: [],
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/agents
|--------------------------------------------------------------------------
*/

router.get(
  "/",

  asyncHandler(async (req, res) => {
    const configs = await listAgentConfigs();

    const totals = await query(
      `
            SELECT
              at.agent_name AS agentName,
              COUNT(*) AS total
            FROM agent_tasks at
            INNER JOIN conversations c
              ON c.id = at.conversation_id
            WHERE c.user_id = ?
            GROUP BY at.agent_name
          `,
      [req.user.id],
    );

    const completed = await query(
      `
            SELECT
              at.agent_name AS agentName,
              COUNT(*) AS total
            FROM agent_tasks at
            INNER JOIN conversations c
              ON c.id = at.conversation_id
            WHERE c.user_id = ?
              AND at.status = 'completed'
            GROUP BY at.agent_name
          `,
      [req.user.id],
    );

    const totalMap = new Map(
      totals.map((row) => [
        agentKeyFromEnum(row.agentName),

        Number(row.total || 0),
      ]),
    );

    const successMap = new Map(
      completed.map((row) => [
        agentKeyFromEnum(row.agentName),

        Number(row.total || 0),
      ]),
    );

    const agents = configs.map((config) => {
      const tasks = totalMap.get(config.name) || 0;

      const success = successMap.get(config.name) || 0;

      return {
        ...config,

        tasks,

        successRate: tasks > 0 ? Math.round((success / tasks) * 100) : 0,
      };
    });

    res.json({
      agents,
    });
  }),
);

/*
|--------------------------------------------------------------------------
| POST /api/agents/run
|--------------------------------------------------------------------------
*/

router.post(
  "/run",

  asyncHandler(async (req, res) => {
    const input = z
      .object({
        conversationId: numericId.optional(),

        message: z.string().min(1).max(30000),

        documentIds: z.array(numericId).max(20).default([]),
      })
      .parse(req.body);

    let conversation;

    /*
      |--------------------------------------------------------------------------
      | Existing conversation
      |--------------------------------------------------------------------------
      */

    if (input.conversationId) {
      const conversationId = parseId(input.conversationId, "conversation id");

      const rows = await query(
        `
              SELECT
                id,
                user_id AS userId,
                title,
                created_at AS createdAt,
                updated_at AS updatedAt
              FROM conversations
              WHERE id = ?
                AND user_id = ?
              LIMIT 1
            `,
        [conversationId, req.user.id],
      );

      conversation = rows[0];

      if (!conversation) {
        throw new AppError("Conversation not found", 404, "NOT_FOUND");
      }
    } else {
      /*
        |--------------------------------------------------------------------------
        | Create conversation
        |--------------------------------------------------------------------------
        */

      const title = input.message.trim().slice(0, 80) || "New conversation";

      const result = await query(
        `
              INSERT INTO conversations (
                user_id,
                title,
                created_at,
                updated_at
              )
              VALUES (?, ?, NOW(), NOW())
            `,
        [req.user.id, title],
      );

      conversation = {
        id: result.insertId,

        userId: req.user.id,

        title,
      };
    }

    /*
      |--------------------------------------------------------------------------
      | Save user's message
      |--------------------------------------------------------------------------
      */

    await query(
      `
          INSERT INTO messages (
            conversation_id,
            role,
            content,
            created_at
          )
          VALUES (?, ?, ?, NOW())
        `,
      [conversation.id, "user", input.message],
    );

    /*
      |--------------------------------------------------------------------------
      | Create workflow
      |--------------------------------------------------------------------------
      */

    const run = await createWorkflowRun({
      conversationId: conversation.id,

      userId: req.user.id,

      userRequest: input.message,
    });

    const controller = new AbortController();

    registerWorkflow(run.id, controller);

    try {
      const result = await runWorkflow({
        workflowRunId: run.id,

        conversationId: conversation.id,

        userId: req.user.id,

        userRequest: input.message,

        documentIds: input.documentIds,

        signal: controller.signal,
      });

      /*
        |--------------------------------------------------------------------------
        | Save assistant message
        |--------------------------------------------------------------------------
        */

      const messageResult = await query(
        `
              INSERT INTO messages (
                conversation_id,
                role,
                content,
                workflow_run_id,
                metadata,
                created_at
              )
              VALUES (?, ?, ?, ?, ?, NOW())
            `,
        [
          conversation.id,

          "assistant",

          result.finalText,

          run.id,

          JSON.stringify({
            review: result.review,
          }),
        ],
      );

      /*
        |--------------------------------------------------------------------------
        | Read created message
        |--------------------------------------------------------------------------
        */

      const messageRows = await query(
        `
              SELECT
                id,
                conversation_id AS conversationId,
                role,
                content,
                workflow_run_id AS workflowRunId,
                metadata,
                created_at AS createdAt
              FROM messages
              WHERE id = ?
              LIMIT 1
            `,
        [messageResult.insertId],
      );

      const message = messageRows[0];

      if (message?.metadata) {
        message.metadata = parseJson(message.metadata, {});
      }

      /*
        |--------------------------------------------------------------------------
        | Update conversation timestamp
        |--------------------------------------------------------------------------
        */

      await query(
        `
            UPDATE conversations
            SET updated_at = NOW()
            WHERE id = ?
          `,
        [conversation.id],
      );

      res.status(201).json({
        conversationId: conversation.id,

        workflowRunId: run.id,

        message: messageView(message),

        review: result.review,

        plan: result.plan,
      });
    } finally {
      unregisterWorkflow(run.id);
    }
  }),
);

/*
|--------------------------------------------------------------------------
| PATCH /api/agents/:id
|--------------------------------------------------------------------------
*/

router.patch(
  "/:id",

  requireAdmin,

  asyncHandler(async (req, res) => {
    const input = z
      .object({
        enabled: z.boolean().optional(),

        maxTools: z.number().int().min(0).max(6).optional(),

        description: z.string().max(1000).optional(),
      })
      .parse(req.body);

    const agent = await updateAgentConfig(req.params.id, input);

    res.json({
      agent,
    });
  }),
);

/*
|--------------------------------------------------------------------------
| GET /api/agents/:id/status
|--------------------------------------------------------------------------
*/

router.get(
  "/:id/status",

  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "workflow id");

    /*
      |--------------------------------------------------------------------------
      | Workflow
      |--------------------------------------------------------------------------
      */

    const runRows = await query(
      `
            SELECT
              id,
              user_id AS userId,
              conversation_id AS conversationId,
              user_request AS userRequest,
              state,
              plan,
              final_response AS finalResponse,
              token_usage AS tokenUsage,
              error,
              started_at AS startedAt,
              completed_at AS completedAt,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM workflow_runs
            WHERE id = ?
              AND user_id = ?
            LIMIT 1
          `,
      [id, req.user.id],
    );

    const run = normalizeWorkflowRun(runRows[0]);

    if (!run) {
      throw new AppError("Workflow not found", 404, "NOT_FOUND");
    }

    /*
      |--------------------------------------------------------------------------
      | Tasks
      |--------------------------------------------------------------------------
      */

    const taskRows = await query(
      `
            SELECT
              id,
              workflow_run_id AS workflowRunId,
              conversation_id AS conversationId,
              task_key AS taskKey,
              agent_name AS agentName,
              task,
              dependencies,
              status,
              result,
              error_message AS errorMessage,
              attempt,
              started_at AS startedAt,
              completed_at AS completedAt,
              created_at AS createdAt,
              updated_at AS updatedAt
            FROM agent_tasks
            WHERE workflow_run_id = ?
            ORDER BY created_at ASC
          `,
      [id],
    );

    const tasks = taskRows.map(normalizeTask);

    /*
      |--------------------------------------------------------------------------
      | Agent runs
      |--------------------------------------------------------------------------
      */

    const agentRunRows = await query(
      `
            SELECT
              ar.id,
              ar.task_id AS taskId,
              ar.agent_name AS agentName,
              ar.status,
              ar.execution_time_ms AS executionTimeMs,
              ar.input_tokens AS inputTokens,
              ar.output_tokens AS outputTokens,
              ar.token_usage AS tokenUsage,
              ar.tool_calls AS toolCallsCount,
              ar.error_message AS errorMessage,
              ar.started_at AS startedAt,
              ar.completed_at AS completedAt,
              ar.created_at AS createdAt
            FROM agent_runs ar
            INNER JOIN agent_tasks at
              ON at.id = ar.task_id
            WHERE at.workflow_run_id = ?
            ORDER BY ar.created_at ASC
          `,
      [id],
    );

    const runs = agentRunRows.map(normalizeRun);

    /*
      |--------------------------------------------------------------------------
      | Tool calls
      |--------------------------------------------------------------------------
      */

    const toolCallRows = await query(
      `
            SELECT
              tc.id,
              tc.agent_run_id AS agentRunId,
              tc.tool_name AS toolName,
              tc.input_data AS inputData,
              tc.output_data AS outputData,
              tc.status,
              tc.execution_time_ms AS executionTimeMs,
              tc.error_message AS errorMessage,
              tc.created_at AS createdAt
            FROM tool_calls tc
            INNER JOIN agent_runs ar
              ON ar.id = tc.agent_run_id
            INNER JOIN agent_tasks at
              ON at.id = ar.task_id
            WHERE at.workflow_run_id = ?
            ORDER BY tc.created_at ASC
          `,
      [id],
    );

    const toolCalls = toolCallRows.map((toolCall) => ({
      ...toolCall,

      inputData: parseJson(toolCall.inputData, null),

      outputData: parseJson(toolCall.outputData, null),

      executionTimeMs:
        toolCall.executionTimeMs === null
          ? null
          : Number(toolCall.executionTimeMs),
    }));

    /*
      |--------------------------------------------------------------------------
      | Events
      |--------------------------------------------------------------------------
      */

    const eventRows = await query(
      `
            SELECT
              id,
              workflow_run_id AS workflowRunId,
              type,
              agent_name AS agentName,
              message,
              data,
              created_at AS createdAt
            FROM agent_events
            WHERE workflow_run_id = ?
            ORDER BY created_at ASC
          `,
      [id],
    );

    const events = eventRows.map((event) => ({
      ...event,

      data: parseJson(event.data, null),

      agent: event.agentName ? agentKeyFromEnum(event.agentName) : null,
    }));

    /*
      |--------------------------------------------------------------------------
      | Build nested structure
      |--------------------------------------------------------------------------
      */

    const runMap = new Map();

    for (const agentRun of runs) {
      runMap.set(String(agentRun.id), agentRun);
    }

    for (const toolCall of toolCalls) {
      const agentRun = runMap.get(String(toolCall.agentRunId));

      if (agentRun) {
        agentRun.toolCalls.push(toolCall);
      }
    }

    const taskMap = new Map();

    for (const task of tasks) {
      taskMap.set(String(task.id), task);
    }

    for (const agentRun of runs) {
      const task = taskMap.get(String(agentRun.taskId));

      if (task) {
        task.runs.push(agentRun);
      }
    }

    res.json({
      run,
      tasks,
      events,
      toolCalls,
    });
  }),
);

/*
|--------------------------------------------------------------------------
| POST /api/agents/:id/cancel
|--------------------------------------------------------------------------
*/

router.post(
  "/:id/cancel",

  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "workflow id");

    const rows = await query(
      `
            SELECT
              id,
              user_id AS userId,
              state
            FROM workflow_runs
            WHERE id = ?
              AND user_id = ?
            LIMIT 1
          `,
      [id, req.user.id],
    );

    const run = rows[0];

    if (!run) {
      throw new AppError("Workflow not found", 404, "NOT_FOUND");
    }

    const cancelledInProcess = cancelWorkflow(run.id);

    const terminalStates = ["COMPLETED", "FAILED", "TIMEOUT", "CANCELLED"];

    if (!cancelledInProcess && !terminalStates.includes(String(run.state))) {
      await query(
        `
            UPDATE workflow_runs
            SET
              state = 'CANCELLED',
              completed_at = NOW(),
              updated_at = NOW()
            WHERE id = ?
          `,
        [id],
      );
    }

    res.json({
      cancelled: true,
    });
  }),
);

export default router;
