# Editor dashboard

An editor signs in and sees **only the confirmed sessions assigned to them**: customer name, session date, service, notes, deliverable status, and Drive when editing has started. Empty **Nothing in your queue** is not proof.

The drive helper creates a throwaway Clerk user (Backend API, `+clerk_test` email, no admin metadata), signs them in so Convex enrolls an editor profile, assigns a confirmed session from the admin UI, asserts the customer row, then deletes the Clerk user.

## Sub-features

- `temp-clerk-editor` creates and later deletes a Clerk user. No `E2E_EDITOR_EMAIL` required.
- `editor-enroll` first sign-in runs `createEditorUser` so they appear in the admin assign list.
- `admin-assign` assigns a **confirmed** session to that editor.
- `editor-assigned-row` shows that customer on **Edits** (or **History** if completed).

## How to get to it (user POV)

- Editor: `/login` then `/dashboard`. Tabs **Edits** and **History**.
- Admin assigns from Sessions → **Open session actions** → editor combobox → **Confirm assignment**.

## Driving it with Playwright

Preconditions:

- Launch + doctor.
- `E2E_ADMIN_EMAIL` plus `E2E_CLERK_SECRET_KEY` or `CLERK_SECRET_KEY` (Clerk Backend create/delete + testing sign-in).
- At least one confirmed session on the admin inbox.
- Desktop viewport. **Privacy off**.

- **Assigned-session drive.** `bun .agents/skills/verify-vvstudios/drive-editor.ts`. Exit 0 only when the editor table shows the assigned customer name.
- **Proof.** `admin-assign.png`, `editor-assigned.png`.

## Gotchas

- This is verification scaffolding, not a Playwright spec in `e2e/`.
- Clerk delete does not remove the Convex `editorProfiles` row. Later assign lists may show stale **VVVerify {timestamp}** names until someone deactivates them.
- The chosen session stays assigned to that (now deleted) Clerk token. Re-run may reassign a different inbox row.
- `SelectTrigger` `preventDefault` on pointerdown: focus the combobox and press Enter.
- Only confirmed / email_failed sessions are visible to editors.
- Do not `convex run` to patch assignment.
