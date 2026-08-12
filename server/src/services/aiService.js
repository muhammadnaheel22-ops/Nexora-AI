import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";
import { extractJson } from "../utils/json.js";

/*
|--------------------------------------------------------------------------
| Configuration
|--------------------------------------------------------------------------
*/

function ensureConfigured() {
  if (!env.AI_API_KEY || !String(env.AI_API_KEY).trim()) {
    throw new AppError(
      "AI_API_KEY is empty. Add a valid API key to server/.env.",
      503,
      "AI_NOT_CONFIGURED",
    );
  }

  if (!env.AI_BASE_URL || !String(env.AI_BASE_URL).trim()) {
    throw new AppError(
      "AI_BASE_URL is missing in server/.env.",
      503,
      "AI_BASE_URL_MISSING",
    );
  }

  if (!env.AI_MODEL || !String(env.AI_MODEL).trim()) {
    throw new AppError(
      "AI_MODEL is missing in server/.env.",
      503,
      "AI_MODEL_MISSING",
    );
  }
}

/*
|--------------------------------------------------------------------------
| Normalize Messages
|--------------------------------------------------------------------------
*/

function normalizeMessages(messages = []) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.map((message) => {
    const role = ["system", "user", "assistant", "tool"].includes(message?.role)
      ? message.role
      : "user";

    return {
      role,
      content: String(message?.content ?? ""),
    };
  });
}

/*
|--------------------------------------------------------------------------
| Provider Request
|--------------------------------------------------------------------------
*/

async function providerRequest(path, body, signal) {
  ensureConfigured();

  const baseUrl = String(env.AI_BASE_URL).replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  let response;

  try {
    response = await fetch(url, {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${env.AI_API_KEY}`,
      },

      body: JSON.stringify(body),

      signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw error;
    }

    throw new AppError(
      `Could not reach AI provider: ${error?.message || "Network error"}`,
      502,
      "AI_PROVIDER_NETWORK_ERROR",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Provider Error
  |--------------------------------------------------------------------------
  */

  if (!response.ok) {
    const raw = await response.text().catch(() => "");

    let message = raw || `HTTP ${response.status}`;

    try {
      const parsed = JSON.parse(raw);

      message = parsed?.error?.message || parsed?.message || message;
    } catch {
      // Keep original response text.
    }

    console.error("AI provider error:", {
      status: response.status,
      model: body?.model,
      message: String(message).slice(0, 1000),
    });

    if (response.status === 400) {
      throw new AppError(
        `AI provider rejected the request: ${message}`,
        502,
        "AI_BAD_REQUEST",
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new AppError(
        `AI authentication failed: ${message}`,
        502,
        "AI_AUTH_ERROR",
      );
    }

    if (response.status === 404) {
      throw new AppError(
        `AI model or endpoint not found: ${message}`,
        502,
        "AI_NOT_FOUND",
      );
    }

    if (response.status === 429) {
      throw new AppError(
        `AI quota/rate limit reached: ${message}`,
        429,
        "AI_RATE_LIMITED",
      );
    }

    throw new AppError(
      `AI provider request failed (${response.status}): ${message}`,
      502,
      "AI_PROVIDER_ERROR",
    );
  }

  return response;
}

/*
|--------------------------------------------------------------------------
| Read JSON Response
|--------------------------------------------------------------------------
*/

async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    throw new AppError(
      `AI provider returned invalid JSON: ${
        error?.message || "Unknown JSON error"
      }`,
      502,
      "AI_BAD_RESPONSE",
    );
  }
}

/*
|--------------------------------------------------------------------------
| Extract Assistant Text
|--------------------------------------------------------------------------
*/

function getAssistantText(data) {
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new AppError(
      "AI provider returned no assistant text.",
      502,
      "AI_BAD_RESPONSE",
    );
  }

  return content;
}

/*
|--------------------------------------------------------------------------
| Generate Normal Text
|--------------------------------------------------------------------------
*/

export async function generateText({ messages, temperature = 0.2, signal }) {
  const response = await providerRequest(
    "/chat/completions",
    {
      model: env.AI_MODEL,

      messages: normalizeMessages(messages),

      temperature,
    },
    signal,
  );

  const data = await readJson(response);

  const text = getAssistantText(data);

  return {
    text,
    usage: data?.usage || null,
  };
}

/*
|--------------------------------------------------------------------------
| Generate Structured JSON
|--------------------------------------------------------------------------
*/

export async function generateStructured({
  messages,
  schema,
  schemaName = "response",
  signal,
}) {
  if (!schema || typeof schema.safeParse !== "function") {
    throw new AppError(
      `Invalid Zod schema supplied for ${schemaName}.`,
      500,
      "INVALID_SCHEMA",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Strong JSON Instructions
  |--------------------------------------------------------------------------
  */

  const structuredMessages = normalizeMessages([
    {
      role: "system",
      content: [
        `You must return ONLY one valid JSON object for "${schemaName}".`,
        "",
        "Important rules:",
        "- Return JSON only.",
        "- Do not use Markdown.",
        "- Do not use ```json code blocks.",
        "- Do not include explanations before or after the JSON.",
        "- Do not invent fields unless required.",
        "- Follow the requested structure exactly.",
        "- Use [] for empty arrays.",
        "- Use valid JSON strings.",
        "- Do not return undefined.",
      ].join("\n"),
    },

    ...(Array.isArray(messages) ? messages : []),
  ]);

  const requestBody = {
    model: env.AI_MODEL,

    messages: structuredMessages,

    temperature: 0.1,
  };

  /*
  |--------------------------------------------------------------------------
  | Groq/OpenAI Compatible JSON Mode
  |--------------------------------------------------------------------------
  */

  if (env.AI_JSON_MODE) {
    requestBody.response_format = {
      type: "json_object",
    };
  }

  const response = await providerRequest(
    "/chat/completions",
    requestBody,
    signal,
  );

  const data = await readJson(response);

  const text = getAssistantText(data);

  /*
  |--------------------------------------------------------------------------
  | Parse JSON
  |--------------------------------------------------------------------------
  */

  let parsed;

  try {
    parsed = extractJson(text);
  } catch (error) {
    console.error("\n========== AI INVALID JSON ==========");
    console.error("Schema:", schemaName);
    console.error("Raw AI response:");
    console.error(text);
    console.error("JSON error:", error?.message);
    console.error("=====================================\n");

    throw new AppError(
      `AI returned invalid JSON for ${schemaName}: ${
        error?.message || "Unable to parse JSON"
      }`,
      502,
      "AI_INVALID_JSON",
    );
  }

  /*
  |--------------------------------------------------------------------------
  | Zod Schema Validation
  |--------------------------------------------------------------------------
  */

  const validated = schema.safeParse(parsed);

  if (!validated.success) {
    const flattened = validated.error.flatten();

    console.error(
      "\n============================================================",
    );
    console.error("AI SCHEMA VALIDATION FAILED");
    console.error(
      "============================================================",
    );

    console.error("Schema name:");
    console.error(schemaName);

    console.error("\nAI returned:");

    try {
      console.error(JSON.stringify(parsed, null, 2));
    } catch {
      console.error(parsed);
    }

    console.error("\nZod validation errors:");

    try {
      console.error(JSON.stringify(flattened, null, 2));
    } catch {
      console.error(flattened);
    }

    console.error(
      "============================================================\n",
    );

    throw new AppError(
      `AI JSON failed schema validation for ${schemaName}`,
      502,
      "AI_SCHEMA_MISMATCH",
      flattened,
    );
  }

  return {
    data: validated.data,
    usage: data?.usage || null,
  };
}

