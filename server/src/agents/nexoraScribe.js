import { BaseAgent } from "./baseAgent.js";
import { SCRIBE_SYSTEM } from "./prompts.js";
import { scribeOutputSchema } from "./contracts.js";
export const scribeAgent = new BaseAgent({ name: "scribe", systemPrompt: SCRIBE_SYSTEM, outputSchema: scribeOutputSchema, outputName: "nexora scribe result" });
