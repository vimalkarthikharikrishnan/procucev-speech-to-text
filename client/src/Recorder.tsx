import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "connecting" | "recording";

type ServerMessage =
  | { type: "ready" }
  | { type: "transcript"; text: string }
  | { type: "turn_end" }
  | { type: "error"; message: string };

const SAMPLE_RATE = 16000;

export default function Recorder() {
  const [status, setStatus] = useState<Status>("idle");
  const [lines, setLines] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; stream: MediaStream } | null>(null);
  const currentRef = useRef("");

  const updateCurrent = (value: string) => {
    currentRef.current = value;
    setCurrent(value);
  };

  const finishLine = useCallback(() => {
    const text = currentRef.current.trim();
    if (text) setLines((prev) => [...prev, text]);
    currentRef.current = "";
    setCurrent("");
  }, []);

  const stopCapture = useCallback(() => {
    const audio = audioRef.current;
    audioRef.current = null;
    audio?.stream.getTracks().forEach((track) => track.stop());
    void audio?.ctx.close();
  }, []);

  const startCapture = useCallback(async (socket: WebSocket) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
    audioRef.current = { ctx, stream };

    if (ctx.sampleRate !== SAMPLE_RATE) {
      throw new Error(`This browser records at ${ctx.sampleRate} Hz instead of ${SAMPLE_RATE} Hz.`);
    }

    await ctx.audioWorklet.addModule("/pcm-worklet.js");
    const source = ctx.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(ctx, "pcm-capture");
    worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(event.data);
    };

    // Some browsers only run a worklet that reaches the speakers, so route it
    // through a muted gain node.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(worklet).connect(mute).connect(ctx.destination);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("connecting");

    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(`${scheme}://${window.location.host}/ws`);
    socketRef.current = socket;

    const fail = (message: string) => {
      setError(message);
      setStatus("idle");
      stopCapture();
      socket.close();
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      const message = JSON.parse(event.data) as ServerMessage;
      switch (message.type) {
        case "ready":
          startCapture(socket).then(
            () => setStatus("recording"),
            (err: unknown) => fail(err instanceof Error ? err.message : "Could not use the microphone."),
          );
          break;
        case "transcript":
          updateCurrent(currentRef.current + message.text);
          break;
        case "turn_end":
          finishLine();
          break;
        case "error":
          fail(message.message);
          break;
      }
    };
    socket.onerror = () => fail("Could not reach the server.");
    socket.onclose = () => {
      stopCapture();
      finishLine();
      setStatus("idle");
    };
  }, [finishLine, startCapture, stopCapture]);

  const stop = useCallback(() => {
    const socket = socketRef.current;
    stopCapture();
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "end" }));
      // Keep the connection open briefly so the last words can arrive.
      setTimeout(() => socket.close(), 1500);
    }
    setStatus("idle");
  }, [stopCapture]);

  useEffect(
    () => () => {
      stopCapture();
      socketRef.current?.close();
    },
    [stopCapture],
  );

  const busy = status !== "idle";

  return (
    <section>
      <button onClick={busy ? stop : start} disabled={status === "connecting"}>
        {status === "idle" ? "Start speaking" : status === "connecting" ? "Connecting..." : "Stop"}
      </button>
      {status === "recording" && <span className="live"> Listening</span>}
      {error && <p className="error">{error}</p>}

      <div className="transcript" aria-live="polite">
        {lines.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
        {current && <p className="partial">{current}</p>}
        {!lines.length && !current && <p className="hint">Your words will appear here.</p>}
      </div>
    </section>
  );
}
