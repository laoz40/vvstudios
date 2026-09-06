---
name: vvstudios-convex
description: Project specific convex rules. ALWAYS read this skill before any convex/ work.
---

# Convex

- For Convex code, always read `convex/_generated/ai/guidelines.md` first.

- Dont duplicate constants/defaults between frontend and Convex; extract shared values to one importable source when possible.
- Dont suffix internal Convex function names with `Internal` or similar; these things are obvious from looking at the code already
- `multiBooking` domain concept is now known as `package`, however schema fields haven't renamed to avoid migration

- Dont blindly assume a migration needs to occur or backwards compatibility is necessary. Usually, feature being worked on isnt implemented so no live data. Always ask user to clarify.

## Neverthrow

- Keep Convex handlers as boundary adapters: each handler should call one service function and use `.match(tupleOk, tupleErr)` to convert service `Result` into tuple returned to client.
- `convex/services` should only contain service chain functions, a readable neverthrow `andThen` chain of domain operations.
- Put domain operations used by service chains in nearest appropriate file under `convex/lib`. Do not define helper operations in service files

## Tests

- At top of every test file, maintain one file-level comment that describes each test.
    - Format each test with short subheading, description on next line.
    - Dont place comments immediately above individual tests.
