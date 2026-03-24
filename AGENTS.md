# AGENTS.md

This file is guidance for coding agents operating in this repository.
Follow these instructions before making changes.

## Project Snapshot

- Stack: Astro 5 + Svelte 5 + TypeScript + Tailwind CSS v4.
- Package manager: `pnpm`
- UI baseline includes shadcn-svelte (`src/lib/components/ui`).

## Expected Workflow for Agents

1. Make minimal, focused changes.
2. Preserve existing architectural style.

## Code Style Guidelines

### Imports and Modules

- Prefer ESM imports.
- Keep imports at file top.
- Group imports by: external packages, then internal aliases/relative paths.

### TypeScript and Types

- Prefer explicit exported types for component props and utility contracts.
- Avoid `any`; if unavoidable, keep it tightly scoped and documented.

### Naming Conventions

- Svelte component files: `PascalCase.svelte`.
- Astro page files: route-oriented lowercase names (for example `index.astro`, `book.astro`).
- Utility functions/variables: `camelCase`.
- Exported type names: `PascalCase`.
- CSS custom properties: `--kebab-case`.

### Astro/Svelte Patterns

- In Svelte components, keep typed props clear and colocated.
- Preserve existing render structure and avoid unnecessary framework mixing.

### Tailwind

- Avoid arbitrary values: clamp, min(...), custom pixel brackets, and custom breakpoints

### Accessibility and UX Safety

- Preserve semantic HTML structure.
- Keep keyboard accessibility for interactive elements.
- Do not break disabled/aria behavior on shared components.
- Ensure color contrast remains acceptable when adjusting theme tokens.

## File/Change Hygiene

- Do not add new dependencies unless needed for the task.
- Do not edit generated artifacts unless the task explicitly requires it.
- Keep diffs small and task-focused.
