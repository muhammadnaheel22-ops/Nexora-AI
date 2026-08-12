import { BaseAgent } from "./baseAgent.js";
import { LOGIC_SYSTEM } from "./prompts.js";
import { logicOutputSchema } from "./contracts.js";
export const logicAgent = new BaseAgent({ name: "logic", systemPrompt: LOGIC_SYSTEM, outputSchema: logicOutputSchema, outputName: "nexora logic result" });
