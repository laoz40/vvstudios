# Google Drive session workspaces

## Purpose

Give each completed recording session a Google Drive workspace. Each client also gets one shared assets library that every assigned editor can view. The owner uploads raw media, the client maintains reusable assets, the assigned editor downloads source files and uploads deliverables, and the client reviews completed work.

This document records product decisions and Google Drive constraints. See `plans/11-google-drive-session-workspaces.md` for implementation order.

## Folder structure

Ordinary booking:

```text
VV Studios/
└── Client Name (VV Studios)/
    ├── _Assets/
    └── 13 Aug 2026 - 10:00 AM/
        ├── Raw Media (13.8.26)/
        └── Deliverables (13.8.26)/
```

Package booking:

```text
VV Studios/
└── Client Name (VV Studios)/
    ├── _Assets/
    └── 3-Session Package — 02 Jul 2026/
        ├── Session 01 - 13 Aug 2026 - 10:00 AM/
        │   ├── Raw Media (13.8.26)/
        │   └── Deliverables (13.8.26)/
        └── Session 02 - 27 Aug 2026 - 10:00 AM/
            ├── Raw Media (27.8.26)/
            └── Deliverables (27.8.26)/
```

Use `Australia/Sydney` for names. Dates use `DD MMM YYYY`; times use 12-hour time with `AM` or `PM`. Separate session-name parts with ` - `.

Create one `_Assets` folder directly below each client folder. Reuse it for every ordinary and package session belonging to that client. The leading underscore keeps it above date-named session folders in Google Drive's name sort. Do not create an assets folder inside a package or session directory.

Name each session's media folders `Raw Media (D.M.YY)` and `Deliverables (D.M.YY)`, without leading zeroes. The short date makes folders clear when editors open a session or see directly shared deliverables in Google Drive's `Shared with me` view.

Tell clients to keep reusable files directly in `_Assets`. When a file applies only to one episode or session, ask the client to group it in a way that makes the intended session clear. A dated or descriptive subfolder such as `21.8.26 - Episode 04 - Guest Name` is an example, not a required naming format. Editors should be able to tell which session a client-specific asset belongs to without opening every file.

Ordinary session names include the time to distinguish sessions on the same date. Package folders use the package size and purchase date. Package session numbers follow the scheduled date order of non-cancelled sessions, including future sessions. Once a folder exists, keep its number even after rescheduling or cancellation. Rename only its date and time after a reschedule.

Each created package session has its own session directory containing dated `Raw Media` and `Deliverables` folders. All package sessions use the client's global `_Assets` folder. Create no placeholders for future package sessions.

## Client identity

The normalized original booking email identifies a client workspace. Normalize it by trimming whitespace and lowercasing it.

This deliberately identifies the booking contact, not a company:

- The same email always reuses one client folder, even when `accountName` changes.
- Different emails create different client folders, even when the contacts work for one company.
- One producer using the same email for different companies gets one client folder.
- Additional client contacts are outside the first release.

Name a new client folder from `accountName`, falling back to the contact name. Retain that name on later bookings. Warn the admin when a later `accountName` differs, but keep using the saved folder ID.

The owner may rename or move folders in Drive. Saved Drive IDs remain valid. Never find a managed folder by display name.

If an admin changes a booking email after Drive setup, warn that Drive permissions will not change. The owner updates those permissions manually. The original normalized email remains the workspace identity.

For the first release, assume every booking and editor email is a valid Gmail address. Do not verify this in the application or support a separate Drive-access email.

## Permission model

The hierarchy lives in the owner's My Drive.

| Folder | Owner | Assigned editor | Other editors | Client |
| --- | --- | --- | --- | --- |
| `VV Studios` | Owner | No access | No access | No access |
| Client folder | Owner | No access | No access | Direct viewer |
| `_Assets` | Owner | Direct viewer while assigned to this client | No access | Direct writer |
| Package folder | Owner | No access | No access | Inherited viewer |
| Session folder | Owner | Direct viewer | No access | Inherited viewer |
| `Raw Media (D.M.YY)` | Owner | Inherited viewer | No access | Inherited viewer |
| `Deliverables (D.M.YY)` | Owner | Direct writer | No access | Inherited viewer |

Editors can download `Raw Media (D.M.YY)` and files from `_Assets`, but cannot edit them. They can manage files in `Deliverables (D.M.YY)`. An editor with any active assignment for a client can view that client's entire `_Assets` library, including assets that may apply to other sessions. They still see only their assigned session directories.

Clients can browse every session under their email-matched client folder and view or download `Raw Media (D.M.YY)` and `Deliverables (D.M.YY)`. Their `_Assets` writer access remains until the owner changes it manually.

Disable folder sharing by writers where My Drive supports `writersCanShare=false`. Never use `anyoneWithLink`. Keep downloading enabled for viewers and commenters.

## Accepted My Drive limitations

The uploader owns files added to My Drive, even inside someone else's folder.

The first release accepts that:

