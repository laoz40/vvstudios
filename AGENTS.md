# AGENTS.md

Booking website for podcast studio. Includes internal dashboard for admins to manage bookings.
Extremely important website is accessible, and as fast first paint on marketing pages as possible. SEO is a priority.

## Stack

- Bun
- default to shadcn for ui
- t3env

Goal: Enforcing stricter linting rules incrementally. Each rule that is fixed should be its own small commit.
If a rule contains lots of errors which would result in a massive commit,
split into different commits per large file.

## Behaviour

- Ask user before making assumptions that change behavior, UX, architecture
- Always strive for concise, simple solutions
- If a problem can be solved in a simpler way, propose it

## File/Change Hygiene

### Good Practices

- Always use KISS, YAGNI, and DRY principles
- Before adding helper functions, check if similar function already exist in codebase
- Do not add wrapper functions, inline return arrows, barrel files, or factory helpers. Restructure the code instead, such as splitting hooks, extracting component, or moving logic into `lib/` files. If linting errors occur, then it means the code can likely be restructured in a cleaner way
- Every extraction must own real responsibility. If it only forwards or reconnects code split, undo the split and restructure
- Move reusable helpers, constants, and mappers into nearest appropriate `lib/` file instead of keeping them inside components, routes, or backend functions

### Comments

- Annotate complex/long functions and conditionals with simple comments to make the flow easier to understand.
- Preserve existing comments during refactors; do not delete comments just because code moved.
- Update comments when behavior changes so they stay accurate.

### Verify changes

- Run format, lint and typecheck once changes are complete
- dont run build or convex codegen unless asked to
- never use eslint ignore to bypass linter

## TypeScript

- Type names: `PascalCase`.
- Prefer absolute import aliases over relative imports
- Dont use nested ternaries and if statements
- Use discriminated unions for app state. Avoid boolean flags and optional fields that allow invalid combinations.
- Handle every union variant. Use `never` in the default case to force exhaustive switches.
- Parse boundary data once with a runtime schema, such as Zod. Do not trust `as SomeType`.
- If a value becomes `any`, stop and trace the source type. Do not patch around it with casts, duplicate aliases, or local unions.
