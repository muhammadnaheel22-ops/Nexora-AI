import { describe, expect, it } from "vitest";
import { chunkText, normalizeText } from "../src/services/documentService.js";

describe("document chunking", () => {
  it("normalizes and chunks text with overlap", () => {
    const text = Array.from({ length: 200 }, (_, i) => `Sentence ${i}.`).join(" ");
    const chunks = chunkText(text, 300, 50);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks.every((chunk) => chunk.content.length > 0)).toBe(true);
  });

  it("removes null bytes and excess blank lines", () => {
    expect(normalizeText("A\u0000\n\n\n\nB")).toBe("A\n\nB");
  });
});
