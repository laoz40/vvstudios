# Code Style

## Imports and Modules
- Prefer ESM imports.
- Keep imports at file top.
- Group imports by: external packages, then internal aliases/relative paths.

## TypeScript and Types
- Prefer explicit exported types for component props and utility contracts.
- Avoid `any`; if unavoidable, keep it tightly scoped and documented.

## Naming Conventions
- Svelte component files: `PascalCase.svelte`.
- Astro page files: route-oriented lowercase names (for example `index.astro`, `book.astro`).
- Utility functions/variables: `camelCase`.
- Exported type names: `PascalCase`.
- CSS custom properties: `--kebab-case`.
