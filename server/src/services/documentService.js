import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { parse as parseCsv } from "csv-parse/sync";
import { env } from "../config/env.js";
import { AppError } from "../utils/errors.js";

const allowedExt = new Set([".pdf", ".txt", ".docx", ".csv"]);

export function normalizeText(text) {
  return String(text || "").replace(/\0/g, "").replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

export function chunkText(text, size = 1200, overlap = 180) {
  const normalized = normalizeText(text);
  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + size, normalized.length);
    if (end < normalized.length) {
      const newline = normalized.lastIndexOf("\n", end);
      const sentence = normalized.lastIndexOf(". ", end);
      const boundary = Math.max(newline, sentence);
      if (boundary > start + size * 0.55) end = boundary + 1;
    }
    const content = normalized.slice(start, end).trim();
    if (content) chunks.push({ index: chunks.length, content });
    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

export function validateUpload(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();
  if (!allowedExt.has(ext)) throw new AppError("Unsupported file type. Use PDF, TXT, DOCX, or CSV.", 400, "UNSUPPORTED_FILE");
  return ext;
}

export async function extractText(file) {
  const ext = validateUpload(file);
  const buffer = file.buffer;
  let text = "";
  if (ext === ".pdf") text = (await pdfParse(buffer)).text;
  if (ext === ".txt") text = buffer.toString("utf8");
  if (ext === ".docx") text = (await mammoth.extractRawText({ buffer })).value;
  if (ext === ".csv") {
    const rows = parseCsv(buffer, { columns: true, skip_empty_lines: true, relax_column_count: true });
    text = rows.map((row, i) => `Row ${i + 1}: ${Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(" | ")}`).join("\n");
  }
  text = normalizeText(text);
  if (!text) throw new AppError("No readable text was found in the document", 400, "EMPTY_DOCUMENT");
  return { text, ext };
}

export async function saveUploadedFile(file, userId) {
  const ext = validateUpload(file);
  const baseDir = path.resolve(process.cwd(), env.FILE_STORAGE_DIR, String(userId));
  await fs.mkdir(baseDir, { recursive: true });
  const safeBase = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 80) || "document";
  const target = path.join(baseDir, `${Date.now()}-${crypto.randomUUID()}-${safeBase}${ext}`);
  await fs.writeFile(target, file.buffer, { flag: "wx" });
  return target;
}
