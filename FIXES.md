# Problems fixed in this simplified edition

This edition intentionally targets learning/project completion rather than production deployment.

## Database

- Removed ORM/migration dependencies and generated database code.
- Added a single `mysql2/promise` connection pool.
- Added plain SQL schema at `server/database/schema.sql`.
- Added `npm run db:init` to create/import the MySQL schema.
- Kept parameterized SQL placeholders (`?`) throughout database access.

## Errors from the previous setup

- Removed the Cloudflare-specific Worker/Hyperdrive path that caused environment/runtime complexity.
- Removed the `COM_STMT_PREPARE`/Hyperdrive prepared-statement issue by using normal local MySQL.
- Removed the Cloudflare `request.ip` rate-limit problem; standard Express rate limiting is used locally.
- Fixed agent-name database mismatches such as `NEXORA_CORE` vs `Nexora Core` by storing human-readable names directly.
- Fixed task/run status mismatches: database task/run statuses are always lowercase.
- Kept workflow state values uppercase to match the SQL schema.
- Restored `workflowService.js` with the required `createWorkflowRun`, `runWorkflow`, and `getReadyTasks` exports.
- Fixed user/message/document enum values to match the SQL schema.
- Simplified authentication transactions and role values (`user` / `admin`).
- Improved AI-provider errors so invalid key, model/endpoint, and quota errors are easier to understand.

## Features kept

- Login/register/session authentication
- Conversations and chat
- Multi-agent planning/execution/review/finalization
- Agent dashboard/observability data
- Documents and local RAG fallback
- Memory and settings
- Streaming AI responses
- Optional web search/vector database configuration
