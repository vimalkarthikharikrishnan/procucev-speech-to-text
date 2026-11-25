import "dotenv/config";
import { createApp } from "./app.js";
import { createGeminiProvider } from "./speech/gemini.js";
import type { SpeechProvider } from "./speech/provider.js";

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

const { server } = createApp(buildProvider());

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
