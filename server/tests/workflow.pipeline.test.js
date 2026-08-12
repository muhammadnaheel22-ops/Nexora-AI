import { describe, expect, it } from "vitest";
import { getReadyTasks } from "../src/services/workflowService.js";
import { scoutOutputSchema, logicOutputSchema, forgeOutputSchema, scribeOutputSchema, sentinelOutputSchema } from "../src/agents/contracts.js";

describe("multi-agent workflow contract", () => {
  it("supports parallel evidence followed by analysis, technical build, writing and review", () => {
    const plan = [
      { id: "research-web", dependencies: [] },
      { id: "memory-docs", dependencies: [] },
      { id: "analysis", dependencies: ["research-web", "memory-docs"] },
      { id: "forge", dependencies: ["analysis"] },
      { id: "write", dependencies: ["analysis", "forge"] }
    ];
    expect(getReadyTasks(plan, new Set()).map((task) => task.id).sort()).toEqual(["memory-docs", "research-web"]);
    expect(getReadyTasks(plan, new Set(["research-web", "memory-docs"])).map((task) => task.id)).toEqual(["analysis"]);
    expect(scoutOutputSchema.safeParse({ agent: "scout", status: "completed", findings: [], sources: [], summary: "Evidence" }).success).toBe(true);
    expect(logicOutputSchema.safeParse({ agent: "logic", status: "completed", insights: [], comparisons: [], calculations: [], advantages: [], disadvantages: [], risks: [], summary: "Analysis" }).success).toBe(true);
    expect(forgeOutputSchema.safeParse({ agent: "forge", status: "completed", solution: "Implementation", artifacts: [], implementationNotes: [], risks: [], validation: [] }).success).toBe(true);
    expect(scribeOutputSchema.safeParse({ agent: "scribe", status: "completed", content: "# Final report", format: "markdown" }).success).toBe(true);
    expect(sentinelOutputSchema.safeParse({ approved: true, score: 95, issues: [], improvements: [] }).success).toBe(true);
  });
});
