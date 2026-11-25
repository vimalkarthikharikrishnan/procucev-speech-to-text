import type { SpeechProvider } from "./provider.js";

/** Rewrites one piece of transcript text. May throw; the caller falls back to the original. */
export type ScriptFixer = (text: string) => Promise<string>;

/**
 * Wraps any speech engine so each transcript piece passes through `fix`
 * before it reaches the browser. Pieces are handled one at a time, so their
 * order never changes, and turn-end / close events wait for the pieces before
 * them. If `fix` fails, the original text is used.
 */
export function withScriptFix(provider: SpeechProvider, fix: ScriptFixer): SpeechProvider {
  return {
    async start(callbacks) {
      let queue: Promise<void> = Promise.resolve();
      const enqueue = (task: () => Promise<void> | void) => {
        queue = queue.then(task);
      };

      return provider.start({
        onTranscript: (text) =>
          enqueue(async () => {
            const fixed = await fix(text).catch((error: unknown) => {
              const reason = error instanceof Error ? error.message : String(error);
              console.warn("Script fix failed, using the original text:", reason.slice(0, 160));
              return text;
            });
            callbacks.onTranscript(fixed);
          }),
        onTurnEnd: callbacks.onTurnEnd ? () => enqueue(() => callbacks.onTurnEnd?.()) : undefined,
        onError: callbacks.onError,
        onClose: () => enqueue(() => callbacks.onClose()),
      });
    },
  };
}
