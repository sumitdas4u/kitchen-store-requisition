# Team Setup

This repo now supports a repeatable Docker-based local setup for multiple developers.

## One-time setup per machine

```bash
git clone https://github.com/sumitdas4u/kitchen-store-requisition.git
cd kitchen-store-requisition
cp .env.example .env
npm run dev:docker
```

If you are on Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
npm run dev:docker
```

## Local URLs

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Postgres from host: `localhost:5433`
- Redis from host: `localhost:6380`

## What is shared vs local

- Source code is bind-mounted into the containers, so edits on your machine hot-reload.
- Docker volumes keep your local database, Redis data, and container node modules isolated per machine.
- Git still runs on the host machine, not inside the containers.

## Team workflow

1. Create a feature branch on your machine.
2. Run `npm run dev:docker`.
3. Edit code locally; Docker picks up the changes automatically.
4. Commit and push from the host terminal.

Example:

```bash
git checkout -b feature/my-change
git add .
git commit -m "Add local Docker team setup"
git push origin feature/my-change
```

## Useful commands

```bash
npm run dev:docker
npm run dev:down
npm run dev:reset
npm run dev:logs
```

## ERP notes

- Leaving ERP credentials empty is fine for UI and auth work.
- Admin sync and live ERP-backed features will return ERP auth errors until `ERP_BASE_URL`, `ERP_API_KEY`, and `ERP_API_SECRET` are filled in.

## First login

Create the first admin user after startup:

```bash
curl -X POST http://localhost:3001/auth/bootstrap \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","full_name":"Admin","email":"admin@example.com","password":"admin12345","company":"Food Studio"}'
```

Then log in from the frontend.
