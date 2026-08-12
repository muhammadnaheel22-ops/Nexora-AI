# Setup Guide

## 1. Create environment file

Windows PowerShell:

```powershell
Copy-Item .\server\.env.example .\server\.env
```

Edit `server/.env` and set at minimum:

```env
DATABASE_URL=mysql://root:YOUR_PASSWORD@127.0.0.1:3306/nexora_ai
JWT_SECRET=use-a-random-string-that-is-at-least-32-characters
AI_API_KEY=
```

## 2. Install packages

```powershell
npm install
```

## 3. Create MySQL tables

```powershell
npm run db:init
```

The command creates the database named in `DATABASE_URL` and imports `server/database/schema.sql`.

## 4. Start frontend and backend

```powershell
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:4000`

## 5. Test health

Open:

`http://localhost:4000/api/health`

Expected fields include `status: ok`, `database: mysql`, and `orm: none`.

## 6. Enable AI chat

Put a valid provider key in `AI_API_KEY`. Keep `AI_BASE_URL` and `AI_MODEL` aligned with the provider you use.
