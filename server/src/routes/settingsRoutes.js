import { Router } from "express";
import { z } from "zod";

import { query } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

async function getOrCreateSettings(userId) {
  await query(
    `
      INSERT INTO user_settings (
        user_id,
        created_at,
        updated_at
      )
      VALUES (?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        user_id = VALUES(user_id)
    `,
    [userId],
  );

  const rows = await query(
    `
      SELECT
        id,
        user_id AS userId,
        theme,
        preferred_model AS preferredModel,
        long_term_memory_enabled AS longTermMemoryEnabled,
        telemetry_enabled AS telemetryEnabled,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM user_settings
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId],
  );

  return rows[0] || null;
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const settings = await getOrCreateSettings(req.user.id);

    res.json({
      settings: {
        ...settings,
        longTermMemoryEnabled: Boolean(settings?.longTermMemoryEnabled),
        telemetryEnabled: Boolean(settings?.telemetryEnabled),
      },
    });
  }),
);

router.patch(
  "/",
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        theme: z.enum(["system", "light", "dark"]).optional(),

        preferredModel: z.string().max(100).nullable().optional(),

        longTermMemoryEnabled: z.boolean().optional(),

        telemetryEnabled: z.boolean().optional(),
      })
      .parse(req.body);

    await getOrCreateSettings(req.user.id);

    const fields = [];
    const values = [];

    if (input.theme !== undefined) {
      fields.push("theme = ?");
      values.push(input.theme);
    }

    if (input.preferredModel !== undefined) {
      fields.push("preferred_model = ?");
      values.push(input.preferredModel);
    }

    if (input.longTermMemoryEnabled !== undefined) {
      fields.push("long_term_memory_enabled = ?");
      values.push(input.longTermMemoryEnabled);
    }

    if (input.telemetryEnabled !== undefined) {
      fields.push("telemetry_enabled = ?");
      values.push(input.telemetryEnabled);
    }

    if (fields.length > 0) {
      fields.push("updated_at = NOW()");
      values.push(req.user.id);

      await query(
        `
          UPDATE user_settings
          SET ${fields.join(", ")}
          WHERE user_id = ?
        `,
        values,
      );
    }

    const settings = await getOrCreateSettings(req.user.id);

    res.json({
      settings: {
        ...settings,
        longTermMemoryEnabled: Boolean(settings?.longTermMemoryEnabled),
        telemetryEnabled: Boolean(settings?.telemetryEnabled),
      },
    });
  }),
);

export default router;
