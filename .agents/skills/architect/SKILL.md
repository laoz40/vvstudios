---
name: architect
description:
  High-level codebase audit before large refactors or agent onboarding. Use when
  planning architecture changes, mapping domains, or producing an agent-friendly
  rearchitecture plan.
---

# Architect

Structured audit for vvstudios. Output is a short plan with evidence, not a giant
question list for the human.

## When to use

- Repo layout or boundaries are unclear for the task at hand
- A change spans Convex handlers, services, lib, and multiple UI features
- You need to choose which existing skill applies (Convex, verify, tests, zustand)
- Coordinator asked for a rearchitecture or agent-friendly improvement plan

## When not to use

- Single-file bugfix with an obvious owner file
- Task already names a specific skill and feature folder

## Workflow

### 1. Read boundaries (do not skip)

1. [AGENTS.md](../../../AGENTS.md) for verify commands and Convex neverthrow rules
2. [docs/agent-codebase-map.md](../../../docs/agent-codebase-map.md) for where code lives
3. [CODING_STANDARDS.md](../../../CODING_STANDARDS.md) only when reviewing or planning
   review gates, not during feature implementation

### 2. Route specialized skills

| If the task touches… | Open this skill first |
| --- | --- |
| Any Convex code | `convex` → then domain skill (migration, performance, component, cloud-agents) |
| Customer or admin UI proof | `verify-vvstudios` + matching `features/*.md` |
| Tests | `tests` |
| Zustand / modals | `zustand` |
| Post-change pitfall sweep | `correct` |

### 3. Gather signals

Prefer measurable signals over vibes:

- **Git**: `git log --oneline -50 -- path/` for the area; look for follow-up `fix:` commits
- **Lint ownership**: [.oxlintrc.json](../../../.oxlintrc.json) overrides for `convex/**`, `src/**`, services
- **Structure**: handlers in `convex/*.ts`, chains in `convex/services/**`, domain ops in `convex/lib/**`
- **Frontend**: features under `src/sites/studio/features/<feature>/`

Optional Convex performance pass: `convex-performance-audit` when the plan mentions
read amplification, subscriptions, or OCC.

### 4. Write the plan

Keep it phased. Each phase should be mergeable alone.

Required sections:

1. **Problem** (agent lens: discovery cost, wrong layer edits, CI churn)
2. **Evidence** (commit SHAs, file counts, lint rules)
3. **Target shape** (boundaries, docs, gates)
4. **Rollout** (order, risk, what not to do)
5. **Metrics** (CI fix commits, verify skill usage, handler convention compliance)

### 5. Prototype open questions

If the plan depends on "would X work?", spike on a `cursor/*-f72e` branch:

- One folder move, one skill hook, or one lint rule
- Run `format`, `lint`, `typecheck`, and `test` from package.json
- Record pass/fail in the plan

Do not hand the human a list of unanswered hypotheticals when a two-hour spike would answer them.

## Guardrails

- KISS: prefer docs + lint gates over new abstraction layers
- Do not start long-running `convex dev`
- Do not assume migrations or backwards compatibility unless product context requires it
