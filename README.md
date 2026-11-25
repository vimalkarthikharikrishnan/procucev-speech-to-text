# Procucev Assignment: Real-time Speech to Text

Web app where the user speaks (Hindi and English mixed) and sees the speech transcribed live. Transcripts are saved in PostgreSQL and managed from a dashboard with create, read, update and delete.

## Design (simple monolith)
One Node/Express server on a single port:
- serves the built React app,
- exposes a REST API for transcript CRUD,
- accepts a WebSocket at `/ws` that receives microphone audio and streams text back.

```
Browser (React) --audio chunks--> /ws (Express + ws) --> SpeechProvider --> text
      ^                                                        |
      |------------------ live text <--------------------------|
Browser dashboard <--REST--> /api/transcripts <--> PostgreSQL
```

`SpeechProvider` is a small interface with two adapters: `gemini` (hosted API) and `whisper` (self-hosted open-source service). The engine is chosen with `SPEECH_PROVIDER` in `.env`.

## Structure
```
client/   React frontend
server/   Express API, WebSocket, speech adapters, migrations
docs/     notes
docker-compose.yml   local PostgreSQL
.env.example         configuration keys
```

## API
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | liveness check |
| GET | `/api/transcripts?limit=50&offset=0` | list, newest first, with `total` |
| GET | `/api/transcripts/:id` | read one |
| POST | `/api/transcripts` | create `{ "text": "...", "language": "hi-en" }` |
| PATCH | `/api/transcripts/:id` | update `text` and/or `language` (`null` clears it) |
| DELETE | `/api/transcripts/:id` | delete (204) |

Invalid input returns 400 with details, a missing id returns 404.

## Local setup
```
cp .env.example .env        # add GEMINI_API_KEY
docker compose up -d db     # local PostgreSQL on port 5433
npm install
npm run dev                 # server :3000, client :5173
npm test                    # API tests (need the local database)
```
Migrations in `server/migrations/` run automatically on server start.

## Status
Live transcription, the transcript API and the dashboard (add, edit, delete, paging, save from the live view) are working. Deployment comes next.
