# Nexora-AI

Nexora AI is a clean, local-first multi-agent workspace rebuilt from zero with React, Express, and PostgreSQL.

## Live deployment

[Open Nexora AI on Vercel](https://nexora-ai-pi-indol.vercel.app)

The production frontend is live. API-backed features require the server environment variables to be configured in Vercel.

## Features

- Secure cookie authentication with CSRF protection
- Persistent conversations and messages
- OpenRouter chat with automatic free-first model fallback and a useful offline/local mode
- Seven-agent team overview and activity log
- Dashboard metrics
- Text document library
- Per-user workspace settings
- Responsive, route-split React interface

## Requirements

- Node.js 20+
- PostgreSQL 15+ or a Neon database

## Local setup

```powershell
npm install
Copy-Item server/.env.example server/.env
npm.cmd run db:init
npm.cmd run dev
```

Open [http://localhost:5173](http://localhost:5173). The API health endpoint is [http://localhost:4000/api/health](http://localhost:4000/api/health).

The default local database connection is:

```env
DATABASE_URL=postgresql://nexora:nexora_dev_password@127.0.0.1:5432/nexora_rebuilt
```

Leave `OPENROUTER_API_KEY` empty to use local response mode. Add your OpenRouter key to `server/.env` to enable live AI responses. `AI_MODELS` is a comma-separated fallback chain. Its default order is OpenRouter Free, DeepSeek V4 Flash Latest, Gemini Flash Latest, free GPT-OSS 20B, GPT Mini Latest, and OpenRouter Auto. Nexora preserves that order across groups of three, OpenRouter's per-request fallback limit, and advances to the next group when the current group fails.

## Commands

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd run lint
npm.cmd test
npm.cmd run db:init
```

## Architecture

```text
client/  React + Vite application
server/  Express API + PostgreSQL/Neon persistence
scripts/ Cross-platform development launcher
```
