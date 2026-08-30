# Google Drive session workspaces plan

## Goal

Build the workflow in `plans/google-drive-session-workspaces-goal.md` as thin vertical slices. Each slice should add one usable behavior across storage, Google Drive, backend functions, UI, and tests.

## Non-negotiable rules and resolved decisions

- Use the owner's My Drive and the owner-created `VV Studios` root folder.
- Reuse the existing Google OAuth client after adding full Drive access to its refresh token.
- Use the normalized original booking email as the permanent client workspace key.
- Store Drive IDs. Never find managed resources by display name.
- Create session folders after the scheduled session end.
- Do not create historical workspaces or add a backfill.
- There is no live Drive workspace data. Replace per-session assets directly without a migration or backfill.
- Keep database assignment authoritative when Drive access setup fails.
- Track folders, client folder permissions, editor access, and each email separately.
- Never delete Drive content or recreate missing folders without admin confirmation.
- Accept the My Drive ownership limits in the goal document.
- Assume booking and editor emails are valid Gmail addresses. Do not verify them in the first release.
- Create one `_Assets` folder per client and reuse it across all ordinary and package sessions.
- Separate session folder date, time, and package-number parts with ` - `.
- Name session media folders `Raw Media (D.M.YY)` and `Deliverables (D.M.YY)`, without leading zeroes.
- Keep every package session in its own session directory, with dated `Raw Media` and `Deliverables` inside it.
- Read `convex/_generated/ai/guidelines.md` before changing Convex code.

## Implementation steps

### Step 1: Add the Google Drive foundation ✅ Base complete; `_Assets` revision in step 4A

Extract the existing Google OAuth client so Calendar and Drive share the same credentials. Add the owner-created root folder ID as the server-only `GOOGLE_DRIVE_ROOT_FOLDER_ID` configuration.

Add Drive operations that:

- create a folder below a specified parent;
- request and parse the folder ID, name, and web URL;
- grant and remove folder permissions; and
- map authentication, creation, response, and permission failures to safe domain errors.

Add `driveClients` and `driveSessions` tables. Store the normalized client email and the client folder and `_Assets` IDs and URLs on `driveClients`. Store session-specific folder IDs and URLs on `driveSessions`. Add ordinary-session naming in `Australia/Sydney` and unit tests for email normalization and folder names.

Reuse the existing Google Calendar OAuth application and refresh token. Grant the token Calendar and full Drive scopes in the deployed environment.

### Step 2: Create an ordinary session workspace manually ✅ Base complete; `_Assets` revision in step 4A

Add an authorized admin action for confirmed, non-package bookings. Expose it as `Google Drive folders` in the session actions menu.

The action should:

1. Normalize the booking email and reuse its saved client folder, or create one below the configured root.
2. Reuse the client's saved `_Assets` folder, or create it directly below the client folder.
3. Create the dated session folder below the client folder.
4. Create `Raw Media (D.M.YY)` and `Deliverables (D.M.YY)` inside the session folder using the session date in `Australia/Sydney` without leading zeroes.
5. Save each folder ID and URL immediately after Google returns it.
6. Reject package bookings and bookings that are not eligible.

Add an authorized status query and admin dialog. Report `not_created`, `incomplete`, or `ready`, and provide links for every saved folder whose URL is available. Do not expose raw provider errors, credentials, folder IDs, or links to unauthorized users.

Keep this slice one-shot and manual. An existing `driveSessions` record should block another setup attempt. Step 3 replaces that guard with resumable, replay-safe behavior before automatic scheduling is enabled.

### Step 3: Replace one-shot setup with scheduled, replay-safe setup ✅ Base complete; `_Assets` revision in step 4A

Schedule ordinary-session folder setup when a booking becomes confirmed. Run it at `sessionStartAt + duration`, or immediately when that time has already passed. Skip package sessions until step 7.

At run time, require the booking to remain eligible and its start time and duration to match the scheduled job. Treat cancelled bookings and stale jobs as expected skips without recording a setup failure.

Make folder setup resumable and replay-safe. The setup should:

1. Verify every saved client, global `_Assets`, session, and child folder by its Drive ID.
2. Continue from the first unsaved folder after a partial failure.
3. Give each created folder an application-owned opaque marker based on the client email or booking ID.
4. Look for that marker before creation and after an uncertain create response so a timeout does not create a duplicate folder.
5. Keep the folder that won the first database write when duplicate jobs overlap.
6. Report a missing saved folder as a setup failure instead of silently recreating it.

