import { AppError } from "../utils/errors.js";

export const terminalStates = new Set(["COMPLETED", "FAILED", "TIMEOUT", "CANCELLED"]);

const transitions = {
  IDLE: new Set(["PLANNING", "CANCELLED", "FAILED", "TIMEOUT"]),
  PLANNING: new Set(["EXECUTING", "RETRYING", "CANCELLED", "FAILED", "TIMEOUT"]),
  EXECUTING: new Set(["WAITING_FOR_AGENT", "RETRYING", "REVIEWING", "CANCELLED", "FAILED", "TIMEOUT"]),
  WAITING_FOR_AGENT: new Set(["EXECUTING", "RETRYING", "REVIEWING", "CANCELLED", "FAILED", "TIMEOUT"]),
  REVIEWING: new Set(["RETRYING", "COMPLETED", "CANCELLED", "FAILED", "TIMEOUT"]),
  RETRYING: new Set(["EXECUTING", "WAITING_FOR_AGENT", "REVIEWING", "CANCELLED", "FAILED", "TIMEOUT"]),
  COMPLETED: new Set(),
  FAILED: new Set(),
  TIMEOUT: new Set(),
  CANCELLED: new Set()
};

export function canTransition(from, to) {
  if (from === to) return true;
  return transitions[from]?.has(to) || false;
}

export function assertWorkflowTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new AppError(
      `Invalid workflow state transition: ${from} -> ${to}`,
      500,
      "INVALID_WORKFLOW_TRANSITION"
    );
  }
}
