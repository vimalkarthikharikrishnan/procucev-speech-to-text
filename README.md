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

## Status
Project skeleton only. Features are being added phase by phase.