Save actionable provider and persistence failures on the booking, and expose `failed` separately from `not_created`, `incomplete`, and `ready`. Add an authorized `Retry Google Drive folders` action for failed or incomplete setup, then clear the saved failure after a successful retry. Keep `Set up Google Drive folders` for initial manual setup.

Cover confirmation scheduling, cancellation, stale jobs, duplicate jobs, replay from saved IDs, partial setup, uncertain create responses, failure classification, and successful retry.

### Step 4: Give the client access and send the assets email ✅ Base complete; `_Assets` revision in step 4A

After folder setup succeeds:

- grant the booking contact viewer access to the client folder;
- grant writer access to the client's `_Assets` folder;
- let `Raw Media (D.M.YY)` and `Deliverables (D.M.YY)` inherit viewer access from the client folder;
- send one branded Resend email containing the reusable `_Assets` link and explain that the client should keep assets there for future sessions.

Save client folder permission and assets-email results separately. A permission failure must not change folder readiness or block later editor setup.

Add admin status and retry controls for this slice.

Check after step: verify inherited client browsing, client viewer access to `Raw Media (D.M.YY)` and `Deliverables (D.M.YY)`, permission failure, and replay-safe emails.

### Step 4A: Replace per-session assets with one client assets library ✅

Update `driveClients` to store the global `_Assets` folder ID, URL, and client writer permission. Remove the per-session assets fields from `driveSessions`. No migration or backfill is needed because there is no live Drive workspace data.

Change ordinary and package setup so it creates or reuses one marked `_Assets` folder directly below the client folder. Stop creating `Assets` inside session folders. Use the marker to recover from retries and uncertain Drive responses. Do not add locking for simultaneous first-time setup; that race is unlikely enough to accept the possibility of an orphaned duplicate folder.

Update client access and the branded client assets email to use the saved global `_Assets` folder. Tell clients to keep reusable files there and to group episode-specific assets in any way that makes the intended session clear. A dated or descriptive subfolder is an example, not a required naming format. Keep sending the session-triggered assets email with the same reusable folder link so the client is reminded where to maintain their files.

Update folder status and recovery controls to show the global `_Assets` folder separately from session folders. Update session media names to `Raw Media (D.M.YY)` and `Deliverables (D.M.YY)`.

Check after step: cover first-client-folder creation, reuse across ordinary and package sessions, partial setup and retry, no per-session assets folder, client writer access, the reusable assets email link, dated deliverables names, and authorization.

### Step 5: Set up access for one editor assignment ✅

Extend the existing assignment flow after its database transaction succeeds. If the folders exist, grant the assigned editor:

- viewer access to the session;
- inherited viewer access to `Raw Media`;
- direct viewer access to the client's `_Assets` folder; and
- direct writer access to `Deliverables`.

Add `driveClientEditorPermissions` when implementing this step. Store one `_Assets` permission per client and editor pair so shared access can be reused across that editor's sessions for the client.

If assignment happens first, keep Drive access setup pending and finish it after folder setup. Keep the database assignment when Google fails.

After every required permission succeeds, suppress Google's permission email and send one branded assignment email. Write it for an editor completing this workflow for the first time. Tell them which session they have been assigned and include one prominent `Open editor dashboard` link to `/admin`. Do not include separate Drive folder links. The dashboard session page must provide access to the session folder, dated `Raw Media`, client `_Assets`, and dated `Deliverables`. Use clear action labels and explain what each folder is for. Present this workflow as a numbered list:

1. **Start the edit.** Open the editor dashboard, find the assigned session, and click `Start editing` before working on the files. Explain that this lets the team know editing has begun.
2. **Get the files.** Open the session folder and download the recorded footage from `Raw Media (D.M.YY)`. Open the client's separate `_Assets` folder to see if any relevant files supplied by the client e.g. brand guidelines, logo, etc.
3. **Upload the finished edit.** Put edited files for client in `Deliverables (D.M.YY)`.
4. **Send it for review.** Return to the session in the dashboard and click `Ready to review` only after the finished files are in `Deliverables (D.M.YY)`.

Make the dashboard link prominent. Do not assume the editor already understands the folder structure or status workflow.
also make it clear they would need to press the ... 3 dots button on the right of the dashboard to open the options for each session to start editing, access drive folders etc.

