import { Router } from "express";
import { z } from "zod";

import { query } from "../config/database.js";

import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";
import { parseId } from "../utils/ids.js";
import { messageView } from "../utils/presenters.js";

import { createWorkflowRun, runWorkflow } from "../services/workflowService.js";

import {
  registerWorkflow,
  unregisterWorkflow,
} from "../services/cancellationService.js";

const router = Router();

const numericId = z.string().regex(/^\d+$/);

const inputSchema = z.object({
  conversationId: numericId.optional(),

  message: z.string().min(1).max(30000),

  documentIds: z.array(numericId).max(20).default([]),

  regenerate: z.boolean().default(false),
});

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

function normalizeMessage(row) {
  if (!row) {
    return null;
  }

  return {
    ...row,

    metadata: parseJson(row.metadata, null),
  };
}

/*
|--------------------------------------------------------------------------
| Ensure Conversation
|--------------------------------------------------------------------------
*/

async function ensureConversation(userId, id, message) {
  if (id) {
    const conversationId = parseId(id, "conversation id");

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
      [conversationId, userId],
    );

    const conversation = rows[0];

    if (!conversation) {
      throw new AppError("Conversation not found", 404, "NOT_FOUND");
    }

    return conversation;
  }

  const title = message.trim().slice(0, 80) || "New conversation";

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
    [userId, title],
  );

  return {
    id: result.insertId,
    userId,
    title,
  };
}

/*
|--------------------------------------------------------------------------
| SSE
|--------------------------------------------------------------------------
*/

function sse(res, event, data) {
  res.write(
    `event: ${event}\ndata: ${JSON.stringify(data, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    )}\n\n`,
  );
}

/*
|--------------------------------------------------------------------------
| Prepare Request
|--------------------------------------------------------------------------
*/

async function prepareRequest(input, conversation) {
  /*
  |--------------------------------------------------------------------------
  | Normal new message
  |--------------------------------------------------------------------------
  */

  if (!input.regenerate) {
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

    return input.message;
  }

  /*
  |--------------------------------------------------------------------------
  | Regenerate existing response
  |--------------------------------------------------------------------------
  */

  const userRows = await query(
    `
      SELECT
        id,
        conversation_id AS conversationId,
        role,
        content,
        created_at AS createdAt
      FROM messages
      WHERE conversation_id = ?
        AND role = 'user'
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [conversation.id],
  );

  const lastUser = userRows[0];

  if (!lastUser) {
    throw new AppError("No user message to regenerate", 400, "NO_MESSAGE");
  }

  const assistantRows = await query(
    `
      SELECT
        id,
        created_at AS createdAt
      FROM messages
      WHERE conversation_id = ?
        AND role = 'assistant'
        AND created_at > ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [conversation.id, lastUser.createdAt],
  );

  const lastAssistant = assistantRows[0];

  if (lastAssistant) {
    await query(
      `
        DELETE FROM messages
        WHERE id = ?
      `,
      [lastAssistant.id],
    );
  }

  return lastUser.content;
}

/*
|--------------------------------------------------------------------------
| Save Assistant Message
|--------------------------------------------------------------------------
*/

async function saveAssistantMessage({
  conversationId,
  workflowRunId,
  content,
  review,
}) {
  const result = await query(
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
      conversationId,
      "assistant",
      content,
      workflowRunId,
      JSON.stringify({
        review,
      }),
    ],
  );

  const rows = await query(
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
    [result.insertId],
  );

  return normalizeMessage(rows[0]);
}

/*
|--------------------------------------------------------------------------
| POST /api/chat/stream
|--------------------------------------------------------------------------
*/

