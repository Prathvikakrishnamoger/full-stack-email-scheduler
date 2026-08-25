# Email Job Scheduler — Full-Stack MERN Application

A production-grade email scheduling service with a React dashboard, built on the MERN stack with BullMQ for reliable job scheduling.

![Tech Stack](https://img.shields.io/badge/Node.js-Express-green) ![React](https://img.shields.io/badge/React-Tailwind-blue) ![BullMQ](https://img.shields.io/badge/Queue-BullMQ-orange) ![MongoDB](https://img.shields.io/badge/DB-MongoDB-brightgreen) ![Redis](https://img.shields.io/badge/Cache-Redis-red)

---

## Table of Contents

- [Features](#features)
- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Ethereal Email Setup](#ethereal-email-setup)
- [Google OAuth Setup](#google-oauth-setup)
- [Architecture Deep-Dive](#architecture-deep-dive)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Assumptions & Trade-offs](#assumptions--trade-offs)

---

## Features

### Backend (Scheduler, Persistence, Rate Limiting, Concurrency)

| Feature | Status | Details |
|---|---|---|
| REST API for email scheduling | ✅ | POST with CSV upload, GET for scheduled/sent |
| BullMQ delayed jobs | ✅ | No cron jobs — scheduling only via BullMQ |
| MongoDB persistence | ✅ | All jobs stored with full status lifecycle |
| Restart persistence | ✅ | BullMQ delayed jobs survive Redis restarts (ZSET) |
| Idempotency (no duplicate sends) | ✅ | 3-layer: BullMQ jobId + MongoDB unique index + worker status check |
| Redis-backed rate limiting | ✅ | Lua-scripted atomic counters per hour window |
| Per-sender hourly limit | ✅ | `MAX_EMAILS_PER_HOUR_PER_SENDER` via env var |
| Global hourly limit | ✅ | `MAX_EMAILS_PER_HOUR` via env var |
| Minimum delay between sends | ✅ | BullMQ worker-level `limiter` (configurable) |
| Configurable worker concurrency | ✅ | `WORKER_CONCURRENCY` env var |
| Rate-limited job rescheduling | ✅ | `moveToDelayed()` + `DelayedError` — jobs delayed, never dropped |
| Multiple sender accounts | ✅ | Round-robin assignment, independent rate limits |
| Auto Ethereal account creation | ✅ | Creates test SMTP account if none configured |
| Graceful shutdown | ✅ | SIGTERM/SIGINT handlers close workers cleanly |
| Bulk scheduling (1000+) | ✅ | Bulk MongoDB writes + BullMQ `addBulk()` |

### Frontend (Login, Dashboard, Compose, Tables)

| Feature | Status | Details |
|---|---|---|
| Google OAuth login | ✅ | Real Google Sign-In via `@react-oauth/google` |
| JWT session management | ✅ | Stored in localStorage, auto-validated on mount |
| User profile display | ✅ | Avatar, name, email in header |
| Logout | ✅ | Clears session, redirects to login |
| Protected routes | ✅ | Dashboard requires authentication |
| Compose modal | ✅ | Subject, body, CSV upload, scheduling params |
| CSV file upload | ✅ | Drag-and-drop, email count preview, deduplication |
| Scheduled emails table | ✅ | Paginated, auto-refreshing (10s), loading/empty states |
| Sent emails table | ✅ | Paginated, auto-refreshing, status badges |
| Reusable UI components | ✅ | Button, Input, Modal, Table, Badge, FileUpload |
| Toast notifications | ✅ | Success/error feedback via react-hot-toast |
| Responsive design | ✅ | Tailwind CSS responsive utilities |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React)                      │
│  Login → Dashboard → Compose → Schedule → View Status   │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP (REST API)
┌────────────────────────▼────────────────────────────────┐
│                  Backend (Express.js)                     │
│                                                          │
│  ┌──────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │ Auth API │  │ Scheduling API │  │ Email Service    │  │
│  │ (Google) │  │ (CSV → Jobs)   │  │ (Nodemailer)     │  │
│  └──────────┘  └───────┬────────┘  └────────▲────────┘  │
│                        │                     │           │
│  ┌─────────────────────▼─────────────────────┤           │
│  │           BullMQ Queue + Worker           │           │
│  │  • Delayed jobs (Redis ZSET)              │           │
│  │  • Rate limiter (Redis INCR)              │           │
│  │  • Idempotency check (MongoDB)            │           │
│  └─────────────┬─────────────────────────────┘           │
└────────────────┼─────────────────────────────────────────┘
                 │
    ┌────────────▼────────────┐    ┌──────────────────┐
    │   Redis (Docker)        │    │  MongoDB (Docker) │
    │  • Job queue storage    │    │  • EmailJob docs  │
    │  • Rate limit counters  │    │  • User docs      │
    │  • Delayed job ZSET     │    │                   │
    └─────────────────────────┘    └──────────────────┘
```

---

## Prerequisites

- **Node.js** 18+ and npm
- **Docker** and Docker Compose (for Redis + MongoDB)
- **Google Cloud Console** project with OAuth 2.0 credentials

---

## Quick Start

### 1. Clone and Install

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Start Infrastructure (Redis + MongoDB)

```bash
# From project root
docker-compose up -d
```

This starts:
- Redis 7 on `localhost:6379` (with AOF persistence)
- MongoDB 7 on `localhost:27017`

### 3. Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your values (see Environment Variables section)

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env with your Google Client ID
```

### 4. Start Backend

```bash
cd backend
npm run dev
# Server runs on http://localhost:5000
```

On first start, if no `SENDER_ACCOUNTS` are configured, the app auto-creates an Ethereal test account and logs the credentials:
```
[Email] Auto-created Ethereal account: user@ethereal.email
[Email] Ethereal password: xxxxxxx
[Email] View sent emails at: https://ethereal.email/login
```

### 5. Start Frontend

```bash
cd frontend
npm run dev
# Dashboard runs on http://localhost:3000
```

### 6. Use the App

1. Open `http://localhost:3000`
2. Sign in with Google
3. Click "Compose New Email"
4. Upload a CSV of email addresses, set subject/body/schedule time
5. Watch emails appear in the Scheduled table, then move to Sent

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Express server port |
| `MONGO_URI` | `mongodb://localhost:27017/email-scheduler` | MongoDB connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `JWT_SECRET` | `dev-secret-change-me` | Secret for signing JWTs |
| `GOOGLE_CLIENT_ID` | — | Google OAuth Client ID (**required**) |
| `WORKER_CONCURRENCY` | `5` | Number of parallel email send jobs per worker |
| `MAX_EMAILS_PER_HOUR` | `500` | Global hourly email limit |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `100` | Per-sender hourly email limit |
| `MIN_DELAY_BETWEEN_SENDS_MS` | `2000` | Minimum ms between consecutive sends |
| `SENDER_ACCOUNTS` | `[]` | JSON array of Ethereal accounts: `[{"email":"...","pass":"..."}]` |

### Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_GOOGLE_CLIENT_ID` | — | Google OAuth Client ID (**required**, same as backend) |

---

## Ethereal Email Setup

[Ethereal Email](https://ethereal.email) is a fake SMTP service for testing. No real emails are sent.

### Option A: Auto-creation (recommended for dev)

Leave `SENDER_ACCOUNTS` empty. On startup, the app auto-creates one Ethereal account and logs the credentials. You can view sent emails at [https://ethereal.email](https://ethereal.email) using the logged credentials.

### Option B: Pre-created accounts

1. Go to [https://ethereal.email/create](https://ethereal.email/create)
2. Create one or more accounts
3. Set in `backend/.env`:
   ```
   SENDER_ACCOUNTS=[{"email":"johnny.doe@ethereal.email","pass":"xxxxxxxxxx"},{"email":"jane.doe@ethereal.email","pass":"xxxxxxxxxx"}]
   ```

Multiple sender accounts enable round-robin distribution and independent per-sender rate limits.

---

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Application type**: `Web application`
4. **Authorized JavaScript origins**:
   - `http://localhost:3000` (Vite dev server)
   - `http://localhost:5173` (Vite alternative port)
5. **Authorized redirect URIs**: (not strictly required for popup flow, but add `http://localhost:3000`)
6. Configure the **OAuth consent screen**: add app name, support email, scopes (`email`, `profile`, `openid`)
7. Copy the **Client ID** to both:
   - `backend/.env` → `GOOGLE_CLIENT_ID`
   - `frontend/.env` → `VITE_GOOGLE_CLIENT_ID`

---

## Architecture Deep-Dive

### How Scheduling Works

1. User uploads a CSV of email addresses through the dashboard
2. Backend parses the CSV, validates emails, and computes scheduled times:
   - `scheduledAt[i] = startTime + (i × delayBetweenEmails)`
3. For each email, the backend:
   - Creates an `EmailJob` document in MongoDB with a **deterministic `jobId`** (`batch-{uuid}-{index}`)
   - Enqueues a BullMQ delayed job with `delay = scheduledAt - now` and the same `jobId`
4. BullMQ uses `Queue.addBulk()` for efficient batch insertion

### How Restart Persistence Works

**BullMQ delayed jobs are stored in Redis sorted sets (ZSETs)**. The score is the Unix timestamp when the job should run.

- When the server restarts, the BullMQ worker reconnects to Redis
- Redis has AOF persistence (`--appendonly yes`), so the ZSET survives Redis restarts too
- The worker polls the sorted set: any job with `score <= Date.now()` is immediately promoted to `waiting` and processed
- **No re-enqueue logic needed** — this is built into BullMQ's architecture

MongoDB serves as the **source of truth** for job status. Even if a Redis key is lost, the MongoDB record shows the actual state.

### How Idempotency Works (No Duplicate Sends)

Three layers of protection prevent the same email from being sent twice:

1. **BullMQ `jobId` deduplication**: Adding a job with an existing `jobId` is silently ignored by BullMQ. This prevents duplicate queue entries.

2. **MongoDB `jobId` unique index**: The `EmailJob.jobId` field has a unique index. Duplicate insert attempts throw `E11000` (caught and handled gracefully).

3. **Worker-side status check**: Before sending, the worker checks `if (emailJob.status === 'sent') return`. This is the final safety net.

### How Rate Limiting Works

**Two independent layers:**

#### Layer 1: Minimum Delay Between Sends
- Uses BullMQ's built-in `Worker.limiter`:
  ```js
  limiter: { max: 1, duration: MIN_DELAY_BETWEEN_SENDS_MS }
  ```
- Ensures at most 1 job is processed per `MIN_DELAY_BETWEEN_SENDS_MS` (default: 2 seconds)
- Coordinated across all workers via Redis

#### Layer 2: Hourly Rate Limits (Per-Sender + Global)
- **Redis counters** keyed by `rate:sender:{email}:{hourWindow}` and `rate:global:{hourWindow}`
- `hourWindow = Math.floor(Date.now() / 3600000)` — changes every hour
- **Atomic Lua script**: `GET` + `INCR` + `EXPIRE` in a single Redis call
- Checks per-sender limit first, then global limit
- If global limit is hit, the sender counter is **rolled back** (`DECR`)
- On rate limit hit: the worker calls `job.moveToDelayed(nextHourTimestamp)` and throws `DelayedError`
  - The job is placed back in the delayed set, **not failed**
  - No `attemptsMade` increment
  - Job preserves its position relative to other delayed jobs

### Handling 1000+ Concurrent Emails

When a user schedules 1000+ emails at nearly the same time:

1. **Staggered scheduling**: Jobs are spread with `delayBetweenEmails` intervals
2. **BullMQ limiter**: Only 1 job per 2s is actually processed (configurable)
3. **Redis counters**: Once `MAX_EMAILS_PER_HOUR_PER_SENDER` or `MAX_EMAILS_PER_HOUR` is reached:
   - Remaining jobs are delayed to the **next hour window** start time
   - They re-enter the delayed ZSET and fire automatically in the next window
4. **Order preservation**: Delayed timestamps increase monotonically, so earlier-scheduled jobs run first

---

## Project Structure

```
full_stack_email_scheduler/
├── docker-compose.yml              # Redis + MongoDB containers
├── README.md                       # This file
├── backend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js                # Express entry point, starts worker
│       ├── config/
│       │   ├── env.js              # Centralized env var loader
│       │   ├── db.js               # MongoDB connection
│       │   └── redis.js            # Redis/ioredis connections
│       ├── models/
│       │   ├── User.js             # Google user model
│       │   └── EmailJob.js         # Email job model (core entity)
│       ├── middleware/
│       │   └── auth.js             # JWT authentication middleware
│       ├── services/
│       │   ├── emailService.js     # Nodemailer + Ethereal SMTP
│       │   ├── rateLimiterService.js  # Redis-backed rate limiting
│       │   └── schedulerService.js # Batch scheduling logic
│       ├── queue/
│       │   ├── emailQueue.js       # BullMQ Queue instance
│       │   └── emailWorker.js      # BullMQ Worker (core processor)
│       └── routes/
│           ├── auth.js             # Google OAuth endpoints
│           └── emails.js           # Email scheduling + listing
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── .env.example
    └── src/
        ├── main.jsx                # React entry point
        ├── App.jsx                 # Router with protected routes
        ├── index.css               # Tailwind CSS imports
        ├── context/
        │   └── AuthContext.jsx     # Auth state management
        ├── api/
        │   ├── axios.js            # Axios instance with JWT interceptor
        │   ├── authApi.js          # Auth API calls
        │   └── emailApi.js         # Email API calls
        ├── pages/
        │   ├── LoginPage.jsx       # Google Sign-In page
        │   └── DashboardPage.jsx   # Main dashboard with tabs
        └── components/
            ├── Header.jsx          # App header with user info
            ├── ComposeModal.jsx    # Email compose form
            ├── ScheduledTable.jsx  # Scheduled emails table
            ├── SentTable.jsx       # Sent emails table
            └── ui/
                ├── Button.jsx      # Reusable button
                ├── Input.jsx       # Reusable input with label
                ├── Modal.jsx       # Reusable modal overlay
                ├── Table.jsx       # Reusable table with states
                ├── Badge.jsx       # Status badge component
                └── FileUpload.jsx  # CSV drag-and-drop upload
```

---

## API Reference

### Authentication

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/google` | Verify Google ID token, return JWT | No |
| `GET` | `/api/auth/me` | Get current user profile | Yes |

### Email Scheduling

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/emails/schedule` | Schedule batch from CSV | Yes |
| `GET` | `/api/emails/scheduled` | List scheduled emails (paginated) | Yes |
| `GET` | `/api/emails/sent` | List sent/failed emails (paginated) | Yes |

### Health

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/health` | Server health check | No |

#### POST `/api/emails/schedule`

**Content-Type**: `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `csv` | File | Yes | CSV/TXT file with email addresses |
| `subject` | String | Yes | Email subject line |
| `body` | String | Yes | Email body (HTML supported) |
| `startTime` | ISO String | Yes | When to begin sending |
| `delayBetweenEmails` | Number | No | Seconds between emails (default: 2) |

---

## Assumptions & Trade-offs

### Assumptions
- **Single-instance backend**: The architecture supports multiple workers on the same Redis, but the current setup runs a single Express server with an embedded worker. For production, the worker could be split into a separate process.
- **Ethereal for SMTP**: All emails go to Ethereal (fake SMTP). Swapping to a real provider (SendGrid, SES, etc.) only requires changing the transport configuration in `emailService.js`.
- **CSV format**: Emails can be in a single column, a column named "email", or the first column of a multi-column CSV.

### Trade-offs
- **Hourly rate limit windows are fixed** (aligned to clock hours), not sliding windows. This is simpler to implement and sufficient for email rate limiting. A sliding window could be added using Redis sorted sets at the cost of more Redis operations.
- **Sender rollback on global limit**: When the global hourly limit is hit after the per-sender limit passes, the sender counter is decremented. In a high-concurrency scenario, this introduces a tiny window where the sender count could be slightly off (TOCTOU), but this is acceptable for email rate limiting.
- **No WebSocket/SSE for real-time updates**: The frontend polls every 10 seconds. For a production system, WebSocket or Server-Sent Events would provide real-time status updates.
- **JWT in localStorage**: Simpler than httpOnly cookies for a SPA, but less secure against XSS. For production, consider httpOnly cookies with CSRF protection.
- **No email retry UI**: Failed emails are retried automatically by BullMQ (3 attempts with exponential backoff), but there's no manual "retry" button in the UI.

### Design Decisions
- **BullMQ `limiter` on Worker for minimum delay**: Chosen over a custom `sleep()` because it's Redis-coordinated and works across multiple workers automatically.
- **Redis INCR + EXPIRE for hourly counters**: Chosen over sorted sets because hourly email limits don't need sub-hour precision, and INCR is O(1) vs O(log N) for ZADD.
- **`moveToDelayed()` + `DelayedError` for rate limiting**: This is the BullMQ-recommended pattern. The job stays in the queue, preserves order, and doesn't count as a failure.
- **Deterministic `jobId` (`batch-{uuid}-{index}`)**: Ensures that re-submitting the same batch (e.g., due to a network error) doesn't create duplicate jobs in either MongoDB or BullMQ.
