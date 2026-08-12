# Nexora AI — Simple MySQL Edition

This version is designed for project completion and learning: advanced enough to demonstrate a multi-agent AI workflow, but intentionally simpler than a production system.

## Stack

- React + Vite frontend
- Node.js + Express backend
- MySQL 8+ using `mysql2/promise`
- Raw parameterized SQL (`?` placeholders)
- Cookie/JWT authentication + CSRF token
- Multi-agent workflow: Core, Scout, Logic, Forge, Scribe, Sentinel, Memory
- Optional document/RAG support
- OpenAI-compatible Chat Completions API

There is no ORM and no migration framework. The database schema is plain SQL in `server/database/schema.sql`.

## Quick start

1. Install Node.js 20+ and MySQL 8+.
2. Copy `server/.env.example` to `server/.env`.
3. Edit `DATABASE_URL`, `JWT_SECRET`, and optionally `AI_API_KEY`.
4. From the project root run `npm install`.
5. Run `npm run db:init`.
6. Optionally set `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then run `npm run seed`.
7. Run `npm run dev`.
8. Open `http://localhost:5173`.

Backend health: `http://localhost:4000/api/health`.

## Important AI note

The app can start without an AI key, but chat workflows require `AI_API_KEY`. If the provider rejects the key, model, quota, or endpoint, the backend now returns a clear error code such as `AI_AUTH_ERROR`, `AI_NOT_FOUND`, or `AI_RATE_LIMITED`.

## Why this edition is simpler

- One local Node/Express runtime instead of a second Cloudflare-specific runtime.
- One MySQL connection pool instead of multiple database access strategies.
- Plain SQL schema instead of generated ORM files.
- Human-readable agent names are stored directly in MySQL, avoiding enum-conversion bugs.
- Database task/run statuses are normalized before inserts and updates.
