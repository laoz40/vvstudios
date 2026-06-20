---
name: ponytail
description: >
  Reviews or audits code for over-engineering using the Ponytail ladder: YAGNI,
  stdlib, native platform features, existing dependencies, one-liners, then
  minimum code. Use when the user asks to review code, a diff, files, or the
  whole repo for unnecessary complexity, bloat, boilerplate, cuttable code,
  dead flexibility, speculative abstractions, needless dependencies, or simpler
  stdlib/native replacements. Handles both focused review and repo-wide audit
  based on the requested scope.
---

# Ponytail

Find unnecessary complexity and report what can be deleted or simplified.
The best outcome is getting smaller.

## Scope

Choose scope from the user's request:

- Focused review: specific diff, file, snippet, PR, or change.
- Repo audit: whole codebase, broad folders, or requests like "audit this repo",
  "find bloat", "what can we delete", or "what's still cuttable".

If scope is unclear, ask one short question before scanning.

## The ladder

Stop at the first rung that holds:

1. Does this need to exist at all? Speculative need = skip it. (YAGNI)
2. Stdlib does it? Use it.
3. Native platform feature covers it? Use that over custom code or a dependency.
4. Already-installed dependency solves it? Use it. Never add a new dependency
   for what a few clear lines can do.
5. Can it be one line? One line.
6. Only then: the minimum code that works.

Two rungs work? Prefer the higher one and move on. The first lazy solution that
works is the right one.

## Rules

- No unrequested abstractions: no interface with one implementation, no factory
  for one product, no config for a value that never changes.
- No boilerplate or scaffolding "for later". Later can scaffold for itself.
- Deletion over addition. Boring over clever.
- Fewest files possible. Shortest working diff wins.
- Two stdlib options, same size? Prefer the one that's correct on edge cases.
- Do not flag a small useful smoke test or assert-based self-check as bloat.

## Safety boundaries

Do not simplify away:

- input validation at trust boundaries
- error handling that prevents data loss
- security measures
- accessibility basics
- anything explicitly requested
- hardware calibration/tuning knobs for real-world drift or sensor variance

## Tags

- `delete:` dead code, unused flexibility, speculative feature. Replacement: nothing.
- `stdlib:` hand-rolled thing the standard library ships. Name the function.
- `native:` dependency or code doing what the platform already does. Name the feature.
- `yagni:` abstraction with one implementation, config nobody sets, layer with one caller.
- `shrink:` same logic, fewer lines. Show the shorter form.

## Hunt

Deps the stdlib or platform already ships, single-implementation interfaces,
factories with one product, wrappers that only delegate, files exporting one
thing, dead flags and config, hand-rolled stdlib, speculative abstractions,
custom code where native platform behavior is enough.

## Output

Focused review:

`<file>:L<line>: <tag> <what to cut>. <replacement>.`

Repo audit:

One line per finding, ranked biggest cut first:

`<tag> <what to cut>. <replacement>. [path]`

End with:

- Focused review: `net: -<N> lines possible.`
- Repo audit: `net: -<N> lines, -<M> deps possible.`

If there is nothing to cut, say `Lean already. Ship.` and stop.

## Boundaries

Scope: over-engineering and complexity only. Correctness bugs, security holes,
and performance are explicitly out of scope unless they are part of a proposed
simplification's safety boundary. Route normal bug/security/perf review to a
normal review pass.

Lists findings only; applies nothing unless the user separately asks for fixes.
