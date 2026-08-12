import { query } from "../config/database.js";
import { AGENT, AGENT_DISPLAY, agentDisplay } from "../agents/names.js";
import { AppError } from "../utils/errors.js";

const defaults = {
  core: {
    role: "Orchestrator / Manager",
    description:
      "Plans work, delegates specialists, coordinates retries, sends work for review, and finalizes responses.",
    maxTools: 0,
  },

  scout: {
    role: "Research Specialist",
    description:
      "Collects reliable web and uploaded-document evidence with structured source-aware output.",
    maxTools: 4,
  },

  logic: {
    role: "Analysis Specialist",
    description:
      "Compares evidence, identifies patterns, performs calculations, and evaluates tradeoffs and risks.",
    maxTools: 4,
  },

  forge: {
    role: "Technical Builder",
    description:
      "Handles coding, debugging, technical architecture, and implementation-oriented solution construction.",
    maxTools: 3,
  },

  scribe: {
    role: "Writing Specialist",
    description:
      "Creates polished reports, documentation, proposals, summaries, and other user-facing deliverables.",
    maxTools: 1,
  },

  sentinel: {
    role: "Quality Reviewer",
    description:
      "Checks completeness, consistency, contradictions, unsupported claims, format, and quality before approval.",
    maxTools: 0,
  },

  memory: {
    role: "Memory and Retrieval Specialist",
    description:
      "Retrieves relevant persistent memory and uploaded-document context while resisting prompt injection from retrieved data.",
    maxTools: 2,
  },
};

function keyFromEnum(enumName) {
  return (
    Object.entries(AGENT).find(([, value]) => value === enumName)?.[0] || null
  );
}

function present(row) {
  const key = keyFromEnum(row.name);

  return {
    id: row.id,
    name: key,
    displayName: key ? AGENT_DISPLAY[key] : row.name,
    role: row.role,
    description: row.description,
    enabled: Boolean(row.enabled),
    maxTools: Number(row.maxTools ?? 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function findAgentByName(enumName) {
  const rows = await query(
    `
      SELECT
        id,
        name,
        role,
        description,
        enabled,
        max_tools AS maxTools,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM agents
      WHERE name = ?
      LIMIT 1
    `,
    [enumName],
  );

  return rows[0] || null;
}

export async function ensureAgentConfigs() {
  for (const [key, config] of Object.entries(defaults)) {
    const enumName = AGENT[key];

    await query(
      `
        INSERT INTO agents (
          name,
          role,
          description,
          enabled,
          max_tools,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          name = VALUES(name)
      `,
      [enumName, config.role, config.description, true, config.maxTools],
    );
  }
}

export async function getAgentConfig(key) {
  const enumName = AGENT[key];

  if (!enumName) {
    throw new AppError(`Unknown agent: ${key}`, 400, "UNKNOWN_AGENT");
  }

  const row = await findAgentByName(enumName);

  if (!row) {
    return {
      name: key,
      displayName: agentDisplay(key),
      enabled: true,
      ...(defaults[key] || {
        role: "Specialist",
        description: "",
        maxTools: 0,
      }),
    };
  }

  return present(row);
}

export async function listAgentConfigs() {
  await ensureAgentConfigs();

  const rows = await query(
    `
      SELECT
        id,
        name,
        role,
        description,
        enabled,
        max_tools AS maxTools,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM agents
      ORDER BY id ASC
    `,
  );

  return rows.map(present);
}

export async function updateAgentConfig(key, data) {
  const enumName = AGENT[key];

  if (!enumName || !defaults[key]) {
    throw new AppError("Unknown agent", 404, "NOT_FOUND");
  }

  const current = await findAgentByName(enumName);

  if (!current) {
    await query(
      `
        INSERT INTO agents (
          name,
          role,
          description,
          enabled,
          max_tools,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `,
      [
        enumName,
        defaults[key].role,
        data.description ?? defaults[key].description,
        data.enabled ?? true,
        data.maxTools ?? defaults[key].maxTools,
      ],
    );
  } else {
    await query(
      `
        UPDATE agents
        SET
          enabled = ?,
          max_tools = ?,
          description = ?,
          updated_at = NOW()
        WHERE name = ?
      `,
      [
        data.enabled ?? current.enabled,
        data.maxTools ?? current.maxTools,
        data.description ?? current.description,
        enumName,
      ],
    );
  }

  const row = await findAgentByName(enumName);

  return present(row);
}
