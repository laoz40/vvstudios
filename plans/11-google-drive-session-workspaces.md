# Google Drive Session Workspaces Plan

## Goal

Create one Google Shared Drive hierarchy for VV Studios. Editors can browse all client and session work as read-only reference material, while receiving write access only to assigned sessions. Clients can browse their own client folder, upload assets, and comment on deliverables. Raw media remains limited to admins and the editor assigned to that session.

## Required folder structure

```text
VV Studios/
└── Client X (VV Studios)/
    ├── Session 01 — 13 Aug 2026/
    │   ├── Raw Media/
    │   ├── Assets/
    │   └── Deliverables/
    ├── Session 02 — 27 Aug 2026/
    │   ├── Raw Media/
    │   ├── Assets/
    │   └── Deliverables/
    └── Session 03 — 10 Sep 2026/
        ├── Raw Media/
        ├── Assets/
        └── Deliverables/
```

Session folder format:

```text
Session [Number] — [DD MMM YYYY]
```

Example:

```text
Session 04 — 13 Aug 2026
```

Use a two-digit session number in the displayed name. Store the underlying number separately so folder names do not become the source of truth.

## Permission model

| Folder | Admin | Assigned editor | Other editors | Client |
| --- | --- | --- | --- | --- |
| `VV Studios` shared drive | Manager | Viewer plus direct grants below | Viewer | No access |
| `Client X (VV Studios)` | Manager | Inherited viewer | Inherited viewer | Direct viewer |
| Session folder | Manager | Direct writer | Inherited viewer | Inherited viewer |
| `Raw Media` limited-access folder | Manager | Direct writer | Metadata/name only | Metadata/name only |
| `Assets` | Manager | Inherited writer | Inherited viewer | Direct writer |
| `Deliverables` | Manager | Inherited writer | Inherited viewer | Direct commenter |

### Admin

- Manages the shared drive and its complete hierarchy.
- Can create, organize, share, restrict, and remove all workspace content.
- Is the only role with permission-management access.

### Assigned editor

- Is a `Viewer` member of the `VV Studios` shared drive and can browse other client and session work as reference material.
- Receives a direct `writer` permission on each assigned session folder.
- Inherits writer access to `Assets` and `Deliverables`.
- Receives a separate direct `writer` permission on the assigned session's limited-access `Raw Media` folder because that folder does not inherit the session permission.
- Has read-only access to unassigned sessions, except their `Raw Media` folders.
- Must not receive Drive Manager, Content Manager, or permission-management access.

### Client

- Receives direct `viewer` access to `Client X (VV Studios)` and can browse that client's sessions.
- Inherits viewer access to session folders, `Assets`, and `Deliverables`.
- Receives a direct `writer` permission on each `Assets` folder.
- Receives a direct `commenter` permission on each `Deliverables` folder.
- Can see each `Raw Media` folder's name because it exists beneath an accessible parent, but cannot open or list its contents.
- Cannot modify or delete deliverable files through the commenter role.
- Receives no permission on the `VV Studios` shared-drive root or other client folders.

### Permission inheritance rule

Google Drive permissions flow down the folder tree and inherited permissions can be increased on a child. This allows an editor to inherit `Viewer` from the shared-drive root and receive direct `writer` access on an assigned session.

Every `Raw Media` folder must enable limited access by setting `inheritedPermissionsDisabled=true`. Only Shared Drive Managers can enable or disable this setting. Once enabled, shared-drive Managers and users added directly to that `Raw Media` folder can open it. Other editors and the client can see the folder's name/metadata but cannot open it.

This behavior is currently documented and supported by Google Drive and the Drive API. It requires a Google Workspace edition that supports Shared Drives, organization settings that allow the intended internal or external sharing, and an API identity with Manager (`organizer`) access.

## Lifecycle decision required before implementation

The requested triggers currently conflict:

- The workspace is proposed to be created when a session is completed.
- The editor needs `Raw Media` and `Assets` when they are assigned, which normally happens before editing can be completed.

Choose one provisioning trigger before implementation:

1. **Recommended:** provision the workspace when the booking becomes confirmed. Assignment and completion then only update permissions and send links.
2. Provision it on the first editor assignment. This works for editors but delays client asset access until an editor exists.
3. Provision it on session completion. This cannot support editor access before completion without a separate earlier provisioning path.

