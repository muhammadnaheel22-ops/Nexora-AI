import { generateStructured, usageTotal } from "../services/aiService.js";
import { sentinelOutputSchema } from "./contracts.js";
import { SENTINEL_SYSTEM } from "./prompts.js";

export const nexoraSentinelAgent = {
  name: "sentinel",
  async run({ userRequest, results, draft, signal }) {
    const response = await generateStructured({
      schema: sentinelOutputSchema,
      schemaName: "nexora sentinel review",
      signal,
      messages: [
        { role: "system", content: SENTINEL_SYSTEM },
        { role: "user", content: [
          `Original request:\n${userRequest}`,
          `Specialist outputs:\n${JSON.stringify(results, null, 2).slice(0, 30000)}`,
          `Draft to review:\n${String(draft || "").slice(0, 30000)}`
        ].join("\n\n") }
      ]
    });
    return { output: response.data, tokenUsage: usageTotal(response.usage), usage: response.usage };
  }
};
