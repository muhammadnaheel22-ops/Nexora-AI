import { Router } from "express";

import { query } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { agentKeyFromEnum, agentDisplay } from "../agents/names.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Agent name helper
|--------------------------------------------------------------------------
|
| Raw SQL returns database values directly.
| Raw MySQL returns values such as:
|
| Nexora Core
| Nexora Scout
| Nexora Logic
|
| This helper supports both formats.
|
*/

function getAgentKey(value) {
  const direct = agentKeyFromEnum(value);

  if (direct) {
    return direct;
  }

  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  const keys = [
    "core",
    "scout",
    "logic",
    "forge",
    "scribe",
    "sentinel",
    "memory",
  ];

  return (
    keys.find(
      (key) => String(agentDisplay(key)).trim().toLowerCase() === normalized,
    ) || normalized
  );
}

/*
|--------------------------------------------------------------------------
| Dashboard Handler
|--------------------------------------------------------------------------
*/

const dashboardHandler = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  /*
    |--------------------------------------------------------------------------
    | Conversations
    |--------------------------------------------------------------------------
    */

  const conversationRows = await query(
    `
        SELECT COUNT(*) AS total
        FROM conversations
        WHERE user_id = ?
      `,
    [userId],
  );

  const conversations = Number(conversationRows[0]?.total || 0);

  /*
    |--------------------------------------------------------------------------
    | Documents
    |--------------------------------------------------------------------------
    */

  const documentRows = await query(
    `
        SELECT COUNT(*) AS total
        FROM documents
        WHERE user_id = ?
      `,
    [userId],
  );

  const documents = Number(documentRows[0]?.total || 0);

  /*
    |--------------------------------------------------------------------------
    | Task totals
    |--------------------------------------------------------------------------
    */

  const taskRows = await query(
    `
        SELECT
          COUNT(*) AS totalTasks,

          SUM(
            CASE
              WHEN at.status = 'completed'
              THEN 1
              ELSE 0
            END
          ) AS successfulTasks,

          SUM(
            CASE
              WHEN at.status IN ('failed', 'timeout')
              THEN 1
              ELSE 0
            END
          ) AS failedTasks

        FROM agent_tasks at

        INNER JOIN conversations c
          ON c.id = at.conversation_id

        WHERE c.user_id = ?
      `,
    [userId],
  );

  const taskStats = taskRows[0] || {};

  const totalTasks = Number(taskStats.totalTasks || 0);

  const successfulTasks = Number(taskStats.successfulTasks || 0);

  const failedTasks = Number(taskStats.failedTasks || 0);

  /*
    |--------------------------------------------------------------------------
    | Recent workflow runs
    |--------------------------------------------------------------------------
    */

  const runs = await query(
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
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 100
      `,
    [userId],
  );

  /*
    |--------------------------------------------------------------------------
    | Agent totals
    |--------------------------------------------------------------------------
    */

  const agentTotals = await query(
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
    [userId],
  );

  /*
    |--------------------------------------------------------------------------
    | Agent successful task totals
    |--------------------------------------------------------------------------
    */

  const agentSuccess = await query(
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
    [userId],
  );

  /*
    |--------------------------------------------------------------------------
    | Tool call count
    |--------------------------------------------------------------------------
    */

  const toolCallRows = await query(
    `
        SELECT COUNT(*) AS total
        FROM tool_calls tc

        INNER JOIN agent_runs ar
          ON ar.id = tc.agent_run_id

        INNER JOIN agent_tasks at
          ON at.id = ar.task_id

        INNER JOIN conversations c
          ON c.id = at.conversation_id

        WHERE c.user_id = ?
      `,
    [userId],
  );

  const toolCalls = Number(toolCallRows[0]?.total || 0);

  /*
    |--------------------------------------------------------------------------
    | Average tool latency
    |--------------------------------------------------------------------------
    */

  const latencyRows = await query(
    `
        SELECT
          AVG(tc.execution_time_ms) AS averageLatency
        FROM tool_calls tc

        INNER JOIN agent_runs ar
          ON ar.id = tc.agent_run_id

        INNER JOIN agent_tasks at
          ON at.id = ar.task_id

        INNER JOIN conversations c
          ON c.id = at.conversation_id

        WHERE c.user_id = ?
          AND tc.execution_time_ms IS NOT NULL
      `,
    [userId],
  );

  const averageToolLatencyMs = Math.round(
    Number(latencyRows[0]?.averageLatency || 0),
  );

  /*
    |--------------------------------------------------------------------------
    | Retry event count
    |--------------------------------------------------------------------------
    */

  const retryRows = await query(
    `
        SELECT COUNT(*) AS total
        FROM agent_events ae

        INNER JOIN workflow_runs wr
          ON wr.id = ae.workflow_run_id

        WHERE wr.user_id = ?
          AND ae.type = 'agent_retry'
      `,
    [userId],
  );

  const retryCount = Number(retryRows[0]?.total || 0);

  /*
    |--------------------------------------------------------------------------
    | Error event count
    |--------------------------------------------------------------------------
    */

  const errorRows = await query(
    `
        SELECT COUNT(*) AS total
        FROM agent_events ae

        INNER JOIN workflow_runs wr
          ON wr.id = ae.workflow_run_id

        WHERE wr.user_id = ?
          AND ae.type IN (
            'agent_failed',
            'tool_error',
            'workflow_failed'
          )
      `,
    [userId],
  );

  const errorEvents = Number(errorRows[0]?.total || 0);

  /*
    |--------------------------------------------------------------------------
    | Token usage
    |--------------------------------------------------------------------------
    */

  const usageRows = await query(
    `
        SELECT
          COALESCE(
            SUM(total_tokens),
            0
          ) AS totalTokens
        FROM usage_logs
        WHERE user_id = ?
      `,
    [userId],
  );

  const tokenUsage = Number(usageRows[0]?.totalTokens || 0);

  /*
    |--------------------------------------------------------------------------
    | Average workflow response time
    |--------------------------------------------------------------------------
    */

  const completedRuns = runs.filter((run) => run.startedAt && run.completedAt);

  const averageResponseTimeMs =
    completedRuns.length > 0
      ? Math.round(
          completedRuns.reduce(
            (sum, run) =>
              sum +
              (new Date(run.completedAt).getTime() -
                new Date(run.startedAt).getTime()),
            0,
          ) / completedRuns.length,
        )
      : 0;

  /*
    |--------------------------------------------------------------------------
    | Agent success maps
    |--------------------------------------------------------------------------
    */

  const successMap = new Map();

  for (const row of agentSuccess) {
    const key = getAgentKey(row.agentName);

    successMap.set(key, Number(row.total || 0));
  }

  /*
    |--------------------------------------------------------------------------
    | Agent statistics
    |--------------------------------------------------------------------------
    */

  const agentStats = agentTotals.map((row) => {
    const agent = getAgentKey(row.agentName);

    const tasks = Number(row.total || 0);

    const success = successMap.get(agent) || 0;

    return {
      agent,

      displayName: agentDisplay(agent),

      tasks,

      successRate: tasks > 0 ? Math.round((success / tasks) * 100) : 0,
    };
  });

  /*
    |--------------------------------------------------------------------------
    | Agents used
    |--------------------------------------------------------------------------
    */

  const agentsUsed = agentStats.filter(
    (agent) => !["core", "sentinel"].includes(agent.agent),
  ).length;

  /*
    |--------------------------------------------------------------------------
    | Normalize recent runs
    |--------------------------------------------------------------------------
    */

  const recentRuns = runs.slice(0, 8).map((run) => ({
    ...run,

    tokenUsage: Number(run.tokenUsage || 0),

    plan:
      typeof run.plan === "string"
        ? (() => {
            try {
              return JSON.parse(run.plan);
            } catch {
              return null;
            }
          })()
        : run.plan,
  }));

  /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

  res.json({
    metrics: {
      totalConversations: conversations,

      totalTasks,

      successfulTasks,

      failedTasks,

      agentsUsed,

      documents,

      tokenUsage,

      averageResponseTimeMs,
    },

    observability: {
      toolCalls,

      averageToolLatencyMs,

      retries: retryCount,

      errorEvents,
    },

    agentStats,

    recentRuns,
  });
});

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
*/

router.get("/", dashboardHandler);

router.get("/metrics", dashboardHandler);

export default router;
