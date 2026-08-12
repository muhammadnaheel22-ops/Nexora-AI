import fs from "node:fs/promises";
import path from "node:path";

import { execute } from "./mysqlService.js";

import { embedTexts } from "./aiService.js";
import { env } from "../config/env.js";
import { chunkText } from "./documentService.js";

import {
  upsertDocumentVectors,
  searchDocumentVectors,
  deleteDocumentVectors,
} from "./vectorStoreService.js";

import { parseId } from "../utils/ids.js";

/*
|--------------------------------------------------------------------------
| Index Document
|--------------------------------------------------------------------------
*/

export async function indexDocument({
  userId,
  filename,
  fileType,
  size,
  storagePath,
  text,
  signal,
}) {
  let documentId = null;

  try {
    /*
    |--------------------------------------------------------------------------
    | Create document record
    |--------------------------------------------------------------------------
    */

    const result = await execute(
      `
      INSERT INTO documents (
        user_id,
        filename,
        file_type,
        file_size,
        storage_path,
        status,
        chunk_count,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, 'processing', 0, NOW(), NOW())
      `,
      [userId, filename, fileType || null, size || 0, storagePath || null],
    );

    documentId = result.insertId;

    /*
    |--------------------------------------------------------------------------
    | Split document into chunks
    |--------------------------------------------------------------------------
    */

    const chunks = chunkText(
      text,
      env.RAG_CHUNK_SIZE,
      env.RAG_CHUNK_OVERLAP,
    ).map((chunk) => ({
      ...chunk,

      metadata: {
        filename,
        fileType,
      },
    }));

    /*
    |--------------------------------------------------------------------------
    | Generate embeddings
    |--------------------------------------------------------------------------
    */

    let vectors = [];

    try {
      vectors = await embedTexts(
        chunks.map((chunk) => chunk.content),
        signal,
      );
    } catch (error) {
      console.warn(
        "Embedding generation failed. Using lexical fallback.",
        error,
      );

      vectors = chunks.map(() => []);
    }

    /*
    |--------------------------------------------------------------------------
    | Store vectors
    |--------------------------------------------------------------------------
    */

    const stored = await upsertDocumentVectors({
      userId,
      documentId,
      chunks,
      vectors,
    });

    const chunkCount = stored || chunks.length;

    /*
    |--------------------------------------------------------------------------
    | Mark document READY
    |--------------------------------------------------------------------------
    */

    await execute(
      `
      UPDATE documents
      SET
        status = 'ready',
        chunk_count = ?,
        error_message = NULL,
        updated_at = NOW()
      WHERE id = ?
      `,
      [chunkCount, documentId],
    );

    /*
    |--------------------------------------------------------------------------
    | Return updated document
    |--------------------------------------------------------------------------
    */

    const rows = await execute(
      `
      SELECT
        id,
        user_id AS userId,
        filename,
        file_type AS fileType,
        file_size AS fileSize,
        storage_path AS storagePath,
        status,
        chunk_count AS chunkCount,
        error_message AS errorMessage,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM documents
      WHERE id = ?
      LIMIT 1
      `,
      [documentId],
    );

    return rows[0] || null;
  } catch (error) {
    /*
    |--------------------------------------------------------------------------
    | Mark failed document
    |--------------------------------------------------------------------------
    */

    if (documentId !== null) {
      try {
        await execute(
          `
          UPDATE documents
          SET
            status = 'failed',
            error_message = ?,
            updated_at = NOW()
          WHERE id = ?
          `,
          [
            String(error?.message || "Unknown document processing error"),
            documentId,
          ],
        );
      } catch (updateError) {
        console.error("Unable to update failed document:", updateError);
      }
    }

    throw error;
  }
}

/*
|--------------------------------------------------------------------------
| Retrieve RAG Context
|--------------------------------------------------------------------------
*/

export async function retrieveContext({
  userId,
  query,
  documentIds = [],
  topK = env.RAG_TOP_K,
  signal,
}) {
  /*
  |--------------------------------------------------------------------------
  | Parse document IDs
  |--------------------------------------------------------------------------
  */

  const parsedIds = documentIds.map((id) => parseId(id, "document id"));

  /*
  |--------------------------------------------------------------------------
  | Verify document ownership
  |--------------------------------------------------------------------------
  */

  if (parsedIds.length > 0) {
    const placeholders = parsedIds.map(() => "?").join(",");

    const owned = await execute(
      `
      SELECT id
      FROM documents
      WHERE user_id = ?
        AND status = 'ready'
        AND id IN (${placeholders})
      `,
      [userId, ...parsedIds],
    );

    if (owned.length !== parsedIds.length) {
      throw new Error(
        "One or more selected documents are unavailable or not owned by this user",
      );
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Generate query embedding
  |--------------------------------------------------------------------------
  */

  let queryVector = null;

  try {
    const vectors = await embedTexts([query], signal);

    queryVector = vectors?.[0] || null;
  } catch (error) {
    console.warn("Query embedding failed. Using lexical fallback.", error);
  }

  /*
  |--------------------------------------------------------------------------
  | Search vector store
  |--------------------------------------------------------------------------
  */

  const results = await searchDocumentVectors({
    userId,

    queryVector,

    queryText: query,

    documentIds: parsedIds.map(String),

    topK,
  });

  /*
  |--------------------------------------------------------------------------
  | Normalize response
  |--------------------------------------------------------------------------
  */

  return results.map((row) => ({
    documentId: String(row.documentId),

    chunkIndex: Number(row.chunkIndex || 0),

    text: row.text,

    score: Number(row.score || 0),

    metadata: row.metadata || {},
  }));
}

/*
|--------------------------------------------------------------------------
| Delete Document
|--------------------------------------------------------------------------
*/

export async function deleteDocumentData(documentId, userId) {
  /*
  |--------------------------------------------------------------------------
  | Validate ID
  |--------------------------------------------------------------------------
  */

  const id =
    typeof documentId === "bigint"
      ? documentId
      : parseId(documentId, "document id");

  /*
  |--------------------------------------------------------------------------
  | Find owned document
  |--------------------------------------------------------------------------
  */

  const rows = await execute(
    `
    SELECT
      id,
      user_id AS userId,
      storage_path AS storagePath
    FROM documents
    WHERE id = ?
      AND user_id = ?
    LIMIT 1
    `,
    [id, userId],
  );

  const doc = rows[0];

  if (!doc) {
    return false;
  }

  /*
  |--------------------------------------------------------------------------
  | Delete vector data
  |--------------------------------------------------------------------------
  */

  await deleteDocumentVectors(userId, id);

  /*
  |--------------------------------------------------------------------------
  | Delete physical file
  |--------------------------------------------------------------------------
  */

  if (doc.storagePath) {
    try {
      const absolute = path.resolve(doc.storagePath);

      await fs.unlink(absolute);
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | Delete database record
  |--------------------------------------------------------------------------
  */

  await execute(
    `
    DELETE FROM documents
    WHERE id = ?
      AND user_id = ?
    `,
    [id, userId],
  );

  return true;
}
