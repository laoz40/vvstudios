---
name: verify-rerenders
description: Temporary React Profiler + Playwright script to baseline and verify re-render optimizations. User-invoked only.
disable-model-invocation: true
---

# Verify re-renders

Temporary tooling for one optimization task. Nothing here ships permanently. **Teardown** removes every file and wrapper when the task is done.

Leading words:

- **Check script** — `scripts/profiler-check.ts`, drives the browser and dumps `window.__renderLog`.
- **Baseline** — check script output before the optimization change.
- **Teardown** — delete check script, profiler utility, and all `<RenderProfiler>` wrappers.

## 1. Scope subtrees

Pick the smallest subtrees that should not re-render for the interaction under test. Wrap only those with `<RenderProfiler id="ComponentName">`.

**Done when:** each target subtree has a stable `id` string you will filter on in check script output.

## 2. Inject profiler (dev only)

Create the profiler utility and wire it in. Copy from [templates.md](templates.md).

- Utility file: `src/lib/render-profiler.tsx` (or next to the feature under test).
- Bootstrap: import and call `installRenderProfiler()` once at app boot (`import.meta.env.DEV` only). TanStack Start apps usually boot from `src/routes/__root.tsx` or the route that owns the subtree.
- Wrap scoped subtrees with `<RenderProfiler id="...">`.

**Done when:** `bun run dev` is up, browser console shows `window.__clearRenderLog` exists, and a manual `window.__clearRenderLog()` does not throw.

## 3. Write the check script

Create `scripts/profiler-check.ts`. Use Playwright as a library (`chromium` from `@playwright/test`), not the test runner.

The script should:

1. Launch browser, open the route under test (`http://localhost:3000/...`).
2. Wait for the UI to settle (prefer `waitForSelector` / `getByRole` over fixed sleeps).
3. Call `window.__clearRenderLog()`.
4. Perform the single interaction being optimized.
5. Wait for the resulting UI state.
6. Read `window.__renderLog`, print JSON to stdout.
7. Close the browser.

Reuse `e2e/helpers/*` for complex flows (booking form, reschedule) when it saves time.

**Done when:** `bun scripts/profiler-check.ts` prints a JSON array while dev server is running.

## 4. Baseline

Run the check script before changing render behavior. Save the output (paste in chat or a local `tmp/` file).

Filter on `phase === "update"` for re-renders. `"mount"` is first paint. `"nested-update"` is setState during the same commit.

**Done when:** you have per-`id` update counts and `actualDuration` totals for the interaction.

## 5. Optimize and re-check

Make the render optimization. Run the same check script with the same interaction sequence.

Compare against baseline:

| Signal | What improved |
|--------|---------------|
| Fewer `update` entries for a given `id` | subtree re-renders less |
| Lower `actualDuration` for same `id` | subtree commits faster |
| New `update` entries | possible regression |

**Done when:** targeted `id`s show fewer `update` entries than baseline, or you can explain why remaining renders are unavoidable (Convex subscription, legitimate prop change).

## 6. Teardown

Delete:

- `scripts/profiler-check.ts`
- Profiler utility file
- `installRenderProfiler()` import/call
- Every `<RenderProfiler>` wrapper

**Done when:** `git status` shows no profiler/check files and no leftover wrappers.

## Log output shape

Each log entry:

```ts
{ id: string; phase: "mount" | "update" | "nested-update"; actualDuration: number; ... }
```

Summarize for the user:

```
BookingForm: 3 updates (baseline 7)
DatePicker: 1 update (baseline 1) — no change
```

## Caveats

- **Strict Mode (dev)** double-mounts on first paint. Compare relative deltas, not absolute mount counts.
- **Profiler overhead** skews timings. Use `actualDuration` for before/after comparison only.
- **Async data** (Convex) causes legitimate updates after interaction. Clear the log after navigation settles, then act.
- **Scope** — only wrapped subtrees appear in the log. Parent-driven re-renders of unwrapped children are invisible.

## Reference

Code templates: [templates.md](templates.md)
