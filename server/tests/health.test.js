import { describe, it, expect } from "vitest";
import request from "supertest";
const { app } = await import("../src/app.js");

describe("health endpoint", () => {
  it("returns simple MySQL service metadata", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.database).toBe("mysql");
    expect(response.body.orm).toBe("none");
  });
});
