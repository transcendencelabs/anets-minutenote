# MeetScribe

Meeting transcription desktop client. Connects Google Calendar, joins meetings automatically, produces speaker-aware transcripts, and saves them locally.

## What It Does

- User activates the app with an issued access token
- User connects their Google account and grants calendar access
- App fetches upcoming meetings from Google Calendar
- User enables transcription per meeting
- When an enabled meeting starts, the client automatically joins
- App captures audio, performs transcription, and attributes speech to speakers
- When the meeting ends, the transcript is saved locally as `.txt` and `.json`

## What It Does NOT Do (v1)

- No summaries, action items, or AI workflows
- No enterprise admin features
- No cloud storage of transcripts
- No deep speaker biometrics
- No support for Zoom/Teams yet (designed for extensibility)

## Architecture

```
/apps/desktop     - Electron + React desktop app
/apps/backend     - Node.js backend (token validation, OAuth)
/packages/shared  - Shared types, schemas, constants
/packages/scheduler - Meeting scheduler and lifecycle state machine
/packages/transcription - Transcription provider abstraction, speaker attribution, transcript writer
/packages/providers - Calendar and meeting provider interfaces (Google Calendar, Google Meet)
/packages/storage - Local SQLite storage layer
/packages/logging - Structured logging with correlation IDs
```

## Setup

### Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL (for backend)
- Google OAuth credentials (for calendar integration)

### Install Dependencies

```bash
npm install
```

### Backend Setup

1. Copy the environment example:
   ```bash
   cp apps/backend/.env.example apps/backend/.env
   ```

2. Edit `apps/backend/.env` with your configuration

3. Start the backend:
   ```bash
   npm run dev:backend
   ```

### Desktop App Setup

```bash
npm run dev:desktop
```

## Key Concepts

### Meeting Lifecycle State Machine

```
scheduled → pending → joining → active → ending → completed
                 ↓         ↓        ↓         ↓
              cancelled  failed   failed    failed
```

### Speaker Attribution

Three-tier confidence system:
- **known** - Speaker identity confirmed via meeting metadata
- **probable** - Stable label mapping within a session
- **unknown** - Generic fallback labels (Speaker 1, Speaker 2, etc.)

### Transcript Output

Files are saved atomically (temp file → fsync → rename) to prevent data loss.

Naming format: `YYYY-MM-DD_HHmm_<sanitized_title>.txt` / `.json`

## Testing

```bash
npm test
```

## Development Status

Implemented and real:
- Token activation flow
- Google Calendar connection flow
- Meeting lifecycle state machine
- Transcript writer with atomic file saves
- Speaker attribution service
- Scheduler with meeting run management
- Backend token validation endpoints
- Settings and preferences storage

Scaffolded with TODOs for live verification:
- Google Meet join automation (Playwright selectors need live testing)
- Audio capture from meeting sessions
- Transcription provider integration (mock provider available for development)

## License

Proprietary. All rights reserved.