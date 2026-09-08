# 🚀 AI Talent Acquisition

A simple full-stack app with a Next.js frontend, Express backend, and Playwright E2E tests — all wired together with Docker Compose and GitHub Actions CI.

## Project Structure

```
.
├── backend/          # Express.js API (port 8000)
├── frontend/         # Next.js 14 app (port 3000)
│   └── tests/        # Playwright E2E tests
├── docker-compose.yml
└── .github/workflows/main.yml
```

## Running Locally

```bash
# Start everything
docker compose up --build

# Frontend → http://localhost:3000
# Backend  → http://localhost:8000
```

## Running Tests

```bash
cd frontend
npm ci
npx playwright install chromium --with-deps
npx playwright test
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| GET | `/api/health` | Health JSON |
| GET | `/api/jobs` | Job listings |
