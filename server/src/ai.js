import { aiModels, env } from "./config.js";

export async function generateReply({ message, history = [], model }) {
  if (!env.OPENROUTER_API_KEY) {
    return `Nexora is running in local mode. I received: “${message}”\n\nAdd OPENROUTER_API_KEY to server/.env to enable live model responses.`;
  }

  const orderedModels = model ? [model, ...aiModels.filter((entry) => entry !== model)] : aiModels;
  const modelBatches = [];
  for (let index = 0; index < orderedModels.length; index += 3) modelBatches.push(orderedModels.slice(index, index + 3));
  let lastError;

  for (const models of modelBatches) {
    const response = await fetch(`${env.AI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": env.CORS_ORIGIN,
        "X-OpenRouter-Title": "Nexora AI",
      },
      body: JSON.stringify({
        models,
        max_tokens: env.AI_MAX_TOKENS,
        messages: [
          { role: "system", content: "You are Nexora Core, a concise coordinator for a multi-agent AI workspace." },
          ...history.slice(-12).map(({ role, content }) => ({ role, content })),
          { role: "user", content: message },
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || "The AI provider returned an empty response.";
    }

    const detail = await response.text();
    lastError = new Error(`AI provider returned ${response.status}: ${detail.slice(0, 200)}`);
    if ([401, 403].includes(response.status)) break;
  }

  throw lastError || new Error("No AI fallback models are configured.");
}
