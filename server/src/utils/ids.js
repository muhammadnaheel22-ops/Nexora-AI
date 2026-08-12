import { AppError } from "./errors.js";

export function parseId(value, label = "id") {
  try {
    const text = String(value ?? "");
    if (!/^\d+$/.test(text)) throw new Error("invalid");
    const id = BigInt(text);
    if (id <= 0n) throw new Error("invalid");
    return id;
  } catch {
    throw new AppError(`Invalid ${label}`, 400, "INVALID_ID");
  }
}

export function idString(value) {
  return typeof value === "bigint" ? value.toString() : String(value);
}
