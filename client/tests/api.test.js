import { describe, expect, it } from "vitest";
import { apiErrorMessage } from "../src/services/api.js";

describe("apiErrorMessage", () => {
  it("uses structured backend errors", () => {
    expect(apiErrorMessage({
      response: { data: { error: { message: "Invalid email or password" } } },
    })).toBe("Invalid email or password");
  });

  it("explains request timeouts", () => {
    expect(apiErrorMessage({ code: "ECONNABORTED" }))
      .toBe("The Nexora API did not respond. Confirm the backend is running.");
  });

  it("explains connection failures", () => {
    expect(apiErrorMessage({ message: "Network Error" }))
      .toBe("Unable to reach the Nexora API. Confirm the backend and MySQL are running.");
  });
});
