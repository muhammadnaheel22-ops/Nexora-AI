import { describe, expect, it, vi } from "vitest";
import { api } from "../src/api.js";

describe("api", () => {
  it("reports an unavailable backend clearly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(api("/health")).rejects.toThrow("Confirm the backend and PostgreSQL are available");
    vi.unstubAllGlobals();
  });
});
