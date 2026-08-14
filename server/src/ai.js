import { env } from "./config.js";

export async function generateReply({ message, history = [] }) {
  if (!env.OPENROUTER_API_KEY) {
    return `Nexora is running in local mode. I received: “${message}”\n\nAdd OPENROUTER_API_KEY to server/.env to enable live model responses.`;
  }

  const response = await fetch(`${env.AI_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.CORS_ORIGIN,
      "X-OpenRouter-Title": "Nexora AI",
    },
    body: JSON.stringify({
      model: env.AI_MODEL,
      max_tokens: env.AI_MAX_TOKENS,
      messages: [
        { role: "system", content: "You are Nexora Core, a concise coordinator for a multi-agent AI workspace." },
        ...history.slice(-12).map(({ role, content }) => ({ role, content })),
        { role: "user", content: message },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`AI provider returned ${response.status}: ${detail.slice(0, 200)}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "The AI provider returned an empty response.";
}
