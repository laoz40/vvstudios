# AGENTS.md

Booking website for podcast studio.

- bun
- default to shadcn for ui
- t3env

## File/Change Hygiene

- Before adding helper functions, check if similar function already exist in codebase
- Move reusable helpers, constants, and mappers into nearest appropriate `lib` file instead of keeping them inside components, routes, or backend functions.
- Do not make tiny helper files/functions for one-off logic
- Preserve existing comments during refactors; do not delete comments just because code moved.
- Update comments when behavior changes so they stay accurate.
- At the top of every test file, maintain one file-level comment that lists each individual test and briefly explains what it verifies. Do not place these required test-description comments immediately above individual tests.

Do these practices:
- Mysterious Name — a function, variable, or type whose name doesn't reveal what it does or holds. → rename it; if no honest name comes, the design's murky.
- Data Clumps — the same few fields or params keep travelling together (a type wanting to be born). → bundle them into one type, pass that.
- Primitive Obsession — a primitive or string standing in for a domain concept that deserves its own type. → give the concept its own small type.
- Repeated Switches — the same switch/if-cascade on the same type recurs → replace with polymorphism, or one map both sites share.
- Shotgun Surgery — one logical change forces scattered edits across many files → gather what changes together into one module.
- Divergent Change — one file or module is edited for several unrelated reasons. → split so each module changes for one reason.
- Speculative Generality — abstraction, parameters, or hooks added for needs the spec doesn't have. → delete it; inline back until a real need shows.
- Middle Man — a class or function that mostly just delegates onward. → cut it, call the real target direct.

- run format and lint and typecheck once changes are complete
- do not run build or convex codegen unless asked to

## Behavior

- Ask user before making assumptions that change behavior, UX, architecture
- Always strive for concise, simple solutions
- If a problem can be solved in a simpler way, propose it
- Annotate complex functions and conditions with simple comments to make the flow easier to understand.
- When responding, instead of generic summary, show what functions got add or edit for each file, give brief explanations what they do

## Code Style Guidelines

### Naming Conventions

- component files: `PascalCase.tsx`.
- Type names: `PascalCase`.

### Imports

- Prefer absolute import aliases over relative imports
- Remove unused imports
- Don't export functions/types if not used in other files

### Components and pages

- Extract major or self-contained UI sections into separate component files instead of growing a single large component file
- Group related React setup/state in clear sections, use short section comments for group
- Add short comments before `useEffect` blocks that explain what effect does

### TypeScript

- Do not use nested ternaries and if statements
- Use discriminated unions for app state. Avoid boolean flags and optional fields that allow invalid combinations.
- Handle every union variant. Use `never` in the default case to force exhaustive switches.
- Parse boundary data once with a runtime schema, such as Zod. Do not trust `as SomeType`.
- If a value unexpectedly becomes `any`, stop and trace the source type. Do not patch around it with casts, duplicate aliases, or local unions.

### Tailwind

- Avoid arbitrary values: clamp, min(...), custom pixel brackets, and custom breakpoints.
- Use theme-token color utilities (background, foreground, primary, etc.) over standard palette classes (white, gray, black).
- Do not add classes that already exist in the parent component
- Use tailwind cn skill to organise long classes
- For loading, show animated Lucide spinner alongside concise state label (eg. `Saving`), not just trailing-ellipsis label eg. `Saving...`.

### Convex

- For Convex code, always read `convex/_generated/ai/guidelines.md` first.
- Do not duplicate constants/defaults between frontend and Convex; extract shared values to one importable source when possible.
- Do not suffix internal Convex function names with `Internal`; the `internal.*` namespace already communicates visibility.
- Refer to the `multiBookingPackages` domain concept as a package in code names, such as `packageId`, `packageFromDb`, and `packageSessions`. Keep existing schema table and field names that contain `multiBooking`; do not rename them or add a migration solely for this naming preference.

- Do not blindly assume a migration needs to occur. Most of the time, the feature being worked on is not yet implemented so there is no live data. Always ask the user whether a migration is necessary.
