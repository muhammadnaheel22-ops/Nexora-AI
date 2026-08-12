import { BaseAgent } from "./baseAgent.js";
import { FORGE_SYSTEM } from "./prompts.js";
import { forgeOutputSchema } from "./contracts.js";
export const forgeAgent = new BaseAgent({ name: "forge", systemPrompt: FORGE_SYSTEM, outputSchema: forgeOutputSchema, outputName: "nexora forge result" });
