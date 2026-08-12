import { describe, expect, it } from "vitest";
import { canTransition, assertWorkflowTransition } from "../src/services/workflowStateMachine.js";

describe("workflow state machine", () => {
  it("allows the production happy path", () => {
    const states = ["IDLE", "PLANNING", "EXECUTING", "WAITING_FOR_AGENT", "REVIEWING", "COMPLETED"];
    for (let i = 0; i < states.length - 1; i += 1) {
      expect(canTransition(states[i], states[i + 1])).toBe(true);
    }
  });

  it("supports retry transitions", () => {
    expect(canTransition("WAITING_FOR_AGENT", "RETRYING")).toBe(true);
    expect(canTransition("RETRYING", "EXECUTING")).toBe(true);
    expect(canTransition("REVIEWING", "RETRYING")).toBe(true);
  });

  it("rejects reopening a terminal workflow", () => {
    expect(() => assertWorkflowTransition("COMPLETED", "EXECUTING")).toThrow(
      /Invalid workflow state transition/
    );
  });
});