Also confirm whether “session completed” means the session date has passed or `editStatus` changes to `completed`. These are different events in the current application.

## Proposed automation flow

The following flow assumes the recommended option: provision after booking confirmation.

### 1. Provision the workspace

After a booking is safely confirmed:

1. Claim a provisioning job for the booking so retries and duplicate events cannot create duplicate folders.
2. Find or create `Client X (VV Studios)` under `VV Studios` and add direct client `viewer` access.
3. Allocate the next session number for that client transactionally.
4. Format the session date in the studio's agreed timezone.
5. Create the session folder and its three child folders.
6. Enable limited access on `Raw Media`.
7. Add direct client `writer` access to `Assets` and direct `commenter` access to `Deliverables`.
8. Save every Drive resource ID and provisioning state against the booking or a dedicated workspace record.
9. Mark provisioning as complete.

Do not locate folders by display name after creation. Names can change and are not guaranteed to be unique; saved Google Drive IDs are authoritative.

### 2. Notify the client

At the agreed client notification trigger:

1. Load the completed workspace record.
2. Send the client an email containing the `Assets` folder link and, if desired, the `Deliverables` link.
3. Record the notification attempt, success time, and provider message ID.
4. Retry transient failures without recreating permissions or folders.

The checklist says to send the assets link upon session completion. Confirm whether the client instead needs this before the recording so they can upload brand assets in advance.

### 3. Assign an editor

When an admin assigns an editor:

1. Ensure the workspace has been provisioned; if not, queue provisioning and leave the notification pending.
2. Confirm that the editor is a `Viewer` member of the `VV Studios` shared drive.
3. Add a direct `writer` permission for the editor's email on the session folder.
4. Add a direct `writer` permission on the limited-access `Raw Media` folder.
5. Save both Drive permission IDs so they can be removed later.
6. Email the editor links to the session folder, `Raw Media`, and `Assets`.
7. Record the notification result.

### 4. Reassign or unassign an editor

When the assignment changes:

1. Remove the previous editor's direct session and `Raw Media` permissions using their saved permission IDs.
2. The previous editor falls back to inherited viewer access on the session, `Assets`, and `Deliverables`, but cannot open `Raw Media`.
3. Add both session and `Raw Media` permissions for the new editor when applicable.
4. Send links only after the new permissions succeed.
5. Keep an audit record of the assignment and permission outcomes.

### 5. Complete editing

When `editStatus` first transitions to `completed`:

1. Do not recreate the workspace.
2. Verify that `Deliverables` exists and the client commenter permission remains present.
3. Send whichever completion notification is approved.
4. Make the transition idempotent so repeated saves of `completed` do not resend the email.

## Backend design

### Google ownership and authentication

- Prefer a Google Workspace Shared Drive owned by VV Studios rather than an employee's My Drive.
- Use a dedicated Google Cloud project and Drive API credentials.
- Authenticate as an identity that can manage the VV Studios shared drive. Confirm whether this will use a service account with Workspace domain-wide delegation or stored OAuth credentials for a VV Studios admin account.
- Keep credentials in server-only environment variables and never return credentials or raw provider errors to clients.
- Restrict OAuth scopes to the smallest set that supports folder and permission management.

### Convex boundaries

- Run Google Drive and email provider calls in internal Convex actions.
- Keep public mutations as authenticated boundary adapters that call one service function and map its `Result` with `.match(tupleOk, tupleErr)`.
- Keep service functions in `convex/services` as readable `andThen` chains.
- Put Drive API operations, naming, permission mapping, and provider-error mapping in the nearest modules under `convex/lib`.
- Use internal mutations before and after provider calls to claim work and persist results. Actions must not access `ctx.db` directly.
- Schedule provider work only after the booking or assignment transaction succeeds.

### Suggested persisted state

Use a dedicated workspace record if provisioning, permissions, and notifications need independent retries. Proposed fields:

