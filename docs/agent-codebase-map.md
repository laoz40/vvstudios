# Agent codebase map

Short navigation for humans and agents. Details live in skills and AGENTS.md; this file
is the table of contents.

## Product surfaces

| Surface | Route prefix | Code root |
| --- | --- | --- |
| Public marketing + booking | `/` (TanStack Start) | `src/sites/studio/` |
| Staff login | `/login` | `src/routes/_auth/` |
| Admin dashboard | `/dashboard` | `src/sites/studio/features/admin/` |
| Editor dashboard | `/dashboard/editor` | `src/sites/studio/features/editor/` |

Browser verification: `.agents/skills/verify-vvstudios/` and `features/*.md` per flow.

## Convex layers

```
convex/*.ts          → public handlers (thin: validators + one service + tupleOk/tupleErr)
convex/services/**   → neverthrow service chains only
convex/lib/**        → domain operations (db, Stripe, email, Drive, calendar)
convex/tests/**      → integration tests for races, money, jobs
```

Import rule: `#convex/...` only inside `convex/**` (oxlint enforced).

Domain folders (post #140 refactor): `booking`, `packages`, `sessions`, `drive`, `editor`,
`employees`, `googleCalendar`, `stripe`, plus shared `adminSearch`.

Generated AI guidance: `convex/_generated/ai/guidelines.md` (read before Convex edits).

## Frontend layers

```
src/sites/studio/features/<feature>/   → feature UI + colocated tests under tests/
src/components/ui/                     → shadcn primitives
src/lib/                               → shared non-feature helpers
src/integrations/                      → Clerk, Convex client, TanStack Query
```

Import rule: `#/...` in `src/**` (no relative cross-folder imports).

## Shared constants

If the same value appears in Convex and the browser, extract to a single module both
sides can import (see AGENTS.md). Do not copy defaults into handlers and React hooks.

## Verification commands

| Stage | Commands |
| --- | --- |
| Every code change | `bun run format`, `lint`, `typecheck`, `test` |
| Before PR | above + `dead-code`, `dupes`; E2E when flows touched |
| Convex deploy check (local) | `npx convex dev --once` when no long-running dev |

## Skills index

| Skill | Use when |
| --- | --- |
| `architect` | Planning, audits, cross-cutting refactors |
| `correct` | Pre-PR pitfall sweep |
| `convex` | Route to Convex-specific skills |
| `convex-cloud-agents` | Cloud agent VM + Convex isolation |
| `tests` | Writing or moving tests |
| `verify-vvstudios` | Proving UI flows |
| `zustand` | Feature modal/state stores |

Review standards: [CODING_STANDARDS.md](../CODING_STANDARDS.md) (review subagent only).
