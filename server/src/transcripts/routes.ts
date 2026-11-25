import { Router, type Response } from "express";
import { z } from "zod";
import type { TranscriptRepo } from "./repo.js";

const idSchema = z.coerce.number().int().positive();

const createSchema = z.object({
  text: z.string().trim().min(1, "Text is required").max(20000),
  language: z.string().trim().min(1).max(20).nullable().optional(),
});

const updateSchema = createSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Provide text or language" });

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function invalid(res: Response, error: z.ZodError) {
  res.status(400).json({
    error: "Invalid request",
    details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
  });
}

function notFound(res: Response) {
  res.status(404).json({ error: "Transcript not found" });
}

/** REST API for transcript history: list, read, create, update, delete. */
export function createTranscriptsRouter(repo: TranscriptRepo): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    const query = listSchema.safeParse(req.query);
    if (!query.success) return invalid(res, query.error);
    const { items, total } = await repo.list(query.data.limit, query.data.offset);
    res.json({ items, total, limit: query.data.limit, offset: query.data.offset });
  });

  router.get("/:id", async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return invalid(res, id.error);
    const transcript = await repo.get(id.data);
    if (!transcript) return notFound(res);
    res.json(transcript);
  });

  router.post("/", async (req, res) => {
    const body = createSchema.safeParse(req.body);
    if (!body.success) return invalid(res, body.error);
    res.status(201).json(await repo.create(body.data));
  });

  router.patch("/:id", async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return invalid(res, id.error);
    const body = updateSchema.safeParse(req.body);
    if (!body.success) return invalid(res, body.error);
    const updated = await repo.update(id.data, body.data);
    if (!updated) return notFound(res);
    res.json(updated);
  });

  router.delete("/:id", async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) return invalid(res, id.error);
    if (!(await repo.remove(id.data))) return notFound(res);
    res.status(204).end();
  });

  return router;
}
