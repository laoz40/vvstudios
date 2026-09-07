---
name: vvstudios-frontend
description: Project specific frontend rules. ALWAYS read this skill before any frontend work. React, Tailwind related code.
---

# Frontend

## Code Style Guidelines

### Naming Conventions

- component files: `PascalCase.tsx`.

### Components and pages

- Extract major or self-contained UI sections into separate component files instead of growing a single large component file
- Group related React setup/state in clear sections, use short section comments for group
- Add short comments before `useEffect` blocks that explain what effect does

### Tailwind

- Avoid arbitrary values: clamp, min(...), custom pixel brackets, and custom breakpoints.
- Use theme-token color utilities (background, foreground, primary, etc.) over standard palette classes (white, gray, black).
- Do not add classes that already exist in the parent component
- Use tailwind cn skill to organise long classes
- For loading, show animated Lucide spinner alongside concise state label (eg. `Saving`), not just trailing-ellipsis label eg. `Saving...`.
