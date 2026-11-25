import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { createPool, migrate } from "./db.js";
import { createGeminiProvider } from "./speech/gemini.js";
import type { SpeechProvider } from "./speech/provider.js";

// npm runs this from server/, so point at the .env in the project root.
// On a host that sets real environment variables the file is simply absent.
config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const port = Number(process.env.PORT ?? 3000);

function buildProvider(): SpeechProvider {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Start anyway so the rest of the app works; /ws reports the problem.
    return {
      start: () => Promise.reject(new Error("GEMINI_API_KEY is not set in .env")),
    };
  }
  return createGeminiProvider({
    apiKey,
    model: process.env.GEMINI_MODEL ?? "gemini-3.8-live",
  });
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  process.exit(1);
}

const pool = createPool(databaseUrl);
try {
  await migrate(pool);
} catch (error) {
  console.error("Could not connect to or migrate the database:", error);
  process.exit(1);
}

const { server } = createApp({ provider: buildProvider(), pool });

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
