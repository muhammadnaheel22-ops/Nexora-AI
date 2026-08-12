import { Router } from "express";
import { z } from "zod";

import { query } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";
import { parseId } from "../utils/ids.js";
import { upsertMemory } from "../services/memoryService.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Get Memories
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const memories = await query(
      `
        SELECT
          id,
          user_id AS userId,
          memory_type AS memoryType,
          memory_key AS memoryKey,
          content,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM memories
        WHERE user_id = ?
        ORDER BY updated_at DESC
        LIMIT 200
      `,
      [req.user.id],
    );

    res.json({
      memories: memories.map((memory) => ({
        ...memory,

        id: String(memory.id),

        userId: String(memory.userId),

        key: memory.memoryKey,

        value: memory.content,

        category: memory.memoryType,
      })),
    });
  }),
);

/*
|--------------------------------------------------------------------------
| Create / Update Memory
|--------------------------------------------------------------------------
*/

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        key: z.string().min(1).max(160),

        value: z.string().min(1).max(10000),

        category: z.string().max(100).default("preference"),
      })
      .parse(req.body);

    const memory = await upsertMemory({
      userId: req.user.id,

      key: input.key,

      value: input.value,

      category: input.category,
    });

    res.status(201).json({
      memory: {
        ...memory,

        id: memory.id !== undefined ? String(memory.id) : undefined,

        userId:
          memory.userId !== undefined
            ? String(memory.userId)
            : String(req.user.id),

        key: memory.memoryKey ?? input.key,

        value: memory.content ?? input.value,

        category: memory.memoryType ?? input.category,
      },
    });
  }),
);

/*
|--------------------------------------------------------------------------
| Delete Memory
|--------------------------------------------------------------------------
*/

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "memory id");

    /*
    |--------------------------------------------------------------------------
    | Check memory belongs to current user
    |--------------------------------------------------------------------------
    */

    const rows = await query(
      `
        SELECT id
        FROM memories
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
      `,
      [id, req.user.id],
    );

    if (!rows.length) {
      throw new AppError("Memory not found", 404, "NOT_FOUND");
    }

    /*
    |--------------------------------------------------------------------------
    | Delete memory
    |--------------------------------------------------------------------------
    */

    await query(
      `
        DELETE FROM memories
        WHERE id = ?
          AND user_id = ?
      `,
      [id, req.user.id],
    );

    res.status(204).end();
  }),
);

export default router;