Add separate admin status and retry controls for editor access and assignment-email delivery. Keep `/admin` as the dashboard URL for now; it can be renamed separately in the future.

Check after step: cover assignment before and after setup, reuse of an existing editor permission on `_Assets`, suppressed Google permission emails, provider failure, retry, authorization, dashboard access to every required folder, first-time-editor clarity, the ordered workflow instructions, and duplicate branded email prevention.

### Step 6: Handle reassignment and unassignment ✅

On reassignment, grant the new editor access without waiting for the old editor's removal, so a removal failure never blocks the new editor from working. Save the old editor's permission snapshot before setup overwrites it, then remove their saved session and deliverables permissions. Remove their `_Assets` permission only when they have no other active assignment for the same client. Apply the same rule on unassignment. Notification failure must not block permission removal.

A removal failure is never retried automatically. Save a failed removal status instead, and give admins a manual retry action that removes the old editor's access using the saved snapshot. The assignment itself stays saved when Google fails.

Show the accepted My Drive limitation where useful: removing folder permissions does not remove access to files the editor owns.

Check after step: verify the old editor loses managed session access, retains `_Assets` while assigned to another session for the same client, loses `_Assets` after their final assignment for that client is removed, cannot browse other session directories, and keeps uploader-owned files under Google's documented behavior.

### Step 7: Add package workspaces

For a package booking, create one package folder beneath the client folder. Name it from package size and purchase date.

Before calling Drive, allocate the session number from scheduled dates of all non-cancelled package sessions, including future sessions. Save the number and never change it after folder creation. Create each package session as its own directory containing `Raw Media (D.M.YY)` and `Deliverables (D.M.YY)`. Reuse the client's global `_Assets` folder. Create no placeholder session folders.

Reuse the ordinary session setup, client access, and editor access behavior inside the package folder.

Check after step: cover sessions booked out of order, future sessions, cancellation gaps, concurrent setup, and retries that preserve allocated numbers.

### Step 8: Handle reschedules and client identity changes

After a reschedule, schedule a replacement setup job. A stale job must exit. Rename an existing session folder to its new date and time without changing a saved package session number. Update the short dates in its `Raw Media (D.M.YY)` and `Deliverables (D.M.YY)` names. The global `_Assets` name does not change.

Keep using the original normalized booking email and saved client folder ID after booking email or `accountName` changes. Warn admins that an email change does not update Drive permissions. Warn when a later `accountName` differs from the saved client workspace name.

Check after step: verify pre-setup and post-setup reschedules, stale jobs, package numbering, changed booking emails, and changed account names.

### Step 9: Deliver completed edits through the managed folder

Remove the editor workflow that accepts an arbitrary Drive link. Use the saved `Deliverables (D.M.YY)` folder.

Before a real transition to `completed`, list the folder's children. Block completion with clear copy when it is empty or Drive cannot verify it. After completion succeeds, send one branded client email containing only the `Deliverables (D.M.YY)` link.

A repeated save in `completed` must not resend. A later `completed → editing → completed` transition must send again. Completion must not remove editor permissions.

Add separate delivery-email status and retry controls.

Check after step: cover empty folders, listing failure, first completion, repeated saves, completion after reopening, authorization, and email retry.

### Step 10: Add explicit recovery controls

Finish the admin view with separate states for folders, client access, editor access, client assets email, editor links email, and deliverables email.

Surface Drive workflow failures on the sessions table itself, e.g. an error icon beside the assigned editor's name, so admins do not need to open the Drive dialog to discover a problem.

Provide authorized actions to:

- retry one failed operation;
- open saved folders;
- explicitly run `Set up Google Drive folders` after a deletion.

Do not use "provision" in user-facing copy. Renames and moves should continue through saved IDs. Deletions must never cause silent recreation.

Check after step: manually rename, move, disconnect, and delete test folders. Verify each recovery path and its authorization.

### Step 11: Run acceptance and regression checks

Repeat the required live scenarios from the goal document in a dedicated test hierarchy. Do not use production client folders. Record any behavior that differs from mocks, then update tests and the goal document.

Verify backend authorization for every setup, retry, assignment, and inspection function. Confirm unauthorized query results contain no Drive IDs or links.

Keep the file-level test inventory comment current in every changed test file. Run focused tests during each slice. At the end, run formatting, linting, type checking, and relevant tests. Do not run a production build or Convex code generation.
