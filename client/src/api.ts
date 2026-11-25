export interface Transcript {
  id: number;
  text: string;
  language: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptPage {
  items: Transcript[];
  total: number;
}

export interface TranscriptInput {
  text: string;
  language: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new Error("Could not reach the server.");
  }

  if (res.status === 204) return undefined as T;

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const error = (body as { error?: string } | null)?.error;
    throw new Error(error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export function listTranscripts(limit: number, offset: number) {
  return request<TranscriptPage>(`/api/transcripts?limit=${limit}&offset=${offset}`);
}

export function createTranscript(input: TranscriptInput) {
  return request<Transcript>("/api/transcripts", { method: "POST", body: JSON.stringify(input) });
}

export function updateTranscript(id: number, input: Partial<TranscriptInput>) {
  return request<Transcript>(`/api/transcripts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTranscript(id: number) {
  return request<void>(`/api/transcripts/${id}`, { method: "DELETE" });
}

export const LANGUAGES: Array<{ value: string; label: string }> = [
  { value: "hi-en", label: "Hindi + English" },
  { value: "hi", label: "Hindi" },
  { value: "en", label: "English" },
  { value: "ta", label: "Tamil" },
];

export function languageLabel(value: string | null): string {
  if (!value) return "-";
  return LANGUAGES.find((l) => l.value === value)?.label ?? value;
}
