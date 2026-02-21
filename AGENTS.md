# AGENTS.md

This file is guidance for coding agents operating in this repository.
Follow these instructions before making changes.

## Project Snapshot

- Stack: Astro 5 + Svelte 5 + TypeScript + Tailwind CSS v4.
- Package manager: `pnpm` (lockfile: `pnpm-lock.yaml`).
- Important aliases: `$lib` and `$lib/*` from `tsconfig.json`.
- UI baseline includes shadcn-svelte style patterns (`components.json`, `src/lib/components/ui`).

## Cursor/Copilot Rules

- `.cursorrules`: not present.
- `.cursor/rules/`: not present.
- `.github/copilot-instructions.md`: not present.
- If any of these files are later added, treat them as higher-priority, repo-local policy and update this file.

## Build, Lint, and Test Commands

Current scripts in `package.json`:

- `pnpm dev`
- `pnpm build`
- `pnpm preview`
- `pnpm astro`

Current status of quality gates:

- Lint script: not configured.
- Test script: not configured.
- Typecheck script: not configured as a package script.

What to run today:

- Build verification: `pnpm build`
- Formatting check (without writing): `pnpm prettier --check .`
- Formatting fix: `pnpm prettier --write .`

Type checking note:

- Astro check is available through the Astro CLI pattern, but `@astrojs/check` is not currently installed.
- If enabled by maintainers, run: `pnpm astro check`

## Single Test Guidance (Important)

There is currently no test runner configured in this repository.
Because of that, there is no working single-test command yet.

When a test framework is introduced, use the framework-native single-test command pattern:

- Vitest file: `pnpm vitest path/to/file.test.ts`
- Vitest test name: `pnpm vitest -t "test name"`
- Playwright file: `pnpm playwright test path/to/spec.ts`
- Jest file: `pnpm jest path/to/file.test.ts`

If you add tests in a PR, also add matching `package.json` scripts and update this section.

## Expected Workflow for Agents

1. Read related files fully before editing.
2. Make minimal, focused changes.
3. Preserve existing architectural style.
4. Run relevant verification commands.
5. Report what was run and what could not be run.

## Code Style Guidelines

### Formatting

Respect `.prettierrc` exactly:

- Tabs enabled (`useTabs: true`), tab width 2.
- Max line width: 80.
- Semicolons required.
- Double quotes preferred.
- Trailing commas: `all`.
- Astro files parsed with `prettier-plugin-astro`.
- Attribute-per-line behavior is enabled for multi-line markup.

Do not manually reformat unrelated lines.

### Imports and Modules

- Prefer ESM imports.
- Keep imports at file top.
- Use `$lib` alias for shared library paths where appropriate.
- Follow existing convention of `.js` extension in TS-authored import specifiers when required by Astro/Svelte tooling.
- Group imports by: external packages, then internal aliases/relative paths.

### TypeScript and Types

- Prefer explicit exported types for component props and utility contracts.
- Reuse shared utility types from `src/lib/utils.ts` when suitable.
- Avoid `any`; if unavoidable, keep it tightly scoped and documented.
- Prefer narrow unions and inferred return types over broad `unknown`/`any` surfaces.
- Keep path aliases and tsconfig expectations intact.

### Naming Conventions

- Svelte component files: `PascalCase.svelte`.
- Astro page files: route-oriented lowercase names (for example `index.astro`, `book.astro`).
- Utility functions/variables: `camelCase`.
- Exported type names: `PascalCase`.
- CSS custom properties: `--kebab-case`.

### Astro/Svelte Patterns

- In `.astro`, keep imports and setup in frontmatter block.
- In Svelte components, keep typed props clear and colocated.
- Preserve existing render structure and avoid unnecessary framework mixing.
- Favor composition of existing UI primitives from `src/lib/components/ui`.

### Tailwind and CSS

- Reuse design tokens from `src/styles/global.css`.
- Prefer utility classes and CSS variables over one-off hardcoded styles.
- Keep theme variables consistent with current naming.
- Avoid introducing a parallel design-token system.

### Error Handling and Resilience

- Fail loudly during development; avoid silent catches.
- For external scripts/widgets (for example Simplybook embed), guard against runtime load failures where feasible.
- Surface actionable error messages for integrator-facing failures.
- Avoid swallowing promise rejections.

### Accessibility and UX Safety

- Preserve semantic HTML structure.
- Keep keyboard accessibility for interactive elements.
- Do not break disabled/aria behavior on shared components.
- Ensure color contrast remains acceptable when adjusting theme tokens.

## File/Change Hygiene

- Do not rename/move files unless required.
- Do not add new dependencies unless needed for the task.
- Do not edit generated artifacts unless the task explicitly requires it.
- Keep diffs small and task-focused.

## Validation Checklist Before Finishing

- Run `pnpm build` when changes affect runtime behavior.
- Run `pnpm prettier --check .` (or `--write` then re-check) for formatting-sensitive edits.
- If a future lint/test setup exists, run project lint and tests.
- If you cannot run a check, state why and provide exact follow-up command.

## Commit/PR Notes for Agents

- Explain why a change was made, not only what changed.
- Mention any follow-up tasks (for example: add tests, add lint script, add `@astrojs/check`).
- Keep commit scope aligned with a single intent.
