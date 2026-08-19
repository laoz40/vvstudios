# Google Drive session workspaces

## Purpose

Give each completed recording session a Google Drive workspace. The owner uploads raw media, the client uploads post-session assets, the assigned editor downloads source files and uploads deliverables, and the client reviews completed work.

This document records product decisions and Google Drive constraints. See `plans/11-google-drive-session-workspaces.md` for implementation order.

## Folder structure

Ordinary booking:

```text
VV Studios/
└── Client Name (VV Studios)/
    └── 13 Aug 2026 — 10:00 AM/
        ├── Raw Media/
        ├── Assets/
        └── Deliverables/
```

Package booking:

```text
VV Studios/
└── Client Name (VV Studios)/
    └── 3-Session Package — 02 Jul 2026/
        ├── Session 01 — 13 Aug 2026 — 10:00 AM/
        │   ├── Raw Media/
        │   ├── Assets/
        │   └── Deliverables/
        └── Session 02 — 27 Aug 2026 — 10:00 AM/
            ├── Raw Media/
            ├── Assets/
            └── Deliverables/
```

Use `Australia/Sydney` for names. Dates use `DD MMM YYYY`; times use 12-hour time with `AM` or `PM`.

Ordinary session names include the time to distinguish sessions on the same date. Package folders use the package size and purchase date. Package session numbers follow the scheduled date order of non-cancelled sessions, including future sessions. Once a folder exists, keep its number even after rescheduling or cancellation. Rename only its date and time after a reschedule.

Create no placeholders for future package sessions.

## Client identity

The normalized original booking email identifies a client workspace. Normalize it by trimming whitespace and lowercasing it.

This deliberately identifies the booking contact, not a company:

- The same email always reuses one client folder, even when `accountName` changes.
- Different emails create different client folders, even when the contacts work for one company.
- One producer using the same email for different companies gets one client folder.
- Additional client contacts are outside the first release.

Name a new client folder from `accountName`, falling back to the contact name. Retain that name on later bookings. Warn the admin when a later `accountName` differs, but keep using the saved folder ID.

The owner may rename or move folders in Drive. Saved Drive IDs remain valid. Never find a managed folder by display name.

If an admin changes a booking email after Drive setup, warn that Drive permissions will not change. The owner updates those permissions manually. The original normalized email remains the workspace identity. A session may have a separate Drive-access email when Google rejects the booking email.

## Permission model

The hierarchy lives in the owner's My Drive.

| Folder | Owner | Assigned editor | Other editors | Client |
| --- | --- | --- | --- | --- |
| `VV Studios` | Owner | No access | No access | No access |
| Client folder | Owner | No access | No access | Direct viewer |
| Package folder | Owner | No access | No access | Inherited viewer |
| Session folder | Owner | Direct viewer | No access | Inherited viewer |
| `Raw Media` | Owner | Direct viewer | No access | Metadata only |
| `Assets` | Owner | Inherited viewer | No access | Direct writer |
| `Deliverables` | Owner | Direct writer | No access | Direct commenter |

Enable limited access on every `Raw Media` folder with `inheritedPermissionsDisabled=true`.

Editors can download `Raw Media` and `Assets`, but cannot edit them. They can manage files in `Deliverables`. Editors see only assigned sessions. Unassignment removes all application-managed folder permissions.

Clients can browse every session under their email-matched client folder. Their `Assets` writer access and `Deliverables` commenter access remain until the owner changes them manually. They can see the `Raw Media` folder name but cannot open it.

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

If an editor was assigned before folder creation, save the assignment and apply permissions when the folders exist.

### Notifications

After client access succeeds, send one Google invitation and one branded VV Studios email containing the `Assets` link. Suppress redundant Google notifications for child permissions.

After editor access succeeds, send one Google invitation and one branded email containing links to `Raw Media`, `Assets`, and `Deliverables`. Assignment triggers this notification. If assignment predates folder creation, send it when the folders and permissions are ready. Do not wait for raw media to be uploaded.

When `editStatus` changes to `completed`, confirm that `Deliverables` contains a file. Block completion and explain the problem when it is empty. When it contains files, send a branded email containing only the `Deliverables` link. Every real transition back to `completed` sends another email. Repeated saves that leave the status unchanged do not.

Completion does not remove editor access. Only unassignment does.

### Assignment changes

Save the database assignment even when Google is unavailable. Track Drive synchronization separately.

On reassignment, remove the old editor's managed permissions before granting the new editor access. On unassignment, remove the saved direct permissions. Accept that former editors retain files they own.

## Failure and recovery behavior

Track folder setup, client access, editor access, and each notification separately. One failure must not block unrelated work. For example, a rejected client email must not block editor access.

Retry temporary provider failures with bounded backoff. After retries fail, show a clear admin status and targeted retry action.

Use these admin-facing terms:

- `Google Drive folders not created`
- `Set up Google Drive folders`
- `Reconnect existing Google Drive folder`

Do not use "provision" in the UI.

The application never deletes Drive files or folders. If the owner deletes or disconnects a managed folder, never recreate it silently. Let an admin reconnect an existing folder or explicitly set up the folders again.

Check saved resources and permissions during setup, assignment changes, and notifications. Do not add periodic reconciliation or recovery jobs in the first release.

## Google setup

The owner creates the `VV Studios` My Drive folder manually. Store its folder ID in a server-only environment variable.

Reuse the existing Google Calendar OAuth client and `googleapis` dependency. Reauthorize once to replace `GOOGLE_REFRESH_TOKEN` with a token that has Calendar and full Drive access. Keep all credentials server-only.

A non-Gmail address may already have a Google Account. Try the booking email first. If Google rejects it, keep the folders and editor workflow working. Let the admin enter another Drive email or ask the client to create a Google Account with the existing address.

## Required live check

Before launch, test with the owner's My Drive, a test editor, a client Google Account, and an address without a Google Account. Cover:

- ordinary and package folders;
- assignment before and after folder creation;
- reassignment and unassignment;
- source downloads and uploads;
- uploader ownership and sharing;
- client permission failure;
- manual folder rename;
- reconnect and setup-again recovery; and
- empty and non-empty deliverables completion.
