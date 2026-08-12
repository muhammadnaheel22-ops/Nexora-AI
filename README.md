# 🤖 Nexora AI

### Production-Ready Multi-Agent AI Platform

Nexora AI is a full-stack multi-agent AI platform that orchestrates specialized AI agents to research, reason, build, review, and generate high-quality responses through intelligent workflows.

It combines a modern React interface, Node.js backend, MySQL persistence, Groq-powered AI inference, document-aware context, and real-time agent execution.

---

## ✨ Features

- 🤖 Multi-agent AI orchestration
- 💬 Real-time streaming AI chat
- 🧠 Intelligent task planning
- 🔍 Research and evidence gathering
- ⚙️ Technical analysis and code generation
- 📝 AI-assisted writing
- 🛡️ Automated quality review
- 💾 Persistent conversation history
- 📂 Document-aware AI / RAG support
- 🔐 JWT authentication
- 🛡️ CSRF protection
- 📊 AI workflow visualization
- 🌙 Modern responsive UI
- 🗄️ MySQL persistent storage
- ⚡ Groq-powered AI inference

---

## 🧠 Multi-Agent Architecture

Nexora AI uses specialized agents instead of relying on a single AI assistant.

| Agent | Responsibility |
|---|---|
| **Nexora Core** | Plans and orchestrates AI workflows |
| **Nexora Scout** | Research and evidence collection |
| **Nexora Logic** | Analysis, comparisons and reasoning |
| **Nexora Forge** | Coding, debugging and technical solutions |
| **Nexora Scribe** | Reports, summaries and polished responses |
| **Nexora Memory** | Context and document retrieval |
| **Nexora Sentinel** | Quality assurance and response review |

### Workflow

```text
                         User Request
                              │
                              ▼
                        Nexora Core
                        Orchestrator
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         Nexora Scout    Nexora Logic    Nexora Forge
          Research        Analysis        Technical
              │               │               │
              └───────────────┼───────────────┘
                              ▼
                        Nexora Scribe
                              │
                              ▼
                       Nexora Sentinel
                         QA / Review
                              │
                              ▼
                         Final Response
```

Nexora Core dynamically selects the required specialists, so every request does not need to execute every agent.

---

## 🛠️ Tech Stack

### Frontend

- React
- Vite
- Tailwind CSS
- Lucide React

### Backend

- Node.js
- Express.js
- REST API
- Server-Sent Events (SSE)

### Database

- MySQL 8+
- `mysql2/promise`
- Parameterized SQL queries

### AI

- Groq API
- OpenAI-compatible Chat Completions API
- Structured AI responses
- Streaming responses
- Multi-agent orchestration

### Security

- JWT authentication
- HTTP cookies
- CSRF protection
- Rate limiting
- Input validation

---

## 🏗️ System Architecture

```text
                         ┌───────────────────┐
                         │       User        │
                         └─────────┬─────────┘
                                   │
                                   ▼
                         ┌───────────────────┐
                         │  Vercel Frontend  │
                         │   React + Vite    │
                         └─────────┬─────────┘
                                   │ HTTPS
                                   ▼
                         ┌───────────────────┐
                         │  Render Backend   │
                         │  Node + Express   │
                         └─────┬────────┬────┘
                               │        │
                     SQL       │        │ AI API
                               ▼        ▼
                    ┌──────────────┐  ┌──────────────┐
                    │ Aiven MySQL  │  │   Groq API   │
                    │   Database   │  │ AI Inference │
                    └──────────────┘  └──────────────┘
```

---

## 📁 Project Structure

```text
Nexora-AI/
│
├── client/                 # React + Vite frontend
├── server/                 # Node.js + Express backend
│   ├── database/           # Database schema
│   ├── src/
│   │   ├── agents/         # Multi-agent system
│   │   ├── config/         # Application configuration
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business and AI services
│   │   └── utils/          # Shared utilities
│   └── .env.example
│
├── scripts/
├── docker-compose.yml
├── package.json
└── README.md
```

---

# 💻 Local Development

