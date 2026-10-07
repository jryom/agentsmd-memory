# Lifecycle memory prototype

Experimental, opt-in, no release required. Existing entry-point save/forget tools remain instruction-only. `memory_fact` writes tracked facts; `memory_feedback` writes Git-ignored telemetry. Both use cooperative locking and atomic replacement. Review knowledge changes through Git.

Dependencies have specific jobs: Zod validates stores and derives new tool input schemas, proper-lockfile serializes cooperating writers, and write-file-atomic replaces complete files with fsync. Zero dependencies is not a design constraint.

## Try it in a project

Run `npm ci` on this branch, then use its local `src/index.mjs` as the MCP server, as described in [development](development.md). The published npm package does not include this prototype. Native plugin registration uses the same tools, but live client behavior still needs testing.

1. Keep durable user rules and critical constraints in the existing entry point.
2. Create `.agents-memory.json` beside that entry point (or at the Git root):

```json
{
  "version": 1,
  "facts": [
    {
      "id": "migration-api",
      "fact": "Use the supported migration API, not direct database edits.",
      "scope": "database migrations",
      "evidence": ["docs/migrations.md#supported-api"],
      "reason": "Direct edits bypass consistency checks.",
      "status": "candidate",
      "protected": false
    }
  ]
}
```

This is an illustrative fact, not a claim about this repository. Replace it with evidence-backed project knowledge, or begin with an empty facts array. Stable ids survive wording changes. Evidence can reference code, maintained docs, or an explicit user decision; do not invent citations. Supported states: `candidate`, `active`, `archived`.

3. Add `.agents-memory.local.json` to the project's Git ignore rules before recording feedback. Tools enforce that it is ignored and untracked in a real Git repository; feedback outside Git is refused. Also ignore `.agents-memory.json.lock/`, `.agents-memory.json.*`, and `.agents-memory.local.json.*` for transient lock/atomic-write files. For a local-only trial, use `.git/info/exclude`. Track the fact store, not telemetry.
4. Add a short discovery rule to the entry point:

> Lifecycle memory lives in `.agents-memory.json`. At task start, use `memory_recall` with the current task. Verify evidence before applying retrieved facts. Use `memory_fact` for structured knowledge changes, `memory_feedback` only for verified usefulness or contradictions, and `memory_review` for requested maintenance. Keep user rules and critical constraints in the entry point using legacy save/forget tools.

5. Call `memory_recall` with `cwd` and a `query`, for example `database migration`. It returns up to five lexical matches and the current store revision. `memory_review` also reports that revision.
6. Change structured facts with `memory_fact` (examples below). Each change requires `expectedRevision` from recall/review and a `verification` explanation. Refresh the revision after changes.
7. After a fact helps, call `memory_feedback` with `cwd`, its `id`, an opaque stable `task` id, `outcome: useful`, and `verification` describing what you checked. Contradictions use `outcome: contradicted` and require correcting the fact through `memory_fact`, not merely recording a negative signal. Verification text is not stored in telemetry.

## Explicit operations

All `memory_fact` calls require `cwd`, `id`, `expectedRevision`, `verification`, and `action`:

| Action | Additional fields | Effect |
| --- | --- | --- |
| `add` | `fact`, `scope`, `reason`, non-empty `evidence`; optional `protected` | Creates a candidate; duplicate ids rejected |
| `promote` | Checked non-empty `evidence` | Marks active; cannot rewrite content or protection |
| `correct` | Checked non-empty `evidence`; optional replacement `fact`, `scope`, `reason`, `protected` | Updates fact and marks active |
| `archive` | No replacement content | Marks archived; `verification` becomes `archiveReason` |

Protected facts require a non-empty `userApproval` recording explicit user authorization before correction or archival, including removal of protection. Archived facts cannot be changed through these tools; inspect history and deliberately restore them outside the lifecycle if necessary. Changes preserve unrelated facts and unknown metadata fields. A `lastChange` record stores action, verification, and any supplied authorization, without per-session timestamps.

Example promotion arguments:

```json
{
  "cwd": "/absolute/project",
  "action": "promote",
  "id": "migration-api",
  "expectedRevision": "revision-from-memory-recall",
  "evidence": ["docs/migrations.md#supported-api"],
  "verification": "Checked current migration docs: direct edits bypass required consistency checks."
}
```

Checks enforce required evidence and authorization fields, not their truth: verification and user approval are caller-attested. Agents must actually check sources and obtain approval. Git diffs remain the human audit surface.

Local feedback shape:

```json
{
  "version": 1,
  "signals": [
    {"id": "migration-api", "task": "task-42", "outcome": "useful", "factRevision": "content-hash-generated-by-tool", "at": 1800000000000}
  ]
}
```

`at` is epoch milliseconds, generated by the tool. Feedback replaces an existing id/task signal rather than accumulating repeated votes. No tracked usage timestamps. Different clones have independent telemetry; shared facts still travel through Git.

Signals bind to a hash of the fact's content and evidence. Correcting that knowledge invalidates old ranking boosts and contradiction flags without deleting telemetry history. Legacy signals without a content hash are readable but do not influence ranking.

## Retention and cleanup

- Relevant term matches dominate ranking. Distinct useful tasks add a capped boost; freshness adds a smaller boost that fades over 90 days. Archived facts never appear. Retrieval alone gives no boost.
- Every retrieved fact needs verification. Contradictions are flagged, not hidden: hiding a warning could lose an important correction.
- New uncertain facts start as candidates. Evidence supports promotion to active; popularity does not establish truth.
- Review unproven candidates first. Archive confirmed obsolete, superseded, or assessed low-value facts with a reviewable `archiveReason` field. Lack of use alone is not enough.
- Protected facts cannot be corrected or archived without explicit approval. Critical rules stay in the entry point, where lexical retrieval cannot accidentally omit them.
- Archives remain in the store for inspection and Git diffs. No background cleanup or automatic deletion.

To disable: remove the entry-point discovery rule and move the sidecar out of the discovery path. Preserve important guidance in the entry point first.

## Evaluation before adopting

Try several unrelated tasks, one repeated gotcha, one contradicted fact, and one rare safety rule. Review selected facts and Git diffs. Check whether facts actually prevented mistakes and whether feedback/maintenance overhead was worthwhile. Restart the local server when switching code versions.

Limitations: lexical matching, at most five results, whole-store reads, agent-decided cleanup, no semantic deduplication, no automatic evidence or authorization checks. Locks protect cooperating tool writers; manual editors do not take those locks, so avoid editing during tool writes. Revisions reject stale tool changes but are not filesystem transactions with external editors. Sidecar symlinks are rejected; this is not a sandbox against a malicious local process. Freshness is a ranking hint, not correctness or automatic expiration. Agent behavioral evaluation and live client installation remain unverified. This prototype establishes a reviewable lifecycle; it is not an autonomous memory database.