- Booking ID, with a unique lookup path.
- Stable client key used for client-folder reuse.
- Allocated session number.
- Provisioning state as a discriminated union: `pending`, `provisioning`, `ready`, or `failed`.
- Root/shared drive ID.
- Client folder ID.
- Session folder ID.
- `Raw Media`, `Assets`, and `Deliverables` folder IDs.
- Direct client permission IDs for the client folder, `Assets`, and `Deliverables`.
- Current editor session permission ID, `Raw Media` permission ID, and assigned editor identity.
- Client and editor notification state and timestamps.
- Last safe error code and retry metadata.

Do not store several optional flags that permit impossible combinations such as `ready` without folder IDs. Parse Google API responses once at the provider boundary with a runtime schema.

## Session numbering

Session numbering must be deterministic and safe under concurrent bookings.

- Scope numbers to one stable client identity, not a mutable client display name.
- Allocate the number in a Convex mutation before creating Drive folders.
- Never calculate it by listing Drive folders or parsing their names.
- Do not reuse numbers after cancellation or deletion.
- Preserve the allocated number if provisioning retries.

Confirm which existing application identity defines a client: customer email, account/business ID, or another stable customer record. Email alone may merge or split clients incorrectly when addresses change or multiple contacts share a company.

## Naming and dates

- Sanitize control characters and path-like separators from client names while preserving normal punctuation.
- Keep the required em dash separator (`—`).
- Format dates as `DD MMM YYYY`, for example `13 Aug 2026`.
- Use one configured studio timezone so dates do not change based on the server or viewer timezone.
- Decide whether rescheduling renames an existing session folder. Recommended behavior is to rename it while retaining the same folder ID and session number.
- Decide whether client-name changes rename existing client and session folders. Recommended behavior is to rename future and active workspaces only, not historical folders automatically.

## Reliability and idempotency

- Treat Google Drive calls and email calls as retryable external effects.
- Claim each effect before execution and persist its completion separately.
- Reuse saved folder and permission IDs on retries.
- Where an API call succeeds but the response is lost, reconcile using an application-owned Drive property or another stable booking marker rather than folder name alone.
- Use bounded retries with backoff for rate limits and temporary provider failures.
- Surface permanent failures to admins with a manual retry action.
- Never send a link before its intended recipient's permission has succeeded.
- Removing an editor must not be blocked by an email failure.

## Security and privacy

- Authorize assignment and workspace retry operations on the backend; hidden UI is not a security boundary.
- Editors are intentionally allowed to browse the `VV Studios` shared drive as viewers; clients receive only their client-folder link and permission.
- Return only links the current user is authorized to receive.
- Use direct user or managed-group permissions, not `anyoneWithLink` permissions.
- Prevent editors from managing sharing settings.
- Review Shared Drive settings for external users, non-member sharing, downloading/copying, and contributor sharing.
- Confirm the editor upload workflow before rollout: Google documents that Shared Drive `Contributor` access can be read-only through Google Drive for desktop and ChromeOS Files. If editors require Drive for desktop rather than the web UI or API, test this with real editor accounts before choosing the final editing role.
- Log folder and permission IDs, booking IDs, operation names, and safe provider error codes. Do not log OAuth tokens or unnecessary client data.
- Document that Drive items manually re-shared outside the application can bypass the application's intended permission lifecycle; periodic reconciliation can detect drift.

## Implementation slices

1. **Confirm product and Google Workspace decisions**
   - Choose the provisioning and notification triggers.
   - Define the stable client identity and studio timezone.
   - Confirm Shared Drive availability and authentication method.
   - Confirm whether rescheduling and client-name changes rename folders.

2. **Add workspace domain state**
   - Add the minimal schema for allocated session numbers, folder IDs, permission IDs, and discriminated provisioning/notification states.
   - Add indexes for booking lookup and stable client lookup.
   - Do not add a data migration unless existing live bookings need workspaces; confirm this before implementation.

3. **Build and test the Drive provider boundary**
   - Add folder creation, folder rename, permission creation, permission removal, and reconciliation operations.
   - Map Google errors into safe domain errors.
   - Test naming, date formatting, response parsing, and error mapping without calling Google in unit tests.

4. **Provision one session workspace**
   - Implement the claim, Drive action, and persistence workflow.
   - Create the exact hierarchy, limited-access `Raw Media` folder, and direct client permissions.
   - Prove replaying the workflow does not create duplicates.

