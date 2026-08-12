import { BaseAgent } from "./baseAgent.js";
import { MEMORY_SYSTEM } from "./prompts.js";
import { memoryOutputSchema } from "./contracts.js";
export const memoryAgent = new BaseAgent({ name: "memory", systemPrompt: MEMORY_SYSTEM, outputSchema: memoryOutputSchema, outputName: "nexora memory result" });
