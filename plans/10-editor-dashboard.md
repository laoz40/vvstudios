# Editor Dashboard Plan

## Goal

Treat every authenticated non-admin user with an active editor profile as an editor. Editors can use a restricted sessions dashboard for sessions assigned to them, but they are never granted admin permissions.

## Access rules

| Capability | Admin | Editor |
| --- | --- | --- |
| Sign in | Yes | Yes |
| View sessions dashboard | Yes | Yes |
| View packages dashboard | Yes | No |
| View confirmed sessions | Yes | Assigned sessions only |
| View abandoned, cancelled, expired, pending, or failed sessions | Yes | No |
| View archived sessions | Yes | No |
| View contact, package, amount, or ABN data | Yes | No |
| Send a deliverables email | Yes | Yes |
| Change deliverables status | Yes | Yes |
| Edit, archive, delete, reschedule, invoice, payment, or availability actions | Yes | No |
| Assign an editor to a session | Yes | No |

## Permission model

- Define permissions as a typed `action:resource` union, with one permission per capability rather than broad role checks. Initial permissions should include `view:sessions`, `view:packages`, `view:sensitive-booking-data`, `update:deliverables`, `send:deliverables-email`, `assign:session-editor`, `update:editor-access`, `edit:sessions`, `archive:sessions`, `delete:sessions`, `create:reschedule-links`, `update:payment-status`, `create:invoices`, `send:invoice-emails`, and `update:availability`.
- Define one role-to-permissions map. Admins receive every permission; editors receive only `view:sessions`, `update:deliverables`, and `send:deliverables-email`.
- Use one backend `requirePermission(ctx, permission)` guard for authentication and authorization.
- Use a shared frontend `hasPermission(permissions, permission)` helper for readable UI checks such as `hasPermission(access.permissions, "view:packages")`.
- Backend guards and safe query projections are the security boundary. Frontend permission checks only control presentation.

## Implementation

Implement each step as a thin vertical slice. Start each slice with its focused failing tests, then add only the backend and UI needed to make that behavior usable before moving to the next slice. Keep all editor authorization scenarios in `convex/tests/editorAuthorization.test.ts`, with a short comment for every individual test.

1. **Recognize an editor and open the dashboard shell**
   - Add the `editorProfiles` table keyed by stable Clerk `identity.tokenIdentifier`, including display name, email, and active status.
   - Create an active profile on first sign-in and refresh name/email later, but never reactivate an inactive profile through sign-in.
   - Define the typed permission union, the single role-to-permissions map, backend `requirePermission(ctx, permission)`, and frontend `hasPermission(permissions, permission)` helper in the nearest shared auth modules.
   - Continue identifying admins from Clerk public metadata. Treat every other authenticated identity as an editor only when an active editor profile exists.
   - Update `getCurrentUserAccess` to return the real role and permissions. Editors initially receive `view:sessions`, `update:deliverables`, and `send:deliverables-email`; admins receive all permissions.
   - Route an active editor through the existing authenticated dashboard entry point and render a Sessions-only empty/loading shell. Do not fetch admin sessions or packages for editors.
   - Test active, inactive, and missing editor profiles, admin access, signed-out access, and missing or unknown Clerk role metadata.

2. **Assign one editor and show one safe session row**
   - Add optional `assignedEditorTokenIdentifier` to bookings and index it for editor lookups. Existing bookings remain unassigned.
   - Add the smallest admin-only assignment function protected by `assign:session-editor`; validate that the selected profile is active.
   - Add an editor sessions query protected by `view:sessions`. Derive the caller's token identifier on the server and query only their assigned bookings.
   - Return only `confirmed` and `email_failed` bookings that are not archived.
   - Return a dedicated projection containing customer name, account/business name, client notes, session date/time, service, deliverables status, and created date.
   - Omit email, phone, Instagram, ABN, package and invoice data, and every price or payment field at the query boundary.
   - Render that projection as the first restricted editor session row, without Contact, Package, Amount, or ABN UI.
   - Test that the editor sees the assigned row end to end, cannot see unassigned or another editor's rows, and never receives restricted fields over the network. Verify admins still see all sessions.

3. **Complete the editor's read-only Sessions view**
   - Render all assigned eligible sessions from the safe editor query using the restricted row.
   - Hide the Packages tab and query, availability settings, archived and unconfirmed filters, editor identities, assignment controls, and all row actions.
   - Use `hasPermission` for presentation checks; do not check roles or permission keys directly.
   - Add supported UI tests for editor navigation, visible columns, filters, and absence of admin actions.
   - Verify the existing admin Sessions and Packages views remain unchanged.

