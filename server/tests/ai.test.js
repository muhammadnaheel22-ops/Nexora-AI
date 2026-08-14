import { describe, expect, it } from "vitest";
import { generateReply } from "../src/ai.js";
import { aiModels, env } from "../src/config.js";

describe("generateReply", () => {
  it("provides a useful local-mode response without an API key", async () => {
    const reply = await generateReply({ message: "Hello Nexora" });
    expect(reply).toContain("Hello Nexora");
    expect(reply).toContain("OPENROUTER_API_KEY");
  });

  it("sends the configured free-first model fallback chain in batches of three", async () => {
    const previousKey = env.OPENROUTER_API_KEY;
    const previousFetch = globalThis.fetch;
    const requests = [];
    env.OPENROUTER_API_KEY = "test-key";
    globalThis.fetch = async (_url, options) => {
      requests.push(JSON.parse(options.body));
      if (requests.length === 1) return { ok: false, status: 429, text: async () => "rate limited" };
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "Fallback ready" } }] }) };
    };

    try {
      await expect(generateReply({ message: "Hello" })).resolves.toBe("Fallback ready");
      expect(requests.flatMap((request) => request.models)).toEqual(aiModels);
      expect(requests[0].models).toEqual([
        "openrouter/free",
        "~deepseek/deepseek-v4-flash-latest",
        "~google/gemini-flash-latest",
      ]);
      expect(requests[1].models).toEqual([
        "openai/gpt-oss-20b:free",
        "~openai/gpt-mini-latest",
        "openrouter/auto",
      ]);
      expect(requests.every((request) => !("model" in request))).toBe(true);
    } finally {
      env.OPENROUTER_API_KEY = previousKey;
      globalThis.fetch = previousFetch;
    }
  });

  it("moves a user-selected model to the front while retaining fallbacks", async () => {
    const previousKey = env.OPENROUTER_API_KEY;
    const previousFetch = globalThis.fetch;
    let request;
    env.OPENROUTER_API_KEY = "test-key";
    globalThis.fetch = async (_url, options) => {
      request = JSON.parse(options.body);
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "Gemini selected" } }] }) };
    };

    try {
      await generateReply({ message: "Hello", model: "~google/gemini-flash-latest" });
      expect(request.models[0]).toBe("~google/gemini-flash-latest");
      expect(request.models).toContain("openrouter/free");
    } finally {
      env.OPENROUTER_API_KEY = previousKey;
      globalThis.fetch = previousFetch;
    }
  });
});