/*
|--------------------------------------------------------------------------
| Streaming Text
|--------------------------------------------------------------------------
*/

export async function streamText({ messages, onToken, signal }) {
  const response = await providerRequest(
    "/chat/completions",
    {
      model: env.AI_MODEL,

      messages: normalizeMessages(messages),

      temperature: 0.2,

      stream: true,

      stream_options: {
        include_usage: true,
      },
    },
    signal,
  );

  if (!response.body) {
    throw new AppError(
      "AI provider did not return a streaming response.",
      502,
      "AI_STREAM_MISSING",
    );
  }

  const reader = response.body.getReader();

  const decoder = new TextDecoder();

  let buffer = "";

  let fullText = "";

  let usage = null;

  try {
    while (true) {
      const { value, done } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, {
        stream: true,
      });

      const lines = buffer.split(/\r?\n/);

      buffer = lines.pop() || "";

      for (const rawLine of lines) {
        const line = rawLine.trim();

        if (!line) {
          continue;
        }

        if (!line.startsWith("data:")) {
          continue;
        }

        const payload = line.slice(5).trim();

        if (!payload) {
          continue;
        }

        if (payload === "[DONE]") {
          continue;
        }

        try {
          const event = JSON.parse(payload);

          const token = event?.choices?.[0]?.delta?.content;

          if (typeof token === "string" && token.length > 0) {
            fullText += token;

            if (typeof onToken === "function") {
              onToken(token);
            }
          }

          if (event?.usage) {
            usage = event.usage;
          }
        } catch (error) {
          console.warn("Could not parse AI stream event:", error?.message);
        }
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore reader cleanup errors.
    }
  }

  return {
    text: fullText,
    usage,
  };
}

/*
|--------------------------------------------------------------------------
| Embeddings
|--------------------------------------------------------------------------
*/

export async function embedTexts(texts, signal) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  /*
   * Embeddings are optional for basic Nexora chat.
   *
   * Groq chat models do not automatically imply that an embeddings
   * endpoint/model is available. Therefore only call this when an
   * embedding model has actually been configured.
   */

  if (!env.AI_EMBEDDING_MODEL || !String(env.AI_EMBEDDING_MODEL).trim()) {
    console.warn("AI_EMBEDDING_MODEL is not configured. Skipping embeddings.");

    return [];
  }

  const response = await providerRequest(
    "/embeddings",
    {
      model: env.AI_EMBEDDING_MODEL,

      input: texts.map((text) => String(text ?? "")),
    },
    signal,
  );

  const data = await readJson(response);

  if (!Array.isArray(data?.data)) {
    throw new AppError(
      "AI provider returned an invalid embeddings response.",
      502,
      "AI_BAD_EMBEDDING_RESPONSE",
    );
  }

  return data.data
    .sort(
      (first, second) => Number(first?.index || 0) - Number(second?.index || 0),
    )
    .map((item) => item?.embedding)
    .filter(Array.isArray);
}

/*
|--------------------------------------------------------------------------
| Token Usage
|--------------------------------------------------------------------------
*/

export function usageTotal(usage) {
  if (!usage) {
    return null;
  }

  return usage.total_tokens ?? usage.totalTokens ?? null;
}
