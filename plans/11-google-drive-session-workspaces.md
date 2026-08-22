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
- Keep database assignment authoritative when Drive synchronization fails.
- Track folders, client folder permissions, editor access, and each email separately.
- Never delete Drive content or recreate missing folders without admin confirmation.
- Accept the My Drive ownership limits in the goal document.
- Assume booking and editor emails are valid Gmail addresses. Do not verify them in the first release.
- Read `convex/_generated/ai/guidelines.md` before changing Convex code.

## Implementation steps

### Step 1: Add the Google Drive foundation ✅

Extract the existing Google OAuth client so Calendar and Drive share the same credentials. Add the owner-created root folder ID as the server-only `GOOGLE_DRIVE_ROOT_FOLDER_ID` configuration.

Add Drive operations that:

- create a folder below a specified parent;
- request and parse the folder ID, name, and web URL;
- grant and remove folder permissions; and
- map authentication, creation, response, and permission failures to safe domain errors.

Add `driveClients` and `driveSessions` tables. Store the normalized client email and every returned folder ID and URL. Add ordinary-session naming in `Australia/Sydney` and unit tests for email normalization and folder names.

Reuse the existing Google Calendar OAuth application and refresh token. Grant the token Calendar and full Drive scopes in the deployed environment.

### Step 2: Create an ordinary session workspace manually ✅

Add an authorized admin action for confirmed, non-package bookings. Expose it as `Google Drive folders` in the session actions menu.

The action should:

1. Normalize the booking email and reuse its saved client folder, or create one below the configured root.
2. Create the dated session folder below the client folder.
3. Create `Raw Media`, `Assets`, and `Deliverables`.
4. Save each folder ID and URL immediately after Google returns it.
5. Reject package bookings and bookings that are not eligible.

Add an authorized status query and admin dialog. Report `not_created`, `incomplete`, or `ready`, and provide links for every saved folder whose URL is available. Do not expose raw provider errors, credentials, folder IDs, or links to unauthorized users.

Keep this slice one-shot and manual. An existing `driveSessions` record should block another setup attempt. Step 3 replaces that guard with resumable, replay-safe behavior before automatic scheduling is enabled.

### Step 3: Replace one-shot setup with scheduled, replay-safe setup ✅

Schedule ordinary-session folder setup when a booking becomes confirmed. Run it at `sessionStartAt + duration`, or immediately when that time has already passed. Skip package sessions until step 7.

At run time, require the booking to remain eligible and its start time and duration to match the scheduled job. Treat cancelled bookings and stale jobs as expected skips without recording a setup failure.

Make folder setup resumable and replay-safe. The setup should:

1. Verify every saved client, session, and child folder by its Drive ID.
2. Continue from the first unsaved folder after a partial failure.
3. Give each created folder an application-owned opaque marker based on the client email or booking ID.
4. Look for that marker before creation and after an uncertain create response so a timeout does not create a duplicate folder.
5. Keep the folder that won the first database write when duplicate jobs overlap.
6. Report a missing saved folder as a setup failure instead of silently recreating it.

Save actionable provider and persistence failures on the booking, and expose `failed` separately from `not_created`, `incomplete`, and `ready`. Add an authorized `Retry Google Drive folders` action for failed or incomplete setup, then clear the saved failure after a successful retry. Keep `Set up Google Drive folders` for initial manual setup.

Cover confirmation scheduling, cancellation, stale jobs, duplicate jobs, replay from saved IDs, partial setup, uncertain create responses, failure classification, and successful retry.

### Step 4: Give the client access and send the assets email ✅

After folder setup succeeds:

- grant the booking contact viewer access to the client folder;
- grant writer access to `Assets`;
- grant commenter access to `Deliverables`;
- let `Raw Media` inherit viewer access from the client folder;
- send one branded Resend email containing the `Assets` link.

Save client folder permission and assets-email results separately. A permission failure must not change folder readiness or block later editor setup.

