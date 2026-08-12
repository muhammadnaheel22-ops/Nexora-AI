# Nexora AI — Simple MySQL Edition

This version is designed for project completion and learning: advanced enough to demonstrate a multi-agent AI workflow, but intentionally simpler than a production system.

## Tech Stack

- React + Vite frontend
- Node.js + Express backend
- MySQL 8+ using `mysql2/promise`
- Raw parameterized SQL (`?` placeholders)
- Cookie/JWT authentication + CSRF protection
- Multi-agent workflow:
  - Nexora Core
  - Nexora Scout
  - Nexora Logic
  - Nexora Forge
  - Nexora Scribe
  - Nexora Sentinel
  - Nexora Memory
- Optional document/RAG support
- Groq AI via OpenAI-compatible Chat Completions API

There is no ORM and no migration framework.

The database schema is plain SQL in:

`server/database/schema.sql`

---

## Local Development

### Requirements

- Node.js 20+
- Docker Desktop or MySQL 8+
- Groq API key

### Setup

1. Copy `server/.env.example` to `server/.env`.
2. Configure:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `AI_API_KEY`
   - `AI_BASE_URL`
   - `AI_MODEL`
3. Install dependencies:

```bash
npm install
