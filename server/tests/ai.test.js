import { describe, expect, it } from "vitest";
import { generateReply } from "../src/ai.js";

describe("generateReply", () => {
  it("provides a useful local-mode response without an API key", async () => {
    const reply = await generateReply({ message: "Hello Nexora" });
    expect(reply).toContain("Hello Nexora");
    expect(reply).toContain("OPENROUTER_API_KEY");
  });
});
