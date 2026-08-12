import { BaseAgent } from "./baseAgent.js";
import { SCOUT_SYSTEM } from "./prompts.js";
import { scoutOutputSchema } from "./contracts.js";
export const scoutAgent = new BaseAgent({ name: "scout", systemPrompt: SCOUT_SYSTEM, outputSchema: scoutOutputSchema, outputName: "nexora scout result" });
