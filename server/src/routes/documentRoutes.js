import { Router } from "express";
import multer from "multer";

import { env } from "../config/env.js";
import { query } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/errors.js";
import { parseId } from "../utils/ids.js";

import { extractText, saveUploadedFile } from "../services/documentService.js";

import { deleteDocumentData, indexDocument } from "../services/ragService.js";

const router = Router();

/*
|--------------------------------------------------------------------------
| Upload Configuration
|--------------------------------------------------------------------------
*/

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
    files: 1,
  },
});

/*
|--------------------------------------------------------------------------
| Get User Documents
|--------------------------------------------------------------------------
*/

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const documents = await query(
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
        WHERE user_id = ?
        ORDER BY created_at DESC
      `,
      [req.user.id],
    );

    res.json({
      documents: documents.map((document) => ({
        ...document,

        id: String(document.id),

        userId: String(document.userId),

        fileSize:
          document.fileSize !== null && document.fileSize !== undefined
            ? String(document.fileSize)
            : null,

        chunkCount: Number(document.chunkCount || 0),
      })),
    });
  }),
);

/*
|--------------------------------------------------------------------------
| Upload Document
|--------------------------------------------------------------------------
*/

router.post(
  "/upload",

  upload.single("file"),

  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError("A file is required", 400, "FILE_REQUIRED");
    }

    const { text, ext } = await extractText(req.file);

    const storagePath = await saveUploadedFile(req.file, req.user.id);

    try {
      const document = await indexDocument({
        userId: req.user.id,

        filename: req.file.originalname,

        fileType: ext.slice(1),

        size: req.file.size,

        storagePath,

        text,
      });

      res.status(201).json({
        document: document
          ? {
              ...document,

              id: String(document.id),

              userId: String(document.userId),

              fileSize:
                document.fileSize !== null && document.fileSize !== undefined
                  ? String(document.fileSize)
                  : null,

              chunkCount: Number(document.chunkCount || 0),
            }
          : null,
      });
    } catch (error) {
      /*
      |--------------------------------------------------------------------------
      | Remove uploaded file when indexing fails
      |--------------------------------------------------------------------------
      */

      const fs = await import("node:fs/promises");

      await fs.unlink(storagePath).catch(() => {});

      throw error;
    }
  }),
);

/*
|--------------------------------------------------------------------------
| Delete Document
|--------------------------------------------------------------------------
*/

router.delete(
  "/:id",

  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id, "document id");

    /*
    |--------------------------------------------------------------------------
    | Verify ownership
    |--------------------------------------------------------------------------
    */

    const rows = await query(
      `
        SELECT id
        FROM documents
        WHERE id = ?
          AND user_id = ?
        LIMIT 1
      `,
      [id, req.user.id],
    );

    if (!rows.length) {
      throw new AppError("Document not found", 404, "NOT_FOUND");
    }

    /*
    |--------------------------------------------------------------------------
    | Delete document + vectors + physical file
    |--------------------------------------------------------------------------
    */

    await deleteDocumentData(id, req.user.id);

    res.status(204).end();
  }),
);

export default router;