- editors own their uploaded deliverables;
- clients own their uploaded assets;
- uploaded files consume the uploader's storage;
- removing folder access does not remove access to files the person owns;
- uploaders can share files they own despite folder sharing restrictions; and
- the owner may not be able to recover a contributed file removed by its owner.

Do not automate ownership transfers. A future Shared Drive migration could give VV Studios ownership of every uploaded file.

## Lifecycle

### Workspace creation

When a booking becomes confirmed, schedule folder creation for `sessionStartAt + duration`. A stale job must stop after a reschedule. Schedule a replacement job for the new end time.

At the scheduled end, create folders only if the booking is still eligible. Staff must cancel no-shows and cancelled sessions before then. Do not create historical workspaces when the feature launches.

The implementation may expose a manual setup action while this workflow is being built. That action is not the launch trigger. Before launch, automatic scheduling must be the normal path, and admins should use explicit setup only for initial recovery after a deletion or disconnection.

If an editor was assigned before folder creation, save the assignment and apply permissions when the folders exist.

### Notifications

After client access succeeds, suppress Google's permission emails for every client permission grant and send one branded VV Studios email containing the client's reusable `_Assets` link. Tell the client to keep reusable files there instead of uploading them again for every session. Tell them to group files that apply only to one episode or session in a way that makes the intended session clear. A dated or descriptive subfolder is an example, not a required naming format.

After editor access succeeds, suppress Google's permission email and send one branded assignment email. Write it for an editor using the workflow for the first time. Tell them which session they have been assigned and include one prominent link labelled `Open editor dashboard`, pointing to `/admin`. Do not include separate Drive folder links. The dashboard session page is the entry point for the session folder, dated `Raw Media`, client `_Assets`, and dated `Deliverables`. Present these instructions as a numbered list:

1. **Start the edit.** Open the editor dashboard, find the assigned session, and click `Start editing` before working on the files. This lets the team know editing has begun.
2. **Get the files.** Open the session folder and download the recorded footage from `Raw Media (D.M.YY)`. Open the client's separate `_Assets` folder for reusable files supplied by the client. Use the client's grouping or file descriptions to find assets for this episode.
3. **Upload the finished edit.** Put every file the client needs to review in `Deliverables (D.M.YY)`.
4. **Send it for review.** Return to the session in the dashboard and click `Ready to review` only after the finished files are in `Deliverables (D.M.YY)`.

Do not assume the editor already understands the folder structure or dashboard statuses. Assignment triggers this notification. If assignment predates folder creation, send it when the folders and permissions are ready. Do not wait for raw media to be uploaded. Keep `/admin` as the editor dashboard URL for now; renaming it is future work.

When `editStatus` changes to `completed`, confirm that `Deliverables (D.M.YY)` contains a file. Block completion and explain the problem when it is empty or Drive cannot list it. When it contains files, send the existing branded first-time or recurring deliverables email with the saved `Deliverables (D.M.YY)` folder URL. Optional editor notes to the client stay as they work today. Every real transition back to `completed` sends another email. Repeated saves that leave the status unchanged do not.

Admin `Deliver` confirms in a dialog (optional client notes, whether to mark completed, and a link to the saved Deliverables folder). It does not accept a pasted Drive URL or a first-time/recurring override. Editor `Ready to review` is only a status change to `review`.

Completion does not remove editor access. Only unassignment does.

### Assignment changes

Save the database assignment even when Google is unavailable. Track Drive access setup separately.

On reassignment, remove the old editor's managed session and deliverables permissions before granting the new editor access. Remove the old editor's `_Assets` permission only when they have no other active assignment for the same client. Apply the same rule on unassignment. Accept that former editors retain files they own.

## Failure and recovery behavior

Track folder setup, client access, editor access, and each notification separately. One failure must not block unrelated work. For example, a client permission failure must not block editor access.

Retry temporary provider failures with bounded backoff. After retries fail, show a clear admin status and targeted retry action.

Use these admin-facing terms:

- `Google Drive folders not created`
- `Set up Google Drive folders`

Do not use "provision" in the UI.

The application never deletes Drive files or folders. If the owner deletes or disconnects a managed folder, never recreate it silently. Let an admin explicitly set up the folders again.

Check saved resources and permissions during setup, assignment changes, and notifications. Do not add periodic reconciliation or recovery jobs in the first release.

## Google setup

The owner creates the `VV Studios` My Drive folder manually. Store its folder ID in a server-only environment variable.

Reuse the existing Google Calendar OAuth client and `googleapis` dependency. Reauthorize once to replace `GOOGLE_REFRESH_TOKEN` with a token that has Calendar and full Drive access. Keep all credentials server-only.

## Required live check

Before launch, test with the owner's My Drive, a test editor, and a client Gmail account. Cover:

- ordinary and package folders;
- one global `_Assets` folder reused across ordinary and package sessions;
- assignment before and after folder creation;
- reassignment and unassignment;
- editor `_Assets` access retained until their final assignment for that client is removed;
- source downloads and uploads;
- client viewing and downloading of raw media;
- uploader ownership and sharing;
- client permission failure;
- manual folder rename;
- setup-again recovery; and
- empty and non-empty deliverables completion.