Add admin status and retry controls for this slice.

Check after step: verify inherited client browsing, client viewer access to `Raw Media`, permission failure, and replay-safe emails.

### Step 5: Synchronize one editor assignment

Extend the existing assignment flow after its database transaction succeeds. If the folders exist, grant the assigned editor:

- viewer access to the session;
- inherited viewer access to `Raw Media`;
- inherited viewer access to `Assets`; and
- direct writer access to `Deliverables`.

If assignment happens first, keep Drive synchronization pending and finish it after folder setup. Keep the database assignment when Google fails.

After every required permission succeeds, send one Google invitation and one branded email with the three folder links. Add separate admin status and retry controls for editor access and email delivery.

Check after step: cover assignment before and after setup, provider failure, retry, authorization, and duplicate email prevention.

### Step 6: Handle reassignment and unassignment

On reassignment, remove the old editor's saved direct permissions before granting the new editor access. On unassignment, remove all saved direct permissions. Notification failure must not block permission removal.

Show the accepted My Drive limitation where useful: removing folder permissions does not remove access to files the editor owns.

Check after step: verify the old editor loses managed folder access, other editors cannot browse the session, the new editor gets the correct access, and uploader-owned files keep Google's documented behavior.

### Step 7: Add package workspaces

For a package booking, create one package folder beneath the client folder. Name it from package size and purchase date.

Before calling Drive, allocate the session number from scheduled dates of all non-cancelled package sessions, including future sessions. Save the number and never change it after folder creation. Create no placeholder session folders.

Reuse the ordinary session setup, client access, and editor access behavior inside the package folder.

Check after step: cover sessions booked out of order, future sessions, cancellation gaps, concurrent setup, and retries that preserve allocated numbers.

### Step 8: Handle reschedules and client identity changes

After a reschedule, schedule a replacement setup job. A stale job must exit. Rename an existing session folder to its new date and time without changing a saved package session number.

Keep using the original normalized booking email and saved client folder ID after booking email or `accountName` changes. Warn admins that an email change does not update Drive permissions. Warn when a later `accountName` differs from the saved client workspace name.

Check after step: verify pre-setup and post-setup reschedules, stale jobs, package numbering, changed booking emails, and changed account names.

### Step 9: Deliver completed edits through the managed folder

Remove the editor workflow that accepts an arbitrary Drive link. Use the saved `Deliverables` folder.

Before a real transition to `completed`, list the folder's children. Block completion with clear copy when it is empty or Drive cannot verify it. After completion succeeds, send one branded client email containing only the `Deliverables` link.

A repeated save in `completed` must not resend. A later `completed → editing → completed` transition must send again. Completion must not remove editor permissions.

Add separate delivery-email status and retry controls.

Check after step: cover empty folders, listing failure, first completion, repeated saves, completion after reopening, authorization, and email retry.

### Step 10: Add explicit recovery controls

Finish the admin view with separate states for folders, client access, editor access, client assets email, editor links email, and deliverables email.

Provide authorized actions to:

- retry one failed operation;
- open saved folders;
- reconnect a folder by ID; and
- explicitly run `Set up Google Drive folders` after a deletion.

Use `Reconnect existing Google Drive folder`. Do not use "provision" in user-facing copy. Renames and moves should continue through saved IDs. Deletions must never cause silent recreation.

Check after step: manually rename, move, disconnect, and delete test folders. Verify each recovery path and its authorization.

### Step 11: Run acceptance and regression checks

Repeat the required live scenarios from the goal document in a dedicated test hierarchy. Do not use production client folders. Record any behavior that differs from mocks, then update tests and the goal document.

Verify backend authorization for every setup, retry, reconnect, assignment, and inspection function. Confirm unauthorized query results contain no Drive IDs or links.

Keep the file-level test inventory comment current in every changed test file. Run focused tests during each slice. At the end, run formatting, linting, type checking, and relevant tests. Do not run a production build or Convex code generation.
