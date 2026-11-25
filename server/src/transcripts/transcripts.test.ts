import type { Pool } from "pg";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createPool, migrate } from "../db.js";

// These tests need a real Postgres and wipe the transcripts table, so they
// refuse to run against anything but a local database.
const url =
  process.env.TEST_DATABASE_URL ?? "postgres://procucev:procucev_local@localhost:5433/procucev";
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  throw new Error(`Refusing to run tests against non-local database host "${host}"`);
}

const neverUsed = { start: () => Promise.reject(new Error("not used in these tests")) };

let pool: Pool;
let api: ReturnType<typeof request>;

beforeAll(async () => {
  pool = createPool(url);
  await migrate(pool);
  api = request(createApp({ provider: neverUsed, pool }).app);
});

beforeEach(async () => {
  await pool.query("TRUNCATE transcripts RESTART IDENTITY");
});

afterAll(async () => {
  await pool.end();
});

describe("POST /api/transcripts", () => {
  it("creates a transcript and returns it", async () => {
    const res = await api
      .post("/api/transcripts")
      .send({ text: "  कल meeting है  ", language: "hi-en" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: 1, text: "कल meeting है", language: "hi-en" });
    expect(res.body.createdAt).toBeTruthy();
  });

  it("rejects empty text", async () => {
    const res = await api.post("/api/transcripts").send({ text: "   " });
    expect(res.status).toBe(400);
    expect(res.body.details[0].path).toBe("text");
  });

  it("rejects a body that is not valid JSON", async () => {
    const res = await api
      .post("/api/transcripts")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/transcripts", () => {
  it("lists newest first with a total, and paginates", async () => {
    for (const text of ["first", "second", "third"]) {
      await api.post("/api/transcripts").send({ text });
    }
    const all = await api.get("/api/transcripts");
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(3);
    expect(all.body.items.map((t: { text: string }) => t.text)).toEqual(["third", "second", "first"]);

    const page = await api.get("/api/transcripts?limit=1&offset=1");
    expect(page.body.items.map((t: { text: string }) => t.text)).toEqual(["second"]);
    expect(page.body.total).toBe(3);
  });

  it("rejects a bad limit", async () => {
    const res = await api.get("/api/transcripts?limit=1000");
    expect(res.status).toBe(400);
  });
});

describe("GET /api/transcripts/:id", () => {
  it("returns one transcript", async () => {
    const created = await api.post("/api/transcripts").send({ text: "hello" });
    const res = await api.get(`/api/transcripts/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.text).toBe("hello");
  });

  it("returns 404 for a missing id and 400 for a bad id", async () => {
    expect((await api.get("/api/transcripts/999")).status).toBe(404);
    expect((await api.get("/api/transcripts/abc")).status).toBe(400);
  });
});

describe("PATCH /api/transcripts/:id", () => {
  it("updates the text and bumps updatedAt", async () => {
    const created = await api.post("/api/transcripts").send({ text: "old", language: "en" });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const res = await api.patch(`/api/transcripts/${created.body.id}`).send({ text: "new" });
    expect(res.status).toBe(200);
    expect(res.body.text).toBe("new");
    expect(res.body.language).toBe("en");
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(
      new Date(created.body.updatedAt).getTime(),
    );
  });

  it("can clear the language with null", async () => {
    const created = await api.post("/api/transcripts").send({ text: "x", language: "en" });
    const res = await api.patch(`/api/transcripts/${created.body.id}`).send({ language: null });
    expect(res.body.language).toBeNull();
  });

  it("rejects an empty update and returns 404 for a missing id", async () => {
    const created = await api.post("/api/transcripts").send({ text: "x" });
    expect((await api.patch(`/api/transcripts/${created.body.id}`).send({})).status).toBe(400);
    expect((await api.patch("/api/transcripts/999").send({ text: "y" })).status).toBe(404);
  });
});

describe("DELETE /api/transcripts/:id", () => {
  it("deletes a transcript, then returns 404", async () => {
    const created = await api.post("/api/transcripts").send({ text: "bye" });
    expect((await api.delete(`/api/transcripts/${created.body.id}`)).status).toBe(204);
    expect((await api.get(`/api/transcripts/${created.body.id}`)).status).toBe(404);
    expect((await api.delete(`/api/transcripts/${created.body.id}`)).status).toBe(404);
  });
});

describe("unknown API paths", () => {
  it("return a JSON 404", async () => {
    const res = await api.get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});
