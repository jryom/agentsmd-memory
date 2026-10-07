import { z } from "zod"

const text = z.string().refine((value) => value.trim().length > 0, "Must not be blank")
const cwd = text.optional().describe("Absolute existing project directory within advertised workspace roots.")
const evidence = z.array(text).min(1)

export const factSchema = z.looseObject({
  id: text,
  fact: text,
  scope: text,
  evidence: z.array(text),
  reason: text,
  status: z.enum(["candidate", "active", "archived"]),
  protected: z.boolean(),
  archiveReason: text.optional(),
})

export const storeSchema = z.looseObject({ version: z.literal(1), facts: z.array(factSchema) }).refine(
  (store) => new Set(store.facts.map((fact) => fact.id)).size === store.facts.length,
  "Duplicate fact id",
)

export const signalSchema = z.object({ id: text, task: text, outcome: z.enum(["useful", "contradicted"]), factRevision: text.optional(), at: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) })
export const telemetrySchema = z.object({ version: z.literal(1), signals: z.array(signalSchema) }).refine(
  (store) => new Set(store.signals.map((signal) => JSON.stringify([signal.id, signal.task]))).size === store.signals.length,
  "Duplicate id/task signal",
)

export const recallSchema = z.object({ cwd, query: text.describe("Current task, including relevant topic or code paths.") })
export const feedbackSchema = z.object({
  cwd, id: text, task: text.describe("Stable opaque task id, not sensitive task text."),
  outcome: z.enum(["useful", "contradicted"]),
  verification: text.describe("What current evidence verified usefulness or contradiction? Not stored in local telemetry."),
})

export const factInputSchema = z.object({
  cwd,
  action: z.enum(["add", "promote", "correct", "archive"]),
  id: text,
  expectedRevision: text.describe("Revision returned by memory_recall or memory_review. Prevents overwriting concurrent edits."),
  fact: text.optional(), scope: text.optional(), reason: text.optional(), evidence: evidence.optional(),
  protected: z.boolean().optional(),
  verification: text.describe("Evidence checked and reason for this operation. Required for every change."),
  userApproval: text.optional().describe("Explicit user authorization; required to correct or archive a protected fact."),
})

export const inputSchema = (schema) => z.toJSONSchema(schema, { target: "draft-7" })
