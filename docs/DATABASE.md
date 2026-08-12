# Database

The backend uses `mysql2/promise` only.

- Pool: `server/src/services/mysqlService.js`
- Wrapper: `server/src/config/database.js`
- Schema: `server/database/schema.sql`
- Initializer: `server/src/scripts/initDb.js`

All application queries use placeholders instead of concatenating user input into SQL.

Important enum values:

- Workflow states are uppercase: `IDLE`, `PLANNING`, `EXECUTING`, `WAITING_FOR_AGENT`, `REVIEWING`, `RETRYING`, `COMPLETED`, `FAILED`, `TIMEOUT`, `CANCELLED`.
- Task/run statuses are lowercase: `pending`, `running`, `completed`, `failed`, `retrying`, `cancelled`, `timeout`.
- Agent names are human-readable, e.g. `Nexora Core` and `Nexora Scout`.
