import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("API integration", () => {
  it("returns health information", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("validates registration input before database access", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({ name: "A", email: "not-an-email", password: "short" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("protects private endpoints", async () => {
    const response = await request(app).get("/api/conversations");
    expect(response.status).toBe(401);
  });
});
