# AGENTS.md

This repository is an Astro 5 + Svelte 5 + TypeScript + Tailwind CSS v4 project.

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

- Avoid arbitrary values: clamp, min(...), custom pixel brackets, and custom breakpoints.
- Use theme-token color utilities (background, foreground, primary, etc.) over standard palette classes (white, gray, black).

### Accessibility and UX Safety

- Preserve semantic HTML structure.
- Keep keyboard accessibility for interactive elements.
- Do not break disabled/aria behavior on shared components.
- Ensure color contrast remains acceptable when adjusting theme tokens.

## File/Change Hygiene

- Do not add new dependencies unless needed for the task.
- Do not edit generated artifacts unless the task explicitly requires it.
- Keep diffs small and task-focused.

### Content

- Define page text content in `src/content` and use `import` to reference it.
