export const AGENT = Object.freeze({
  core: "Nexora Core",
  scout: "Nexora Scout",
  logic: "Nexora Logic",
  forge: "Nexora Forge",
  scribe: "Nexora Scribe",
  sentinel: "Nexora Sentinel",
  memory: "Nexora Memory",
});

export const AGENT_DISPLAY = AGENT;
export const AGENT_KEYS = Object.freeze(Object.keys(AGENT));

export const agentEnum = (key) => AGENT[key];
export const agentDisplay = (key) => AGENT[key] || String(key || "");
export const agentDbValue = (value) => {
  if (!value) return null;
  if (AGENT[value]) return AGENT[value];
  const direct = Object.values(AGENT).find((name) => name === value);
  return direct || String(value);
};

export const agentKeyFromEnum = (value) =>
  Object.entries(AGENT).find(([, dbValue]) => dbValue === value)?.[0] || String(value || "").toLowerCase();
