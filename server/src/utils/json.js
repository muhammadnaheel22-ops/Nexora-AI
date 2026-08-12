export function extractJson(text) {
  const cleaned=String(text).trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(cleaned); } catch {}
  const start=Math.min(...[cleaned.indexOf("{"), cleaned.indexOf("[")].filter(i=>i>=0));
  if (!Number.isFinite(start)) throw new Error("No JSON object found");
  for (let end=cleaned.length; end>start; end--) { try { return JSON.parse(cleaned.slice(start,end)); } catch {} }
  throw new Error("Could not parse JSON");
}
