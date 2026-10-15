# Admin Guide

This guide covers the administrative functions available to SODC administrators.

Admin functions are accessible from the **Admin** menu, which is only visible to users with the admin role.

---

## Approving new members

When a member submits their profile, they enter the approval queue.

1. Go to **Admin → Manage Users**
2. New registrations appear with a pending status
3. Review the member's name, service number, and service background
4. Click **Approve** to activate their account, or **Reject** to decline

Once approved, the member's account is activated and they can access sections and book events. Their membership status (Regular, Reserve, Civil Servant, Industry) is set during approval.

---

## Managing users

**Admin → Manage Users** lists all registered members. From here you can:

- View a member's profile and membership status
- Grant or revoke admin rights
- Deactivate an account if needed

---

## Managing sections

**Admin → Manage Sections** lets you create and configure sections.

Each section has:
- **Name and description**
- **Members** — add or remove members; member access is controlled by user groups
- **Events** — create and manage events for the section

### Adding members to a section

Sections use user groups to control access. To add a member:
1. Open the section
2. Go to the **Members** tab
3. Add the member to the appropriate user group

---

## Managing events

Within a section, go to the **Events** tab and click **Add Event** to create a new event.

Each event has:
- **Name**
- **Start and end date/time**
- **Ticket types** — define ticket options, prices, and quantities

### Editing an event

Click on an event to open it. You can edit the event details, manage ticket types, and view bookings.

> **Note:** Date and time are entered in your local time zone and stored correctly — you do not need to adjust for BST/UTC.

---

## Managing bookings

Within an event, the **Bookings** tab shows all bookings for that event. You can:

- View booking details including dietary requirements and seating preferences
- See the status of each booking (confirmed, pending, cancelled)

---

## Announcements to event attendees

In an event's attendee table, choose **Send announcement to attendees**. Any active table filters carry into the composer; adjust them or choose **Clear audience filters** to include all current attendees. Unpaid bookings are included unless you choose a payment filter. Pending approvals, cancelled tickets and removed attendees are excluded.

Choose **Preview recipients** to review the matching ticket count, unique email contacts and skipped contacts. Filters apply together to each ticket before contacts are deduplicated. Linked guests use their own email; accompanying guests without one use the booking contact where available. Organiser guests use their recorded email. Event attendee messages do not use announcement opt-outs or unsubscribe links. Section-wide announcements still respect existing preferences. Choose a template without an unsubscribe link.

Select a template, review its preview and delivery mode, then use **Send to … attendee contacts**. If attendance changes before sending, preview the audience again. Send history records the event and filters; resuming a send uses its original recipients. Section-wide announcements remain available separately.

## Booking approvals

When a booking exceeds an event's automatic guest limit, the whole booking requires moderator approval.

Pending revisions appear in the event's bookings view. Review the complete attendee list and choose **Approve** or **Request changes**. The member will receive an email notification of the decision, and payment becomes available only after approval.

---

## User groups

**Admin → Manage User Groups** lets you create and manage user groups. User groups are used to control which members have access to which sections.

Each user group has a **purpose**:
- **Access** — controls section membership (members in this group can see and join the section)
- **Other purposes** — used for communication and organisation

Members can only self-subscribe to user groups marked as **subscribable**. Access-purpose groups must be managed by an administrator.
