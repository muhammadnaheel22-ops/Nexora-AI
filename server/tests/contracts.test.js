import { describe, expect, it } from "vitest";
import { executionPlanSchema, scoutOutputSchema, logicOutputSchema, forgeOutputSchema, memoryOutputSchema, sentinelOutputSchema } from "../src/agents/contracts.js";

describe("Nexora agent contracts", () => {
  it("validates a dependency-aware seven-agent-capable plan", () => {
    const result = executionPlanSchema.safeParse({
      goal: "Create an AI framework implementation report",
      strategy: "hybrid",
      tasks: [
        { id: "m1", agent: "memory", objective: "Retrieve relevant project context", dependencies: [], tools: ["fileSearch"] },
        { id: "r1", agent: "scout", objective: "Research current frameworks", dependencies: [], tools: ["webSearch"] },
        { id: "a1", agent: "logic", objective: "Compare framework tradeoffs", dependencies: ["r1"], tools: ["calculator"] },
        { id: "f1", agent: "forge", objective: "Design the implementation architecture", dependencies: ["m1", "a1"], tools: ["database"] },
        { id: "w1", agent: "scribe", objective: "Write the final report", dependencies: ["r1", "a1", "f1"], tools: [] }
      ],
      finalFormat: "Markdown report"
    });
    expect(result.success).toBe(true);
  });

  it("validates specialist structured outputs", () => {
    expect(scoutOutputSchema.safeParse({ agent: "scout", status: "completed", findings: [], sources: [], summary: "Done" }).success).toBe(true);
    expect(logicOutputSchema.safeParse({ agent: "logic", status: "completed", insights: [], comparisons: [], calculations: [], advantages: [], disadvantages: [], risks: [], summary: "Done" }).success).toBe(true);
    expect(forgeOutputSchema.safeParse({ agent: "forge", status: "completed", solution: "Architecture", artifacts: [], implementationNotes: [], risks: [], validation: [] }).success).toBe(true);
    expect(memoryOutputSchema.safeParse({ agent: "memory", status: "completed", relevantMemories: [], documentContext: [], summary: "Context" }).success).toBe(true);
  });

  it("accepts Sentinel rejection targeted to a specialist", () => {
    const review = sentinelOutputSchema.parse({ approved: false, score: 70, issues: [{ type: "missing", severity: "high", description: "Missing evidence", targetAgent: "scout" }], improvements: ["Add evidence"] });
    expect(review.approved).toBe(false);
    expect(review.issues[0].targetAgent).toBe("scout");
  });
});
