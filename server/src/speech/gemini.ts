import { GoogleGenAI, Modality, type LiveServerMessage } from "@google/genai";
import type { SpeechProvider } from "./provider.js";

interface GeminiOptions {
  apiKey: string;
  model: string;
}

// The Live API only returns spoken audio replies, never text-only. We turn on
// input transcription to get the text of what the user said and ignore the
// audio the model sends back. The instruction asks it to stay silent.
const SILENT_TRANSCRIBER =
  "You are a silent transcriber. Never reply or speak. The user may mix Hindi, English and Tamil in one sentence.";

export function createGeminiProvider({ apiKey, model }: GeminiOptions): SpeechProvider {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1beta" } });

  return {
    async start(callbacks) {
      const session = await ai.live.connect({
        model,
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction: SILENT_TRANSCRIBER,
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            const text = message.serverContent?.inputTranscription?.text;
            if (text) callbacks.onTranscript(text);
            if (message.serverContent?.turnComplete) callbacks.onTurnEnd?.();
          },
          onerror: (event: ErrorEvent) => callbacks.onError(event.message),
          onclose: () => callbacks.onClose(),
        },
      });

      return {
        sendAudio: (pcm) =>
          session.sendRealtimeInput({
            audio: { data: pcm.toString("base64"), mimeType: "audio/pcm;rate=16000" },
          }),
        endAudio: () => session.sendRealtimeInput({ audioStreamEnd: true }),
        close: () => session.close(),
      };
    },
  };
}
