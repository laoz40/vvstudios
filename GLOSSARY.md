# VV Studios

VV Studios sells recording sessions and packages. Studio staff manage scheduling, payments, editing, and delivery in the dashboard.

## Language

### Sessions and packages

**Session**:
A studio recording appointment at a specific date and time. A customer can buy it on its own or schedule it through a package.
_Avoid_: Booking when referring to the appointment

**Booking**:
The database term for the record that represents a session and tracks its status. The record can exist while checkout is still pending or after it has been abandoned.

**Package**:
The purchase of a fixed number of session slots. Customers pay for the package before choosing a date and time for each session.
_Avoid_: Multi-booking (former name)

**Package session**:
A session that uses one slot from a package. Cancelling it before it takes place frees that slot for another session under the same package.

**Package capacity**:
The total number of slots a package covers. A confirmed session uses one slot even if its confirmation email fails.

**Recording space**:
The studio setup selected for the session, such as Table Setup, Armchair Setup, or Music Setup.

**Add-on**:
An optional extra for a recording session, such as a teleprompter, editing, or Remote Podcast.

**Dashboard add-on labels**:
Short display names that save space in the dashboard. Use the add-on name when discussing what the customer selected.

| Dashboard label | Add-on name |
| --- | --- |
| Remote | Remote Podcast |
| 4K | 4K UHD Recording |
| Tele | Teleprompter |
| Rough Cut | Essential Edit |
| Full Edit | Complete Edit |
| Vol Clips | Clip Volume Pack |
| HC Clips | Handcrafted Clips |

**Rough Cut**:
The customer-facing name for the editing add-on known internally as **Essential Edit**.

### Scheduling

**Availability**:
The times a customer can choose for a session. Studio hours, advance notice, buffers, and existing commitments all affect availability.

**Slot reservation**:
A temporary hold on a specific studio time while a session is being confirmed or rescheduled.

**Package scheduling link**:
The private link a customer uses to schedule and manage the sessions in a paid package.

**Reschedule link**:
The private link a customer uses to change the date and time of an existing session.

### Billing

**Account name**:
The name the customer supplies for billing. It can differ from the contact person's name.

**Receipt**:
A record of payment sent to the customer after they pay upfront for a session or package.

**Legacy invoice**:
A payment request from the old pay-later process. Staff can download the original invoice and any saved legacy custom invoices for those older bookings.
_Avoid_: Invoice or custom invoice without the legacy context

**Stripe invoice**:
A payment request that Stripe sends to the customer for a charge after checkout. An **edit invoice**, sometimes called a **Stripe custom invoice**, covers the extra cost of a change to an already-paid session or package, such as adding an add-on or extending a session.

**Package adjustment**:
The final calculation of charges for Remote Podcast use across completed package sessions. A charge creates a **package adjustment invoice**.

### Studio operations

**Inbox**:
The dashboard view of unarchived sessions or packages that staff can work through.

**Archived**:
A session or package removed from the Inbox and retained in the corresponding All view.

**Editor assignment**:
Assigning one editor to a session's post-production, including all of its edits.

**Edit status**:
The stage of post-production for a session or an individual edit. The session's overall edit status shows whether work has started, is still underway, or is complete.

**Edit**:
The post-production work for one purchased item of an editing add-on. For example, when a client buys Complete Edit for two episodes in one session, each episode has its own edit status and delivery.

**Legacy edit**:
An edit for a session that already had an editor and unfinished editing work when per-edit delivery rolled out. The editor sends it to the studio for review, an admin delivers it to the client, and the client receives no revision allowance.

**Studio review**:
The stage after an editor hands off an edit for studio approval and before an admin sends it to the client.

**Client review**:
The status of a delivered edit while the client's revision window is open and no revision requests are outstanding.

**Raw media**:
The original recordings from a session that editors use as source material.

**Deliverables**:
The finished files the studio sends to the customer, such as edited recordings or clips.

**Client assets**:
Materials a client supplies for editing and can reuse across sessions, such as brand assets.

**Session Drive folders**:
The Drive folders for a session's raw media and deliverables.
_Avoid_: Session workspace
