import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  LANGUAGES,
  createTranscript,
  deleteTranscript,
  languageLabel,
  listTranscripts,
  updateTranscript,
  type Transcript,
  type TranscriptInput,
} from "./api";

const PAGE_SIZE = 10;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Text box + language picker, used for both "add" and "edit". */
function TranscriptForm(props: {
  initial: TranscriptInput;
  submitLabel: string;
  onSubmit: (value: TranscriptInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [text, setText] = useState(props.initial.text);
  const [language, setLanguage] = useState(props.initial.language ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await props.onSubmit({ text: text.trim(), language: language || null });
      if (!props.onCancel) setText(""); // "add" form: clear after saving
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="entry-form" onSubmit={submit}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Transcript text"
        aria-label="Transcript text"
        maxLength={20000}
      />
      <div className="form-row">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label="Language"
        >
          <option value="">No language</option>
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={saving || !text.trim()}>
          {saving ? "Saving..." : props.submitLabel}
        </button>
        {props.onCancel && (
          <button type="button" className="secondary" onClick={props.onCancel}>
            Cancel
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

export default function Dashboard({ reloadKey }: { reloadKey: number }) {
  const [items, setItems] = useState<Transcript[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const page = await listTranscripts(PAGE_SIZE, offset);
      // The last row of the last page was deleted: step back one page.
      if (page.items.length === 0 && offset > 0) {
        setOffset(Math.max(0, offset - PAGE_SIZE));
        return;
      }
      setItems(page.items);
      setTotal(page.total);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [offset]);

  // reloadKey changes when a transcript is saved from the live recorder.
  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const handleAdd = async (value: TranscriptInput) => {
    await createTranscript(value);
    setOffset(0);
    await load();
  };

  const handleUpdate = async (id: number, value: TranscriptInput) => {
    await updateTranscript(id, value);
    setEditingId(null);
    await load();
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteTranscript(id);
      setConfirmingId(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);

  return (
    <section className="dashboard">
      <h2>Saved transcripts</h2>

      <details className="add-box">
        <summary>Add a transcript by hand</summary>
        <TranscriptForm initial={{ text: "", language: "hi-en" }} submitLabel="Add" onSubmit={handleAdd} />
      </details>

      {error && <p className="error">{error}</p>}
      {loading && <p className="hint">Loading...</p>}
      {!loading && items.length === 0 && !error && (
        <p className="hint">Nothing saved yet. Record something above and press Save.</p>
      )}

      <ul className="transcript-list">
        {items.map((item) => (
          <li key={item.id}>
            {editingId === item.id ? (
              <TranscriptForm
                initial={{ text: item.text, language: item.language }}
                submitLabel="Save changes"
                onSubmit={(value) => handleUpdate(item.id, value)}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <>
                <p className="item-text">{item.text}</p>
                <div className="item-meta">
                  <span>{languageLabel(item.language)}</span>
                  <span>{formatDate(item.createdAt)}</span>
                  <span className="spacer" />
                  {confirmingId === item.id ? (
                    <>
                      <span>Delete this?</span>
                      <button className="danger small" onClick={() => void handleDelete(item.id)}>
                        Yes, delete
                      </button>
                      <button className="secondary small" onClick={() => setConfirmingId(null)}>
                        No
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="secondary small"
                        onClick={() => {
                          setEditingId(item.id);
                          setConfirmingId(null);
                        }}
                      >
                        Edit
                      </button>
                      <button className="secondary small" onClick={() => setConfirmingId(item.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      {total > PAGE_SIZE && (
        <div className="pager">
          <button
            className="secondary small"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
          >
            Newer
          </button>
          <span>
            {from}-{to} of {total}
          </span>
          <button
            className="secondary small"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
          >
            Older
          </button>
        </div>
      )}
    </section>
  );
}
