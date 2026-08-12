import { Router } from "express";
import { z } from "zod";

import { query } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";
import { parseId } from "../utils/ids.js";
import { messageView } from "../utils/presenters.js";

const router = Router();

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

function normalizeMessage(row) {
  return {
    ...row,
    metadata: parseJson(row.metadata, null),
  };
}

function normalizeWorkflowRun(row) {
  return {
    ...row,
    plan: parseJson(row.plan, null),
    tokenUsage: Number(row.tokenUsage || 0),
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/conversations
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const rows = await query(
      `
        SELECT
          id,
          user_id AS userId,
          title,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM conversations
        WHERE user_id = ?
        ORDER BY updated_at DESC
        LIMIT 100
      `,
      [req.user.id],
    );

    res.json({
      conversations: rows,
    });
  }),
);

/*
|--------------------------------------------------------------------------
| POST /api/conversations
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { title } = z
      .object({
        title: z.string().max(180).optional(),
      })
      .parse(req.body);

    const finalTitle = title?.trim() || "New conversation";

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
      [req.user.id, finalTitle],
    );

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
        LIMIT 1
      `,
      [result.insertId],
    );

    res.status(201).json({
      conversation: rows[0],
    });
  }),
);

/*
|--------------------------------------------------------------------------
| GET /api/conversations/:id/export
|--------------------------------------------------------------------------
*/

router.get(
  "/:id/export",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "conversation id");

    const format = z
      .enum(["markdown", "json"])
      .default("markdown")
      .parse(req.query.format);

    const conversationRows = await query(
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
      [id, req.user.id],
    );

    const conversation = conversationRows[0];

    if (!conversation) {
      throw new AppError("Conversation not found", 404, "NOT_FOUND");
    }

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
        WHERE conversation_id = ?
        ORDER BY created_at ASC
      `,
      [id],
    );

    const messages = messageRows.map(normalizeMessage);

    if (format === "json") {
      res.setHeader("content-type", "application/json; charset=utf-8");

      res.setHeader(
        "content-disposition",
        `attachment; filename="nexora-conversation-${id}.json"`,
      );

      const output = {
        conversation: {
          id: String(conversation.id),
          title: conversation.title,
          createdAt: conversation.createdAt,
        },

        messages: messages.map((message) => ({
          ...messageView(message),

          id: String(message.id),

          conversationId: String(message.conversationId),

          workflowRunId: message.workflowRunId
            ? String(message.workflowRunId)
            : null,
        })),
      };

      return res.send(JSON.stringify(output, null, 2));
    }

    const markdown = [
      `# ${conversation.title}`,
      "",
      ...messages.map(
        (message) =>
          `## ${
            String(message.role).toUpperCase() === "USER" ? "User" : "Nexora AI"
          }\n\n${message.content}\n`,
      ),
    ].join("\n");

    res.setHeader("content-type", "text/markdown; charset=utf-8");

    res.setHeader(
      "content-disposition",
      `attachment; filename="nexora-conversation-${id}.md"`,
    );

    return res.send(markdown);
  }),
);

/*
|--------------------------------------------------------------------------
| GET /api/conversations/:id
|--------------------------------------------------------------------------
*/

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "conversation id");

    const conversationRows = await query(
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
      [id, req.user.id],
    );

    const conversation = conversationRows[0];

    if (!conversation) {
      throw new AppError("Conversation not found", 404, "NOT_FOUND");
    }

    const [messageRows, runRows] = await Promise.all([
      query(
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
            WHERE conversation_id = ?
            ORDER BY created_at ASC
          `,
        [id],
      ),

      query(
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
            WHERE conversation_id = ?
              AND user_id = ?
            ORDER BY created_at DESC
            LIMIT 10
          `,
        [id, req.user.id],
      ),
    ]);

    const messages = messageRows.map(normalizeMessage);

    const runs = runRows.map(normalizeWorkflowRun);

    res.json({
      conversation,
      messages: messages.map(messageView),
      runs,
    });
  }),
);

/*
|--------------------------------------------------------------------------
| DELETE /api/conversations/:id
|--------------------------------------------------------------------------
*/

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "conversation id");

    const rows = await query(
      `
        SELECT id
        FROM conversations
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
      `,
      [id, req.user.id],
    );

    if (!rows[0]) {
      throw new AppError("Conversation not found", 404, "NOT_FOUND");
    }

    await query(
      `
        DELETE FROM conversations
        WHERE id = ?
          AND user_id = ?
      `,
      [id, req.user.id],
    );

    res.status(204).end();
  }),
);

export default router;