router.post(
  "/stream",

  asyncHandler(async (req, res) => {
    const input = inputSchema.parse(req.body);

    const conversation = await ensureConversation(
      req.user.id,
      input.conversationId,
      input.message,
    );

    const userRequest = await prepareRequest(input, conversation);

    await query(
      `
          UPDATE conversations
          SET updated_at = NOW()
          WHERE id = ?
        `,
      [conversation.id],
    );

    const run = await createWorkflowRun({
      conversationId: conversation.id,

      userId: req.user.id,

      userRequest,
    });

    const controller = new AbortController();

    registerWorkflow(run.id, controller);

    res.status(200);

    res.setHeader("Content-Type", "text/event-stream");

    res.setHeader("Cache-Control", "no-cache, no-transform");

    res.setHeader("Connection", "keep-alive");

    res.flushHeaders?.();

    sse(res, "meta", {
      conversationId: conversation.id,

      workflowRunId: run.id,
    });

    const emit = (event) => {
      sse(res, "activity", event);
    };

    let closed = false;

    res.on("close", () => {
      if (!res.writableEnded) {
        closed = true;

        controller.abort("client-disconnected");
      }
    });

    try {
      const result = await runWorkflow({
        workflowRunId: run.id,

        conversationId: conversation.id,

        userId: req.user.id,

        userRequest,

        documentIds: input.documentIds,

        emit,

        onToken: (token) => {
          if (!closed) {
            sse(res, "token", {
              token,
            });
          }
        },

        signal: controller.signal,
      });

      const message = await saveAssistantMessage({
        conversationId: conversation.id,

        workflowRunId: run.id,

        content: result.finalText,

        review: result.review,
      });

      await query(
        `
            UPDATE conversations
            SET updated_at = NOW()
            WHERE id = ?
          `,
        [conversation.id],
      );

      if (!closed) {
        sse(res, "done", {
          message: messageView(message),

          conversationId: conversation.id,

          workflowRunId: run.id,

          review: result.review,
        });
      }
    } catch (error) {
      if (!closed) {
        sse(res, "error", {
          code: error.code || "WORKFLOW_ERROR",

          message: error.message,
        });
      }
    } finally {
      unregisterWorkflow(run.id);

      if (!closed) {
        res.end();
      }
    }
  }),
);

/*
|--------------------------------------------------------------------------
| POST /api/chat
|--------------------------------------------------------------------------
*/

router.post(
  "/",

  asyncHandler(async (req, res) => {
    const input = inputSchema.parse(req.body);

    const conversation = await ensureConversation(
      req.user.id,
      input.conversationId,
      input.message,
    );

    const userRequest = await prepareRequest(input, conversation);

    await query(
      `
          UPDATE conversations
          SET updated_at = NOW()
          WHERE id = ?
        `,
      [conversation.id],
    );

    const run = await createWorkflowRun({
      conversationId: conversation.id,

      userId: req.user.id,

      userRequest,
    });

    const controller = new AbortController();

    registerWorkflow(run.id, controller);

    try {
      const result = await runWorkflow({
        workflowRunId: run.id,

        conversationId: conversation.id,

        userId: req.user.id,

        userRequest,

        documentIds: input.documentIds,

        signal: controller.signal,
      });

      const message = await saveAssistantMessage({
        conversationId: conversation.id,

        workflowRunId: run.id,

        content: result.finalText,

        review: result.review,
      });

      await query(
        `
            UPDATE conversations
            SET updated_at = NOW()
            WHERE id = ?
          `,
        [conversation.id],
      );

      res.json({
        conversationId: conversation.id,

        workflowRunId: run.id,

        message: messageView(message),

        review: result.review,
      });
    } finally {
      unregisterWorkflow(run.id);
    }
  }),
);

/*
|--------------------------------------------------------------------------
| POST /api/chat/regenerate
|--------------------------------------------------------------------------
*/

router.post(
  "/regenerate",

  asyncHandler(async (req, res) => {
    const { conversationId } = z
      .object({
        conversationId: numericId,
      })
      .parse(req.body);

    const id = parseId(conversationId, "conversation id");

    const conversationRows = await query(
      `
            SELECT
              id,
              user_id AS userId
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
              content,
              created_at AS createdAt
            FROM messages
            WHERE conversation_id = ?
              AND role = 'user'
            ORDER BY created_at DESC
            LIMIT 1
          `,
      [conversation.id],
    );

    const last = messageRows[0];

    if (!last) {
      throw new AppError("No user message to regenerate", 400, "NO_MESSAGE");
    }

    res.status(202).json({
      message:
        "Use /api/chat/stream with regenerate=true to stream the regenerated answer",

      lastUserMessage: last.content,
    });
  }),
);

export default router;
