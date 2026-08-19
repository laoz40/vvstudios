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
- Track folders, client access, editor access, and each email separately.
- Never delete Drive content or recreate missing folders without admin confirmation.
- Accept the My Drive ownership limits in the goal document.
- Read `convex/_generated/ai/guidelines.md` before changing Convex code.

## Implementation steps

### Step 1: Verify Google Drive behavior

Reauthorize the existing Google OAuth application with Calendar and full Drive access. Add the owner-created root folder ID to server-only configuration.

Use a disposable folder, a test editor, a client Google Account, and an email without a Google Account. Verify:

- folder creation under the configured root;
- limited access on `Raw Media`;
- viewer, commenter, and writer permissions;
- `writersCanShare=false` where My Drive supports it;
- suppressed invitation emails on child permissions;
- uploads, ownership, sharing, and permission removal; and
- the provider response fields needed to save and verify resources.

Check after step: update the goal document if Google behaves differently from the accepted design. Do not build around unverified permission behavior.

### Step 2: Create one ordinary session workspace manually

Add the smallest data model and Drive operations needed to create one ordinary session workspace from an authorized admin action.

The action should:

1. Reuse or create the client folder from the normalized original booking email.
2. Create the dated session folder under it.
3. Create `Raw Media`, `Assets`, and `Deliverables`.
4. Limit access to `Raw Media`.
5. Save every Drive ID as soon as Google returns it.
6. Show the saved folders and folder status to an authorized admin.

Use `Australia/Sydney` and the exact names in the goal document. Parse Google responses with runtime schemas and map failures to safe domain errors. Do not expose raw provider errors, credentials, Drive IDs, or links to unauthorized users.

Check after step: create an ordinary workspace, open each saved folder, and confirm another editor cannot browse it.

### Step 3: Make ordinary folder setup scheduled and replay-safe

When a booking becomes confirmed, schedule setup for `sessionStartAt + duration`. At run time, confirm the booking is still eligible and its timing still matches the scheduled job.

Make setup safe after duplicate jobs, partial failures, and timeouts. Verify saved resources by ID. For an uncertain create result, reconcile with an application-owned opaque marker such as the booking ID. Do not search by folder name.

Add bounded retry metadata and an admin retry action. A missing saved folder must produce `Google Drive folders not created`; it must not trigger silent recreation.

Check after step: cover cancellation, stale jobs, duplicate jobs, partial setup, replay, and a timeout after Google created a folder.

### Step 4: Give the client access and send the assets email

After folder setup succeeds:

- grant the booking contact viewer access to the client folder;
- grant writer access to `Assets`;
- grant commenter access to `Deliverables`;
- keep `Raw Media` inaccessible;
- send one useful Google invitation; and
- send one branded Resend email containing the `Assets` link.

Save client access and both notification results separately. Support a session-specific Drive email override without changing client identity. A rejected email must not change folder readiness or block later editor setup.

Add admin status, retry, and override controls for this slice.

Check after step: verify inherited client browsing, `Raw Media` isolation, rejected addresses, override behavior, and replay-safe emails.

### Step 5: Synchronize one editor assignment

Extend the existing assignment flow after its database transaction succeeds. If the folders exist, grant the assigned editor:

- viewer access to the session;
- direct viewer access to limited `Raw Media`;
- inherited viewer access to `Assets`; and
- direct writer access to `Deliverables`.

If assignment happens first, keep Drive synchronization pending and finish it after folder setup. Keep the database assignment when Google fails.

After every required permission succeeds, send one Google invitation and one branded email with the three folder links. Add separate admin status and retry controls for editor access and email delivery.

Check after step: cover assignment before and after setup, rejected editor email, provider failure, retry, authorization, and duplicate email prevention.

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
- enter a client Drive email override;
- open saved folders;
- reconnect a folder by ID; and
- explicitly run `Set up Google Drive folders` after a deletion.

Use `Reconnect existing Google Drive folder`. Do not use "provision" in user-facing copy. Renames and moves should continue through saved IDs. Deletions must never cause silent recreation.

Check after step: manually rename, move, disconnect, and delete test folders. Verify each recovery path and its authorization.

### Step 11: Run acceptance and regression checks

Repeat the required live scenarios from the goal document in a dedicated test hierarchy. Do not use production client folders. Record any behavior that differs from mocks, then update tests and the goal document.

Verify backend authorization for every setup, retry, reconnect, assignment, and inspection function. Confirm unauthorized query results contain no Drive IDs or links.

Keep the file-level test inventory comment current in every changed test file. Run focused tests during each slice. At the end, run formatting, linting, type checking, and relevant tests. Do not run a production build or Convex code generation.
