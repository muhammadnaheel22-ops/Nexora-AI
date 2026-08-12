import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "../config/env.js";

const LOCAL_DIR = path.resolve(process.cwd(), ".nexora-vector-store");

function cosine(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i += 1) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function keywordScore(query, text) {
  const terms = [...new Set(String(query || "").toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length > 2))];
  if (!terms.length) return 0;
  const hay = String(text || "").toLowerCase();
  return terms.reduce((score, term) => score + (hay.includes(term) ? 1 : 0), 0) / terms.length;
}

async function localFile(userId, documentId) {
  const dir = path.join(LOCAL_DIR, String(userId));
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, `${documentId}.json`);
}

async function localUpsert({ userId, documentId, chunks, vectors }) {
  const records = chunks.map((chunk, index) => ({
    id: crypto.randomUUID(),
    userId: String(userId),
    documentId: String(documentId),
    chunkIndex: chunk.index,
    text: chunk.content,
    vector: vectors[index] || [],
    metadata: chunk.metadata || {}
  }));
  await fs.writeFile(await localFile(userId, documentId), JSON.stringify(records), "utf8");
  return records.length;
}

async function localSearch({ userId, queryVector, queryText, documentIds = [], topK }) {
  const userDir = path.join(LOCAL_DIR, String(userId));
  let files = [];
  try { files = await fs.readdir(userDir); } catch { return []; }
  const allowed = documentIds.length ? new Set(documentIds.map(String)) : null;
  const candidates = [];
  for (const file of files.slice(0, 500)) {
    if (!file.endsWith(".json")) continue;
    const documentId = file.slice(0, -5);
    if (allowed && !allowed.has(documentId)) continue;
    try {
      const rows = JSON.parse(await fs.readFile(path.join(userDir, file), "utf8"));
      for (const row of rows) candidates.push(row);
    } catch { /* ignore corrupt local development cache file */ }
  }
  return candidates
    .map((row) => ({ ...row, score: queryVector?.length && row.vector?.length ? cosine(queryVector, row.vector) : keywordScore(queryText, row.text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ vector: _vector, ...row }) => row);
}

async function localDelete(userId, documentId) {
  try { await fs.unlink(await localFile(userId, documentId)); } catch (error) { if (error.code !== "ENOENT") throw error; }
}

function qdrantHeaders() {
  return { "content-type": "application/json", ...(env.VECTOR_DATABASE_API_KEY ? { "api-key": env.VECTOR_DATABASE_API_KEY } : {}) };
}

async function qdrantFetch(pathname, init = {}) {
  const base = env.VECTOR_DATABASE_URL.replace(/\/$/, "");
  const response = await fetch(`${base}${pathname}`, { ...init, headers: { ...qdrantHeaders(), ...(init.headers || {}) } });
  if (!response.ok) throw new Error(`Vector store failed with HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function ensureQdrantCollection(vectorSize) {
  const collection = encodeURIComponent(env.VECTOR_COLLECTION);
  const base = env.VECTOR_DATABASE_URL.replace(/\/$/, "");
  const check = await fetch(`${base}/collections/${collection}`, { headers: qdrantHeaders() });
  if (check.ok) return;
  if (check.status !== 404) throw new Error(`Vector collection check failed with HTTP ${check.status}`);
  await qdrantFetch(`/collections/${collection}`, { method: "PUT", body: JSON.stringify({ vectors: { size: vectorSize, distance: "Cosine" } }) });
}

async function qdrantUpsert({ userId, documentId, chunks, vectors }) {
  const validVector = vectors.find((v) => Array.isArray(v) && v.length);
  if (!validVector) return 0;
  await ensureQdrantCollection(validVector.length);
  const points = chunks.map((chunk, index) => ({
    id: crypto.randomUUID(),
    vector: vectors[index],
    payload: { userId: String(userId), documentId: String(documentId), chunkIndex: chunk.index, text: chunk.content, metadata: chunk.metadata || {} }
  })).filter((point) => Array.isArray(point.vector) && point.vector.length === validVector.length);
  await qdrantFetch(`/collections/${encodeURIComponent(env.VECTOR_COLLECTION)}/points?wait=true`, { method: "PUT", body: JSON.stringify({ points }) });
  return points.length;
}

async function qdrantSearch({ userId, queryVector, documentIds = [], topK }) {
  if (!queryVector?.length) return [];
  const must = [{ key: "userId", match: { value: String(userId) } }];
  if (documentIds.length) must.push({ key: "documentId", match: { any: documentIds.map(String) } });
  const data = await qdrantFetch(`/collections/${encodeURIComponent(env.VECTOR_COLLECTION)}/points/search`, {
    method: "POST",
    body: JSON.stringify({ vector: queryVector, limit: topK, with_payload: true, filter: { must } })
  });
  return (data?.result || []).map((row) => ({ id: row.id, ...row.payload, score: row.score }));
}

async function qdrantDelete(userId, documentId) {
  await qdrantFetch(`/collections/${encodeURIComponent(env.VECTOR_COLLECTION)}/points/delete?wait=true`, {
    method: "POST",
    body: JSON.stringify({ filter: { must: [
      { key: "userId", match: { value: String(userId) } },
      { key: "documentId", match: { value: String(documentId) } }
    ] } })
  });
}

export async function upsertDocumentVectors(args) {
  return env.VECTOR_DATABASE_URL ? qdrantUpsert(args) : localUpsert(args);
}

export async function searchDocumentVectors(args) {
  return env.VECTOR_DATABASE_URL ? qdrantSearch(args) : localSearch(args);
}

export async function deleteDocumentVectors(userId, documentId) {
  return env.VECTOR_DATABASE_URL ? qdrantDelete(userId, documentId) : localDelete(userId, documentId);
}
