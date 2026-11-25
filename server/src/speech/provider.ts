/**
 * A speech-to-text engine the server can stream microphone audio to.
 * The Gemini adapter implements this today; an open-source Whisper adapter
 * can implement the same interface without touching the WebSocket layer.
 */
export interface SpeechCallbacks {
  /** A piece of transcribed text. Pieces are appended in order. */
  onTranscript(text: string): void;
  /** The engine finished a spoken turn. */
  onTurnEnd?(): void;
  onError(message: string): void;
  onClose(): void;
}

export interface SpeechSession {
  /** Raw 16-bit little-endian PCM, 16 kHz, mono. */
  sendAudio(pcm: Buffer): void;
  /** The microphone paused or stopped. */
  endAudio(): void;
  close(): void;
}

export interface SpeechProvider {
  start(callbacks: SpeechCallbacks): Promise<SpeechSession>;
}
