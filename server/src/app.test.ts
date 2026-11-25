import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { createApp, type ServerMessage } from "./app.js";
import type { SpeechCallbacks, SpeechProvider } from "./speech/provider.js";

/** A fake engine: echoes a transcript for every audio chunk it receives. */
function fakeProvider() {
  const received: Buffer[] = [];
  let ended = false;
  const provider: SpeechProvider = {
    async start(callbacks: SpeechCallbacks) {
      return {
        sendAudio: (pcm) => {
          received.push(pcm);
          callbacks.onTranscript("namaste hello");
        },
        endAudio: () => {
          ended = true;
        },
        close: () => {},
      };
    },
  };
  return { provider, received, wasEnded: () => ended };
}

let open: Array<() => void> = [];
afterEach(() => {
  open.forEach((close) => close());
  open = [];
});

async function startServer(provider: SpeechProvider) {
  const { server } = createApp(provider);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  open.push(() => server.close());
  const { port } = server.address() as AddressInfo;
  return port;
}

function nextMessage(socket: WebSocket): Promise<ServerMessage> {
  return new Promise((resolve) =>
    socket.once("message", (data) => resolve(JSON.parse(data.toString()) as ServerMessage)),
  );
}

describe("server", () => {
  it("answers the health check", async () => {
    const port = await startServer(fakeProvider().provider);
    const res = await fetch(`http://localhost:${port}/api/health`);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("relays audio to the engine and transcript text back", async () => {
    const fake = fakeProvider();
    const port = await startServer(fake.provider);
    const socket = new WebSocket(`ws://localhost:${port}/ws`);
    open.push(() => socket.close());

    expect(await nextMessage(socket)).toEqual({ type: "ready" });

    const audio = Buffer.from([1, 2, 3, 4]);
    const reply = nextMessage(socket);
    socket.send(audio);
    expect(await reply).toEqual({ type: "transcript", text: "namaste hello" });
    expect(fake.received[0]).toEqual(audio);

    socket.send(JSON.stringify({ type: "end" }));
    await new Promise((r) => setTimeout(r, 50));
    expect(fake.wasEnded()).toBe(true);
  });

  it("reports an error to the browser when the engine cannot start", async () => {
    const port = await startServer({ start: () => Promise.reject(new Error("no key")) });
    const socket = new WebSocket(`ws://localhost:${port}/ws`);
    open.push(() => socket.close());
    const message = await nextMessage(socket);
    expect(message.type).toBe("error");
  });
});