## Requirements

Before starting, install:

- Node.js 20+
- npm
- Docker Desktop or MySQL 8+
- Groq API key

---

## 1. Clone Repository

```bash
git clone https://github.com/muhammadnaheel22-ops/Nexora-AI.git

cd Nexora-AI
```

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Configure Backend Environment

Copy:

```text
server/.env.example
```

to:

```text
server/.env
```

Configure your local environment variables.

Example:

```env
NODE_ENV=development

PORT=4000

DATABASE_URL=mysql://USERNAME:PASSWORD@127.0.0.1:3306/nexora_ai

JWT_SECRET=YOUR_SECURE_SECRET

AI_API_KEY=YOUR_GROQ_API_KEY

AI_BASE_URL=https://api.groq.com/openai/v1

AI_MODEL=YOUR_GROQ_MODEL

CORS_ORIGIN=http://localhost:5173
```

Never commit `server/.env` to GitHub.

---

## 4. Start MySQL

When using Docker:

```bash
docker compose up -d mysql
```

---

## 5. Initialize Database

```bash
npm run db:init
```

Database schema:

```text
server/database/schema.sql
```

---

## 6. Start Development Environment

```bash
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:4000
```

Backend health check:

```text
http://localhost:4000/api/health
```

---

# 🚀 Production Deployment

The production deployment uses separate services for the frontend, backend, database, and AI provider.

| Component | Platform |
|---|---|
| Frontend | Vercel |
| Backend API | Render |
| Database | Aiven MySQL |
| AI Provider | Groq |
| Source Control | GitHub |

---

## 1. Database — Aiven MySQL

Create a managed MySQL service on Aiven.

Configure the Render backend with the Aiven connection URI:

```env
DATABASE_URL=mysql://USERNAME:PASSWORD@HOST:PORT/DATABASE
```

Initialize the production database using:

```text
server/database/schema.sql
```

---

## 2. Backend — Render

Deploy the Node.js/Express backend to Render.

Recommended configuration:

```text
Root Directory: server
Build Command: npm install
Start Command: npm start
```

Configure production environment variables:

```env
NODE_ENV=production

DATABASE_URL=YOUR_AIVEN_MYSQL_URL

JWT_SECRET=YOUR_PRODUCTION_JWT_SECRET

AI_API_KEY=YOUR_GROQ_API_KEY

AI_BASE_URL=https://api.groq.com/openai/v1

AI_MODEL=YOUR_GROQ_MODEL

CORS_ORIGIN=https://YOUR-VERCEL-DOMAIN.vercel.app
```

Example backend URL:

```text
https://YOUR-RENDER-SERVICE.onrender.com
```

Health check:

```text
https://YOUR-RENDER-SERVICE.onrender.com/api/health
```

---

## 3. Frontend — Vercel

Deploy the `client` application to Vercel.

Configuration:

```text
Framework: Vite
Root Directory: client
Build Command: npm run build
Output Directory: dist
```

Configure:

```env
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

Example production URL:

```text
https://YOUR-PROJECT.vercel.app
```

---

## 4. Production CORS

After receiving your Vercel URL, update the Render environment variable:

```env
CORS_ORIGIN=https://YOUR-PROJECT.vercel.app
```

Restart or redeploy the backend after changing it.

---

## 🔐 Environment & Security

Never commit any of the following:

```text
.env
server/.env
API keys
JWT secrets
database passwords
production credentials
```

Keep secrets in the environment-variable settings provided by Render, Vercel, and other production services.

---

## 🗺️ Deployment Flow

```text
Developer
    │
    │ git push
    ▼
 GitHub
    │
    ├──────────────────────────┐
    │                          │
    ▼                          ▼
 Vercel                      Render
 Frontend                    Backend
    │                          │
    │                          ├──────────► Groq
    │                          │             AI
    │                          │
    └──────── HTTPS ───────────┤
                               │
                               ▼
                         Aiven MySQL
```
## 👨‍💻 Author

**Muhammad Naheel**

Nexora AI — Multi-Agent AI Platform

