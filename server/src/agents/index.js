import { scoutAgent } from "./nexoraScout.js";
import { logicAgent } from "./nexoraLogic.js";
import { forgeAgent } from "./nexoraForge.js";
import { scribeAgent } from "./nexoraScribe.js";
import { memoryAgent } from "./nexoraMemory.js";

export const agents = { scout: scoutAgent, logic: logicAgent, forge: forgeAgent, scribe: scribeAgent, memory: memoryAgent };
export function getAgent(name) {
  const agent = agents[name];
  if (!agent) throw new Error(`Unsupported specialist agent: ${name}`);
  return agent;
}
