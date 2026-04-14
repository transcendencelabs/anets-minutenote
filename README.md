# MeetScribe

**Meeting transcription desktop client** — Connects Google Calendar, joins meetings automatically, produces speaker-aware transcripts, and saves them locally.

---

## Table of Contents

- [Overview](#overview)
- [What MeetScribe Does](#what-meetscribe-does)
- [What MeetScribe Does NOT Do (v1)](#what-meetscribe-does-not-do-v1)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Technology Stack](#technology-stack)
- [Key Concepts](#key-concepts)
  - [Meeting Lifecycle State Machine](#meeting-lifecycle-state-machine)
  - [Speaker Attribution](#speaker-attribution)
  - [Transcript Output](#transcript-output)
  - [Provider Interfaces](#provider-interfaces)
  - [Atomic File Writes](#atomic-file-writes)
- [Data Model](#data-model)
- [API Reference](#api-reference)
- [Setup & Installation](#setup--installation)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Desktop App Setup](#desktop-app-setup)
  - [Development Mode](#development-mode)
- [Testing](#testing)
- [Environment Variables](#environment-variables)
- [Development Status](#development-status)
- [Known Hard Problems](#known-hard-problems)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

MeetScribe is a focused alternative to products like Read.ai and Otter, but narrower in scope. The product handles only:

1. **Meeting detection** — Fetches upcoming meetings from Google Calendar
2. **Opt-in enablement** — User explicitly enables transcription per meeting
3. **Meeting joining** — Automatically joins the meeting when it starts
4. **Speaker-aware transcription** — Captures audio, transcribes, and attributes speech to speakers
5. **End-of-meeting detection** — Stops when participants leave or meeting ends
6. **Local transcript saving** — Saves transcript to a user-selected folder

The experience is designed to feel reliable, quiet, and deterministic.

---

## What MeetScribe Does

- User signs in to the desktop app
- User activates their license or access token (only users with a valid issued token can use the product)
- User connects their Google account and grants calendar read access
- App fetches upcoming meetings from Google Calendar and shows them in a list
- For each upcoming meeting, the user can enable or disable transcription
- When an enabled meeting starts, the client automatically joins
- Once in the meeting, the client captures audio, performs transcription, and attributes speech to speakers
- When all participants have left or the meeting ends, the session stops automatically
- The transcript is saved to a local folder chosen by the user
- Transcript file naming is deterministic and human-readable
- Transcripts are stored locally by default (privacy-first)

---

## What MeetScribe Does NOT Do (v1)

- ❌ Action items, summaries, coaching, sentiment, analytics
- ❌ CRM sync, Slack posting, or any post-meeting AI workflow
- ❌ Enterprise admin features
- ❌ Multi-tenant cloud storage
- ❌ Deep speaker biometrics (uses practical attribution + meeting metadata)
- ❌ Support for Zoom or Microsoft Teams (designed for extensibility via provider interface)
- ❌ Meeting assistant behavior — the bot does not speak, post chat messages, or alter the meeting

---

## Architecture

MeetScribe uses a **desktop shell + small cloud control plane** architecture.

**Desktop app responsibilities:**
- UI rendering
- Local credential storage
- Calendar sync trigger
- Meeting scheduling
- Meeting joining
- Audio capture
- Transcription pipeline orchestration
- Local transcript saving

**Backend responsibilities:**
- Token issuance and validation
- Optional user/account metadata
- OAuth callback support
- Minimal audit and health telemetry
- **No transcript storage** in v1

```
┌─────────────────────────────────────────────────┐
│                  Desktop App                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │  React   │ │ Electron │ │  SQLite (local)  │ │
│  │   UI     │ │  Main    │ │  - preferences   │ │
│  │          │ │ Process  │ │  - meeting runs   │ │
│  └──────────┘ └──────────┘ │  - settings       │ │
│                             └──────────────────┘ │
│  ┌─────────────────────────────────────────────┐ │
│  │            Scheduler & Lifecycle             │ │
│  │  - Meeting state machine                    │ │
│  │  - Calendar refresh                         │ │
│  │  - Meeting run orchestration                │ │
│  └─────────────────────────────────────────────┘ │
│  ┌────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │ Calendar   │ │  Meeting     │ │Transcription│ │
│  │ Provider   │ │  Provider    │ │  Provider   │ │
│  │(Google Cal)│ │(Google Meet) │ │ (Pluggable) │ │
│  └────────────┘ └──────────────┘ └────────────┘ │
└──────────────────────┬──────────────────────────┘
                       │ HTTPS
┌──────────────────────┴──────────────────────────┐
│                  Backend Service                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Express  │ │PostgreSQL│ │  Token Registry  │ │
│  │   API    │ │          │ │  - validation     │ │
│  └──────────┘ └──────────┘ │  - issuance       │ │
│                             └──────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Repository Structure

```
meetscribe/
├── apps/
│   ├── desktop/                    # Electron + React desktop application
│   │   ├── src/
│   │   │   ├── main/              # Electron main process
│   │   │   │   └── main.ts        # App lifecycle, IPC handlers, DB init
│   │   │   └── renderer/          # React UI
│   │   │       ├── App.tsx        # Main app component (activation, meetings, settings)
│   │   │       ├── main.tsx       # React entry point
│   │   │       └── index.html     # HTML shell
│   │   ├── vite.config.ts         # Vite config for renderer
│   │   ├── tsconfig.main.json     # TypeScript config for main process
│   │   └── package.json
│   │
│   └── backend/                   # Node.js backend service
│       ├── src/
│       │   ├── server.ts          # Express server entry point
│       │   ├── db.ts              # PostgreSQL connection pool & migrations
│       │   └── routes/
│       │       ├── health.ts      # Health check endpoints
│       │       ├── tokens.ts      # Token activation, validation, issuance
│       │       └── auth.ts        # Google OAuth URL & callback
│       ├── .env.example           # Environment variable template
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── shared/                    # Shared types, schemas, constants
│   │   └── src/
│   │       ├── types.ts           # All TypeScript interfaces & types
│   │       ├── schemas.ts         # Zod runtime validation schemas
│   │       └── constants.ts       # Timeouts, file naming, app constants
│   │
│   ├── scheduler/                 # Meeting scheduler & lifecycle state machine
│   │   └── src/
│   │       ├── meeting-lifecycle.ts  # Strict state machine with transition validation
│   │       ├── scheduler.ts         # Meeting scheduling, run management, calendar sync
│   │       └── __tests__/
│   │           └── meeting-lifecycle.test.ts
│   │
│   ├── transcription/            # Transcription pipeline
│   │   └── src/
│   │       ├── transcription-provider.ts  # TranscriptionProvider interface
│   │       ├── speaker-attribution.ts     # 3-tier speaker attribution service
│   │       ├── transcript-writer.ts       # Atomic file writer (txt + json)
│   │       ├── mock-transcription-provider.ts  # Mock provider for development
│   │       └── __tests__/
│   │           └── transcript-writer.test.ts
│   │
│   ├── providers/                 # Calendar & meeting provider interfaces
│   │   └── src/
│   │       ├── calendar-provider.ts       # CalendarProvider interface
│   │       ├── meeting-provider.ts        # MeetingProvider interface
│   │       ├── google-calendar-provider.ts # Real Google Calendar API client
│   │       ├── google-meet-provider.ts    # Google Meet Playwright scaffolding
│   │       └── mock-meeting-provider.ts   # Mock provider for development
│   │
│   ├── storage/                   # Local SQLite storage
│   │   └── src/
│   │       ├── database.ts        # DatabaseManager with full CRUD operations
│   │       └── migrations.ts      # Schema migrations (versioned)
│   │
│   └── logging/                   # Structured logging
│       └── src/
│           └── logger.ts          # Logger with correlation IDs, levels, transports
│
├── package.json                   # Root workspace config
├── tsconfig.base.json             # Shared TypeScript config
├── .gitignore
├── README.md                      # This file
└── USER_GUIDE.md                  # End-user instructions
```

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop Shell | Electron | Mature desktop packaging for Windows & macOS, strong filesystem support, browser automation options |
| UI | React + TypeScript | Component-based UI with type safety |
| Local Database | SQLite (better-sqlite3) | Zero-config embedded database, WAL mode for reliability |
| Local Secrets | OS-native secure storage | keytar / credential store (not plain text) |
| Backend | Node.js + Express | TypeScript throughout, shared types with desktop |
| Backend Database | PostgreSQL | Token registry, OAuth metadata |
| Calendar API | Google APIs (googleapis) | Official Google Calendar client |
| Meeting Automation | Playwright | Browser-based provider automation |
| Validation | Zod | Runtime schema validation |
| Logging | Custom structured logger | Correlation IDs per meeting run, level-based filtering |

---

## Key Concepts

### Meeting Lifecycle State Machine

Every meeting run follows a strict lifecycle with enforced valid transitions:

```
                    ┌──────────┐
                    │ scheduled │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
              ┌─────│ pending  │─────┐
              │     └────┬─────┘     │
              │          │           │
         ┌────▼─────┐   │    ┌──────▼──────┐
         │ cancelled│   │    │   failed    │
         └──────────┘   │    └─────────────┘
                    ┌────▼─────┐
              ┌─────│ joining  │─────┐
              │     └────┬─────┘     │
              │          │           │
         ┌────▼─────┐   │    ┌──────▼──────┐
         │ cancelled│   │    │   failed    │
         └──────────┘   │    └─────────────┘
                    ┌────▼─────┐
              ┌─────│  active  │─────┐
              │     └────┬─────┘     │
              │          │           │
         ┌────▼─────┐   │    ┌──────▼──────┐
         │  failed  │   │    │   failed    │
         └──────────┘   │    └─────────────┘
                    ┌────▼─────┐
              ┌─────│  ending  │─────┐
              │     └────┬─────┘     │
              │          │           │
         ┌────▼──────┐  │    ┌──────▼──────┐
         │  failed   │  │    │   failed    │
         └───────────┘  │    └─────────────┘
                    ┌────▼──────┐
                    │ completed │  ← terminal
                    └───────────┘
```

**Terminal states:** `completed`, `failed`, `cancelled` — no further transitions allowed.

**Why a state machine?** Prefer explicit state machines over loosely coupled background timers. Every meeting run has a clear lifecycle. Invalid transitions throw `MeetingLifecycleError`. All transitions are logged with correlation IDs.

### Speaker Attribution

Three-tier confidence system:

| Confidence | Meaning | Label Example |
|-----------|---------|---------------|
| `known` | Speaker identity confirmed via meeting metadata (attendee list + stable voice/session evidence) | "Alice Johnson" |
| `probable` | Stable label mapping within a session (same voice → same label) | "Speaker 1" |
| `unknown` | Generic fallback, no identity information | "Speaker 2" |

**The system never labels a person by name unless it has enough confidence.** If uncertain, it falls back to generic labels rather than overclaiming.

### Transcript Output

Two files per meeting:

1. **Plain text** (`YYYY-MM-DD_HHmm_<sanitized_title>.txt`) — Human-readable with timestamps and speaker labels
2. **Structured JSON** (`YYYY-MM-DD_HHmm_<sanitized_title>.json`) — Machine-readable with full metadata

JSON schema includes:
- `meeting_id`, `event_id`, `title`, `start_time`, `end_time`
- `calendar_source`, `platform`
- `participants_detected`
- `transcript_segments` (with `started_at_ms`, `ended_at_ms`, `speaker_label`, `speaker_confidence`, `text`)
- `output_path`, `session_status`

### Provider Interfaces

Three core abstractions designed for extensibility:

**CalendarProvider** — Connect, list upcoming meetings, refresh, handle OAuth
**MeetingProvider** — Can handle URL, join meeting, get participants, get audio stream, detect end, leave
**TranscriptionProvider** — Start session, transcribe chunk, end session

Zoom and Microsoft Teams can be added later by implementing the `MeetingProvider` interface.

### Atomic File Writes

Transcript files are written using an atomic write strategy to prevent data loss:

1. Write content to a temporary file (`.tmp_` prefix)
2. Call `fsync` to flush to disk
3. Rename temp file to final filename (atomic on most filesystems)

If the app crashes mid-write, the temp file is left behind (no corrupted final file). On next run, partial transcripts are saved with a `_partial` suffix.

---

## Data Model

### Local SQLite (Desktop App)

| Table | Purpose |
|-------|---------|
| `users` | Local user record, token status |
| `calendar_connections` | OAuth state per calendar provider |
| `meeting_preferences` | Per-meeting enable/disable, folder override |
| `meeting_runs` | Meeting session records with lifecycle state |
| `transcript_segments` | Individual transcript segments with speaker labels |
| `app_settings` | Single-row settings storage |

### Backend PostgreSQL

| Table | Purpose |
|-------|---------|
| `users` | User account with email and token status |
| `tokens` | Token hashes, status, expiration, revocation |

---

## API Reference

### Backend Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Service health check |
| `GET` | `/api/health/ready` | Readiness check |
| `POST` | `/api/tokens/activate` | Validate and activate an access token |
| `POST` | `/api/tokens/validate` | Check if a token is valid (no activation) |
| `POST` | `/api/tokens/issue` | Issue a new token for a user (admin) |
| `GET` | `/api/auth/google/url` | Get Google OAuth authorization URL |
| `GET` | `/api/auth/google/callback` | Handle OAuth callback from Google |

### Desktop IPC Channels

| Channel | Direction | Description |
|---------|-----------|-------------|
| `activate-token` | Renderer → Main | Validate access token |
| `pick-folder` | Renderer → Main | Open folder picker dialog |
| `get-settings` | Renderer → Main | Retrieve app settings |
| `update-settings` | Renderer → Main | Update app settings |
| `get-meetings` | Renderer → Main | Fetch upcoming meetings |
| `enable-meeting` | Renderer → Main | Enable transcription for a meeting |
| `disable-meeting` | Renderer → Main | Disable transcription for a meeting |

---

## Setup & Installation

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- **PostgreSQL** 14+ (for backend)
- **Google OAuth credentials** (for calendar integration)
- **Electron** dependencies (for desktop app packaging)

### PostgreSQL Setup

The backend requires PostgreSQL 14+ for token validation and user management. Here's how to set it up:

#### Installing PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Windows:**
1. Download PostgreSQL from [postgresql.org/download/windows](https://www.postgresql.org/download/windows/)
2. Run the installer — note the superuser password you set for `postgres`
3. PostgreSQL installs as a Windows service and starts automatically

**Docker (any platform):**
```bash
docker run -d \
  --name meetscribe-postgres \
  -e POSTGRES_USER=meetscribe \
  -e POSTGRES_PASSWORD=meetscribe \
  -e POSTGRES_DB=meetscribe \
  -p 5432:5432 \
  postgres:16-alpine
```

#### Creating the Database and User

After installing PostgreSQL, create a dedicated database and user for MeetScribe:

```bash
# Connect to PostgreSQL as the superuser (default user is 'postgres')
# On macOS/Linux with Homebrew, the default user is your system username
psql -U postgres
```

Then run these SQL commands:

```sql
-- Create a dedicated user for MeetScribe
CREATE USER meetscribe WITH PASSWORD 'meetscribe';

-- Create the database owned by the meetscribe user
CREATE DATABASE meetscribe OWNER meetscribe;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE meetscribe TO meetscribe;

-- Connect to the meetscribe database and grant schema privileges
\c meetscribe
GRANT ALL PRIVILEGES ON SCHEMA public TO meetscribe;
```

> **Security note:** Change the default password `meetscribe` to a strong password in production. Update the `DATABASE_URL` in your `.env` file accordingly.

#### Verifying the Connection

Test that MeetScribe can connect to PostgreSQL:

```bash
psql -U meetscribe -d meetscribe -h localhost -p 5432
```

If you see the `meetscribe=>` prompt, the connection works. Type `\q` to exit.

#### Database Migrations

MeetScribe automatically runs migrations on startup. The backend creates the required tables (`users` and `tokens`) when it first connects. No manual migration steps are needed.

#### Connection String Format

The `DATABASE_URL` in your `.env` file follows this format:

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

Examples:

| Environment | DATABASE_URL |
|------------|-------------|
| Local development (default) | `postgresql://meetscribe:meetscribe@localhost:5432/meetscribe` |
| Docker | `postgresql://meetscribe:meetscribe@localhost:5432/meetscribe` |
| Custom password | `postgresql://meetscribe:my_secure_password@localhost:5432/meetscribe` |
| Remote server | `postgresql://meetscribe:password@db.example.com:5432/meetscribe` |

> **Note:** The backend will log a warning and continue running without a database connection, but token validation and user management endpoints will not work until PostgreSQL is available.

### Backend Setup

1. **Install all dependencies** from the repository root:
   ```bash
   npm install
   ```

2. **Copy the environment example**:
   ```bash
   cp apps/backend/.env.example apps/backend/.env
   ```

3. **Configure environment variables** in `apps/backend/.env`:
   - `DATABASE_URL` — PostgreSQL connection string (see [PostgreSQL Setup](#postgresql-setup) above)
   - `GOOGLE_CLIENT_ID` — From Google Cloud Console
   - `GOOGLE_CLIENT_SECRET` — From Google Cloud Console
   - `GOOGLE_REDIRECT_URI` — Must match OAuth config (e.g., `http://localhost:3456/api/auth/google/callback`)
   - `TOKEN_VALIDATION_SECRET` — Secret for token hashing (generate with `openssl rand -hex 32`)

4. **Ensure PostgreSQL is running** (see [PostgreSQL Setup](#postgresql-setup) above)

5. **Start the backend**:
   ```bash
   npm run dev:backend
   ```
   The server starts on port 3456 by default. You should see:
   ```
   [INFO] MeetScribe Backend starting... { port: 3456 }
   [INFO] Database connection established
   [INFO] MeetScribe Backend listening on port 3456
   ```

6. **Issue a test token**:
   ```bash
   curl -X POST http://localhost:3456/api/tokens/issue \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com"}'
   ```
   This returns a token you can use to activate the desktop app.

### Desktop App Setup

1. **Build all packages**:
   ```bash
   npm run build
   ```

2. **Start the desktop app**:
   ```bash
   npm run dev:desktop
   ```

3. **For renderer development with hot reload**:
   ```bash
   npm run dev:renderer
   ```

### Development Mode

The desktop app runs in development mode when `NODE_ENV=development`. In this mode:
- The renderer loads from the Vite dev server at `http://localhost:5173`
- DevTools are opened automatically
- Debug logging is enabled

---

## Testing

```bash
# Run all tests
npm test

# Run tests for a specific package
npm test --workspace=@meetscribe/scheduler
npm test --workspace=@meetscribe/transcription
```

**Test coverage includes:**
- Meeting lifecycle state transitions (valid and invalid)
- Terminal state enforcement
- Transcript filename sanitization and generation
- Speaker attribution fallback logic (known → probable → unknown)
- Speaker label stability within a session
- Session reset behavior

---

## Environment Variables

See `apps/backend/.env.example` for the full list:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3456` | Backend server port |
| `NODE_ENV` | `development` | Environment mode |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `TOKEN_VALIDATION_SECRET` | — | Secret for token hashing |
| `GOOGLE_CLIENT_ID` | — | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | — | OAuth callback URL |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS allowed origins (comma-separated) |
| `LOG_LEVEL` | `info` | Logging level (debug/info/warn/error) |

---

## Development Status

### Implemented and Real

- ✅ Token activation flow (backend + desktop)
- ✅ Google Calendar connection flow (real API client)
- ✅ Meeting lifecycle state machine (strict transitions, logged)
- ✅ Transcript writer with atomic file saves
- ✅ Speaker attribution service (3-tier confidence)
- ✅ Scheduler with meeting run management
- ✅ Backend token validation endpoints (activate, validate, issue)
- ✅ Settings and preferences storage (SQLite)
- ✅ Mock providers for development without live credentials
- ✅ Structured logging with correlation IDs

### Scaffolded with TODOs (Requires Live Verification)

- 🔧 Google Meet join automation — Playwright scaffolding in place, selectors need live testing with real Google Meet
- 🔧 Audio capture from meeting sessions — Implementation depends on chosen approach (system audio, tab audio, WebRTC)
- 🔧 Transcription provider integration — Provider interface is complete; concrete provider (e.g., Whisper, Deepgram) needs API key and integration
- 🔧 Google OAuth token exchange — Callback handler acknowledges the code; full token exchange not yet implemented

---

## Known Hard Problems

1. **Joining meetings automatically is provider-dependent and brittle** — Google Meet's DOM changes frequently. Playwright selectors will break and need maintenance.

2. **Speaker identification by person name is probabilistic** — Unless the provider exposes identity cleanly, we can only attribute with confidence levels, not certainty.

3. **Audio capture paths differ across Windows and macOS** — System audio capture requires platform-specific solutions.

4. **Meeting providers may change DOM/UI flows over time** — Browser automation is inherently fragile. Defensive selectors and fallbacks are essential.

5. **A transcription-only product still needs strong failure handling** — If the app crashes mid-meeting, partial transcripts must be preserved. The atomic write strategy addresses this.

---

## Contributing

This is a private project. See `USER_GUIDE.md` for end-user instructions.

---

## License

Proprietary. All rights reserved.