5. **Connect editor assignments**
   - Extend the existing assignment service to schedule permission synchronization after a successful assignment transaction.
   - Handle assignment, reassignment, and unassignment.
   - Keep database assignment authoritative if Drive or email is temporarily unavailable, and display synchronization failure to admins.

6. **Send client and editor emails**
   - Add concise email templates with only authorized links.
   - Send only after permissions succeed.
   - Persist delivery state and make retries idempotent.

7. **Add admin recovery controls**
   - Show workspace provisioning and permission-sync status.
   - Allow authorized admins to retry failed operations.
   - Provide links to the session workspace for admins without exposing private parent links to editors.

8. **Regression and quality pass**
   - Test authorization, parent-folder isolation, inheritance, duplicate triggers, partial provider failures, retries, reassignment, unassignment, and email failures.
   - Keep the required file-level test inventory comment current in every changed test file.
   - Run formatting, linting, type checking, and relevant tests. Do not run a production build or Convex code generation.

## Test plan

- A confirmed booking creates exactly one client/session hierarchy and three child folders.
- Concurrent sessions for one client receive unique sequential session numbers.
- Replayed confirmation or provisioning jobs do not duplicate folders or permissions.
- Every editor inherits viewer access from the `VV Studios` shared drive.
- The assigned editor receives direct writer access to the session and limited-access `Raw Media` folder.
- Unassigned editors can browse session, asset, and deliverable content read-only but cannot open `Raw Media`.
- The client can browse their client and session folders, receives direct writer access to `Assets`, and receives commenter access to `Deliverables`.
- The client can see the `Raw Media` folder name but cannot open or list its contents, and cannot access `VV Studios` or other clients.
- A link email is not sent before the matching Drive permission succeeds.
- Reassignment removes the old editor's permission before or as part of granting the new editor access.
- Unassignment removes editor access even when notification delivery fails.
- Retrying after a timeout reconciles an already-created folder instead of duplicating it.
- A reschedule follows the approved rename policy without changing folder IDs or session numbers.
- Unauthorized users cannot provision, retry, inspect, or change workspace permissions through direct Convex calls.
- Provider tokens and sensitive provider errors never appear in logs or client responses.

Provider mocks should cover Google success, conflict/replay, permission denial, rate limiting, timeout after remote success, and permanent invalid-recipient failures. Live Google integration checks should use a dedicated test Shared Drive and test accounts, not production client folders.

## Acceptance criteria

- Every eligible session has one workspace matching the required naming and child-folder structure.
- Session numbers are stable, sequential per client, and safe under concurrent provisioning.
- Admins can access the complete hierarchy.
- Editors can browse `VV Studios` and unassigned work as viewers, while assigned editors can write to their assigned session, `Raw Media`, `Assets`, and `Deliverables`.
- Clients can browse their own client/session hierarchy, edit `Assets`, comment on `Deliverables`, and cannot open `Raw Media`, `VV Studios`, or another client's folder.
- Editor reassignment and unassignment update Drive access reliably.
- Client and editor emails contain only links each recipient is authorized to open.
- Folder creation, permission changes, and emails are idempotent and recoverable after partial failure.
- The application stores Drive IDs as authoritative references and never depends on folder-name lookup.
- All backend operations enforce existing application authorization.

## Decisions to confirm

- [ ] Provision on booking confirmation, first editor assignment, or session completion.
- [ ] Define whether completion means the recording date has passed or `editStatus === "completed"`.
- [ ] Decide when the client should receive the `Assets` link; uploading assets likely requires access before session completion.
- [ ] Define the stable client identity used for folder reuse and numbering.
- [ ] Confirm the VV Studios timezone used in folder names.
- [ ] Confirm Google Workspace Shared Drive availability and that organization sharing settings permit all editor/client accounts.
- [ ] Confirm whether editors use the Drive web UI/API or Google Drive for desktop; test the required write workflow because Shared Drive Contributor behavior differs in Drive for desktop.
- [ ] Choose service-account/domain-wide delegation or admin OAuth authentication.
- [ ] Decide whether rescheduling renames the session folder.
- [ ] Decide whether client-name changes rename existing folders.
- [ ] Confirm whether existing live sessions need backfilled workspaces; no migration should be added otherwise.
