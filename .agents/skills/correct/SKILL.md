---
name: correct
description:
  Pitfall sweep after agent or bulk edits. Use before opening a PR, after a large
  refactor, or when CI failed on lint, dead-code, type cycles, or Convex patterns.
---

# Correct

Turn recurring agent mistakes into a checklist with fixes. Pair with `format`, `lint`,
`typecheck`, `test`, and pre-PR `dead-code` + `dupes` from [AGENTS.md](../../../AGENTS.md).

## When to use

- Before marking work ready for review
- After moving files across Convex domains or admin/booking modules
- When CI messages mention oxlint, oxfmt, fallow, import cycles, or neverthrow

## Pitfall catalog (vvstudios-specific)

Evidence for these themes lives in git history (see project audit). Counts are approximate;
re-run ripgrep when disputing a number.

### Lint and CI churn

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `require-readable-spacing` | oxfmt not run | `bun run format` |
| `dead-code` failed | exported symbol unused after refactor | remove export or use symbol; see `aca48210` pattern |
| `import/no-cycle` | handler ↔ service types | explicit `ResultAsync<..., { reason: string }>` on service (`1f79980d`) |
| Anti-slop assertion rules | unsafe cast without comment | restructure or add safety comment per rule text |

Never add `oxlint-ignore`. Restructure instead ([AGENTS.md](../../../AGENTS.md)).

### Convex boundaries

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Logic in `convex/*.ts` handler | skipped service layer | one service call + `.match(tupleOk, tupleErr)` |
| Helpers in `convex/services/**` | domain op in wrong layer | move to `convex/lib/<domain>/` |
| `fromPromise` in services | bypassing `result.ts` | `okOrThrow`, `fromConvexTuple`, or `tryPromise` only |
| `.filter(` on queries | banned by `@convex-dev/no-filter-in-query` | index + equality query |
| Relative imports in Convex | `./../` | `#convex/` alias (`c117767e` era) |
| `mapErr` switch in services | redundant remap | let chain propagate; see `neverthrow/no-service-error-remap-switch` |

Run boundary spot-check:

```bash
bun tools/agent/check-convex-handlers.ts
```

### Frontend

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Relative import in `src/**` | `./` paths | `#/` alias |
| `<img>` in app UI | forbidden element rule | `@unpic/react` `Image` |
| Tests beside `lib/` | repo convention | `src/sites/studio/features/<feature>/tests/` |

### Agent process

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Large PR then many tiny `fix(admin)` | UI polish without verify skill | run `verify-vvstudios` feature doc for the surface |
| Backfill left in tree | assumed production migration | confirm with human; repo often deletes backfill after merge (`b26ae6b8`) |
| Duplicate constants FE + Convex | missing shared module | extract one importable source |

## Workflow

1. Run verify bundle: `format`, `lint`, `typecheck`, `test`
2. Pre-PR: `dead-code`, `dupes`; E2E when customer/admin flows touched
3. Run `bun tools/agent/check-convex-handlers.ts` when Convex handlers changed
4. Load [CODING_STANDARDS.md](../../../CODING_STANDARDS.md) in a review subagent (not during feature coding)
5. For UI flows, follow `verify-vvstudios` feature checklist

## When not to use

- Typo-only change that already passed CI locally
- Docs-only edits outside code boundaries
