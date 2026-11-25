import { describe, expect, it } from "vitest";
import { withScriptFix } from "./normalize.js";
import type { SpeechCallbacks, SpeechProvider } from "./provider.js";

/** An engine that lets the test push events in by hand. */
function manualEngine() {
  let callbacks!: SpeechCallbacks;
  const provider: SpeechProvider = {
    async start(cb) {
      callbacks = cb;
      return { sendAudio: () => {}, endAudio: () => {}, close: () => {} };
    },
  };
  return { provider, emit: () => callbacks };
}

function recorder() {
  const events: string[] = [];
  const callbacks: SpeechCallbacks = {
    onTranscript: (text) => events.push(`text:${text}`),
    onTurnEnd: () => events.push("turn_end"),
    onError: (message) => events.push(`error:${message}`),
    onClose: () => events.push("close"),
  };
  return { events, callbacks };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

describe("withScriptFix", () => {
  it("sends the fixed text", async () => {
    const engine = manualEngine();
    const { events, callbacks } = recorder();
    await withScriptFix(engine.provider, async (t) => t.toUpperCase()).start(callbacks);
    engine.emit().onTranscript("abc");
    await settle();
    expect(events).toEqual(["text:ABC"]);
  });

  it("keeps order even when an earlier piece is slower, and holds turn_end and close back", async () => {
    const engine = manualEngine();
    const { events, callbacks } = recorder();
    const fix = async (t: string) => {
      await new Promise((resolve) => setTimeout(resolve, t === "slow" ? 40 : 0));
      return t;
    };
    await withScriptFix(engine.provider, fix).start(callbacks);
    engine.emit().onTranscript("slow");
    engine.emit().onTranscript("fast");
    engine.emit().onTurnEnd?.();
    engine.emit().onClose();
    await settle();
    expect(events).toEqual(["text:slow", "text:fast", "turn_end", "close"]);
  });

  it("falls back to the original text when the fix fails", async () => {
    const engine = manualEngine();
    const { events, callbacks } = recorder();
    await withScriptFix(engine.provider, () => Promise.reject(new Error("quota"))).start(callbacks);
    engine.emit().onTranscript("original");
    await settle();
    expect(events).toEqual(["text:original"]);
  });
});