4. **Let an editor update deliverables status for one eligible session**
   - Protect `updateSessionEditStatus` with `update:deliverables`.
   - Load the booking in the mutation and require it to be assigned to the requesting editor, confirmed, in the past, and not archived. Admins may bypass assignment, but not eligibility.
   - Expose only the deliverables status control in the restricted row and connect it to the protected mutation.
   - Test the successful UI-to-backend flow plus direct Convex attempts against future, archived, unconfirmed, unassigned, and another editor's sessions.

5. **Let an editor send one eligible deliverables email**
   - Protect `sendSessionDeliverablesEmail` with `send:deliverables-email` and apply the same server-side ownership and eligibility checks as the status mutation.
   - Expose the deliverables email dialog in the restricted row. Do not show the recipient address because the backend already knows it.
   - Test the successful UI-to-backend flow and rejected direct calls for every ineligible or unauthorized session case.

6. **Give admins the complete assignment workflow**
   - Extend the assignment function to support assign, reassign, and unassign while retaining one editor per session.
   - Add an admin-only active-editor list and an assignment control on the admin session row.
   - Protect the workflow with `assign:session-editor`; never expose editor identities or controls in the editor projection or UI.
   - Test assign, reassign, and unassign, rejection of inactive profiles, editor attempts to assign, and unchanged admin access regardless of assignment.

7. **Deactivate an editor without rewriting history**
   - Add the admin-only editor access action protected by `update:editor-access`.
   - On deactivation, retain all booking assignment identifiers for audit history and immediately deny the editor's dashboard query and actions.
   - Keep sign-in profile refresh from reactivating the editor; admins reassign affected sessions manually.
   - Test immediate access loss, retained assignments, failed sign-in reactivation, and successful admin reassignment.

8. **Close every remaining backend authorization path**
   - Assign a specific permission to each existing sensitive query, mutation, and action rather than introducing a broad `manage:sessions` permission.
   - Grant admin-only permissions for session editing, archive, delete, rescheduling, invoices, invoice emails, payment status, packages, and availability.
   - Replace scattered role checks with `requirePermission` while preserving existing admin behavior.
   - Add a denial matrix proving editors cannot call any admin-only function directly.

9. **Regression and quality pass**
   - Run the focused tests after every slice, then the full relevant test suite once all slices pass.
   - Confirm editor privacy from actual query payloads, not only hidden UI.
   - Confirm admin behavior remains unchanged and signed-out users remain blocked.
   - Run formatting, linting, type checking, and the relevant tests. Do not run a production build or Convex code generation.

## Recommended decisions for vague points

- **Which statuses count as confirmed:** show `confirmed` and `email_failed`. `email_failed` represents a completed booking whose confirmation email failed, not an abandoned booking.
- **When deliverables actions are available:** retain the current rule: only past, confirmed sessions can have deliverables status changed or email sent. This prevents accidental delivery against a future session.
- **Meaning of “contact”:** hide email, phone, and Instagram handle, but keep the customer's name and account/business name so editors can identify the client.
- **Package sessions:** show them as ordinary sessions without package labels, invoice numbers, package progress, or clickable package filters.
- **Client notes:** keep booking notes visible because editors need the client's production instructions. If customers may enter sensitive contact or billing data there, add a separate editor-facing production-notes field before rollout.
- **Role source:** keep Clerk public metadata only for identifying admins (`role: "admin"`). Every other authenticated user requires an active Convex editor profile. Clerk sign-up remains invite-only.
- **Assignment cardinality:** assign one editor per session initially. This keeps the schema, query, policy, and admin UI simple.
- **Deactivated editors:** retain assignments for audit history, block access immediately, and require admins to reassign sessions manually.
- **Existing data:** the new booking assignment field is optional, so existing sessions remain unassigned. No backfill is recommended unless existing live sessions must appear in an editor dashboard; confirm that need before implementation.
- **Security model:** use granular `action:resource` permissions derived from the role rather than scattered `isAdmin` checks. Backend authorization and response shaping remain authoritative; `hasPermission` only controls the UI.

## Acceptance criteria

- An editor can sign in and sees only the sessions dashboard.
- An editor receives only confirmed, non-archived sessions and no restricted fields over the network.
- Editor session results include account/business name and client notes.
- An editor receives only sessions assigned to their own stable Clerk identity.
- An editor can change deliverables status and send the deliverables email for eligible sessions.
- An editor cannot invoke any other sensitive or destructive operation, even by calling the Convex API directly.
- Existing admin behaviour remains unchanged.
- Deactivating an editor blocks access without deleting or rewriting historical assignments.
