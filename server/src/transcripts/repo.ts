import type { Pool } from "pg";

export interface Transcript {
  id: number;
  text: string;
  language: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NewTranscript {
  text: string;
  language?: string | null;
}

export interface TranscriptPatch {
  text?: string;
  language?: string | null;
}

const COLUMNS = `id, text, language, created_at AS "createdAt", updated_at AS "updatedAt"`;

/** All SQL for transcripts lives here. Values are always passed as parameters. */
export function createTranscriptRepo(pool: Pool) {
  return {
    async list(limit: number, offset: number): Promise<{ items: Transcript[]; total: number }> {
      const items = await pool.query<Transcript>(
        `SELECT ${COLUMNS} FROM transcripts ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      const count = await pool.query<{ total: number }>(
        "SELECT count(*)::int AS total FROM transcripts",
      );
      return { items: items.rows, total: count.rows[0].total };
    },

    async get(id: number): Promise<Transcript | undefined> {
      const { rows } = await pool.query<Transcript>(
        `SELECT ${COLUMNS} FROM transcripts WHERE id = $1`,
        [id],
      );
      return rows[0];
    },

    async create(input: NewTranscript): Promise<Transcript> {
      const { rows } = await pool.query<Transcript>(
        `INSERT INTO transcripts (text, language) VALUES ($1, $2) RETURNING ${COLUMNS}`,
        [input.text, input.language ?? null],
      );
      return rows[0];
    },

    async update(id: number, patch: TranscriptPatch): Promise<Transcript | undefined> {
      const sets: string[] = [];
      const values: unknown[] = [];
      if (patch.text !== undefined) {
        values.push(patch.text);
        sets.push(`text = $${values.length}`);
      }
      if (patch.language !== undefined) {
        values.push(patch.language);
        sets.push(`language = $${values.length}`);
      }
      values.push(id);
      const { rows } = await pool.query<Transcript>(
        `UPDATE transcripts SET ${sets.join(", ")}, updated_at = now()
         WHERE id = $${values.length} RETURNING ${COLUMNS}`,
        values,
      );
      return rows[0];
    },

    async remove(id: number): Promise<boolean> {
      const result = await pool.query("DELETE FROM transcripts WHERE id = $1", [id]);
      return (result.rowCount ?? 0) > 0;
    },
  };
}

export type TranscriptRepo = ReturnType<typeof createTranscriptRepo>;
