import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type ErrorRequestHandler } from "express";
import type { Pool } from "pg";
import { WebSocketServer, type RawData } from "ws";
import type { SpeechProvider, SpeechSession } from "./speech/provider.js";
import { createTranscriptRepo } from "./transcripts/repo.js";
import { createTranscriptsRouter } from "./transcripts/routes.js";

export interface AppDeps {
  provider: SpeechProvider;
  pool: Pool;
}

/** Messages the server sends to the browser over /ws. */
export type ServerMessage =
  | { type: "ready" }
  | { type: "transcript"; text: string }
  | { type: "turn_end" }
  | { type: "error"; message: string };

function toBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

/**
 * One HTTP server: REST API, the built React app, and the /ws WebSocket.
 * Browser protocol: binary messages are PCM audio chunks; the text message
 * {"type":"end"} means the microphone stopped.
 */
export function createApp({ provider, pool }: AppDeps) {
  const app = express();
  app.use(express.json({ limit: "100kb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/transcripts", createTranscriptsRouter(createTranscriptRepo(pool)));
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const here = path.dirname(fileURLToPath(import.meta.url));
  const clientDist = path.resolve(here, "../../client/dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  const onError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error?.type === "entity.parse.failed") {
      res.status(400).json({ error: "Request body is not valid JSON" });
      return;
    }
    console.error("Unhandled error:", error);
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(onError);

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (socket) => {
    let session: SpeechSession | null = null;
    let closed = false;

    const send = (message: ServerMessage) => {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
    };

    provider
      .start({
        onTranscript: (text) => send({ type: "transcript", text }),
        onTurnEnd: () => send({ type: "turn_end" }),
        onError: (message) => {
          console.error("Speech provider error:", message);
          send({ type: "error", message: "The speech service reported an error." });
        },
        onClose: () => {
          if (!closed) socket.close();
        },
      })
      .then((started) => {
        if (closed) {
          started.close();
          return;
        }
        session = started;
        send({ type: "ready" });
      })
      .catch((error: unknown) => {
        console.error("Could not start speech session:", error);
        send({ type: "error", message: "Could not connect to the speech service." });
        socket.close();
      });

    socket.on("message", (data, isBinary) => {
      if (isBinary) {
        session?.sendAudio(toBuffer(data));
        return;
      }
      try {
        const message = JSON.parse(toBuffer(data).toString()) as { type?: string };
        if (message.type === "end") session?.endAudio();
      } catch {
        // Ignore malformed text messages.
      }
    });

    socket.on("close", () => {
      closed = true;
      session?.close();
    });
  });

  return { app, server };
}
