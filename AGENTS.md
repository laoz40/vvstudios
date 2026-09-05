# AGENTS.md

Booking website for podcast studio.

- bun
- default to shadcn for ui
- t3env

Goal: enforcing stricter linting rules incrementally. each rule that is fixed should be its own small commit. 
if a rule contains lots of errors which would result in a massive commit,
split into different commits per large file.

## File/Change Hygiene

- Before adding helper functions, check if similar function already exist in codebase
- Move reusable helpers, constants, and mappers into nearest appropriate `lib` file instead of keeping them inside components, routes, or backend functions.
- Do not make tiny helper files/functions for one-off logic
- Preserve existing comments during refactors; do not delete comments just because code moved.
- Update comments when behavior changes so they stay accurate.
- At the top of every test file, maintain one file-level comment that lists each individual test. Format each item as a short subheading with its description on the next line. Do not place these required test-description comments immediately above individual tests.

- run format and lint and typecheck once changes are complete
- do not run build or convex codegen unless asked to
- never use eslint ignore to bypass linter

## Behaviour

- Ask user before making assumptions that change behavior, UX, architecture
- Always strive for concise, simple solutions
- If a problem can be solved in a simpler way, propose it
- Always apply YAGNI principle
- Annotate complex/long functions and conditionals with simple comments to make the flow easier to understand.

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
- Keep Convex handlers as boundary adapters: each handler should call one service function and use `.match(tupleOk, tupleErr)` to convert the service `Result` into the tuple returned to the client.
- Put service functions in `convex/services`. A service function should contain only a readable `andThen` chain of domain operations. Each successful operation passes its `ok` value to the next operation; the chain stops at the first `err` and returns that error.
- Put the domain operations used by service chains in the nearest appropriate file under `convex/lib`. Do not define helper operations in service files; `convex/services` should contain only the service chain functions. Make sure to verify this.
- Do not duplicate constants/defaults between frontend and Convex; extract shared values to one importable source when possible.
- Do not suffix internal Convex function names with `Internal`; the `internal.*` namespace already communicates visibility.
- Refer to the `multiBookingPackages` domain concept as a package in code names, such as `packageId`, `packageFromDb`, and `packageSessions`. Keep existing schema table and field names that contain `multiBooking`; do not rename them or add a migration solely for this naming preference.

- Do not blindly assume a migration needs to occur. Most of the time, the feature being worked on is not yet implemented so there is no live data. Always ask the user whether a migration is necessary.
