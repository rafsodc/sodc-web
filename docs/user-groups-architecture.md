# User Groups Architecture

## Core Principle

- **User Groups** = Control section/space visibility (what you can see/access)
- **Membership Status** = Control eligibility and actions (what you can do: ticket types, registration eligibility, filtering)

## User Group Types

### Status-Based User Groups (Auto-Assigned)

- Automatically assigned based on membership status
- Prefixed with "Status:" to indicate they are linked to membership status
- Examples: "Status:Regular", "Status:Reserve", "Status:Civil Service", "Status:Industry", "Status:Retired"
- Each non-restricted member gets exactly one status-based user group
- Restricted statuses (PENDING, RESIGNED, LOST, DECEASED) have NO user groups

### Manual User Groups

- Manually assigned by admins
- Examples: "Committee Members", "Event: Annual Dinner 2024", "Event Organizers"
- Can be assigned to any non-restricted member regardless of status

## Section Model

Sections have:
- `isOpenForRegistration: Boolean` - Whether users can register for this section
- `allowedUserGroups: [UUID]` - Which user groups are eligible to register (can include both status-based and manual groups)
- Access to section is controlled via `SectionAccessGroup` junction table (links section to user groups)

## Default Sections

- **Members space** (type: MEMBERS) - Accessible to all status-based user groups (Status:Regular, Status:Reserve, etc.)
- **Committee space** (type: MEMBERS) - Accessible to all status-based user groups (or separate "Committee" group if needed)
- **Events page** (type: EVENTS) - Accessible to all status-based user groups

Default sections are linked to all status-based user groups via `SectionAccessGroup` junction table.

## Event Registration Flow

Example: "Annual Dinner 2024" event section

1. Section has `isOpenForRegistration: true`
2. Section has `allowedUserGroups: ["Status:Regular", "Status:Reserve"]` (status-based groups)
3. Section is linked to "Event: Annual Dinner 2024" user group via `SectionAccessGroup`
4. User with REGULAR status is in "Status:Regular" group → eligible to register
5. User clicks "Register" → automatically added to "Event: Annual Dinner 2024" user group
6. User can now access the section (via the event-specific user group)
7. User can unregister themselves (removed from event user group)

## Status Transitions

- **Restricted → Non-restricted**: Add to appropriate status-based user group (e.g., REGULAR → "Status:Regular")
- **Non-restricted → Restricted**: Remove from ALL user groups
- **Non-restricted → Non-restricted**: Remove from previous status-based group, add to new status-based group, preserve manual groups

## Admin Capabilities

- Admins can manually add/remove users from any user groups
- Admins can override registration eligibility (manually add users to event user groups even if they don't meet status requirements)
- Users cannot modify their own user groups (except unregistering from events they've registered for)

## Implementation Notes

### Explicit vs inherited membership

- **Explicit membership**: Stored in `UserUserGroup` (user is directly linked to a user group). Shown in section member lists and admin group details; can be removed by admins when not status-based.
- **Inherited membership**: When a user group has `membershipStatuses` (e.g. LOST), every user with that status is considered a member for display purposes only—no row in `UserUserGroup`. Section member list is computed by the **section-scoped callable** `getSectionMembersMerged(sectionId)`, which returns merged members (explicit + inherited) only if the caller has permission to view that section. Admin can see users by membership status in a separate clickable list (ListUsers grouped by status).

### User Group Assignment

- **Status-based groups**: Automatically created and assigned when membership status is set to non-restricted status
  - Prefixed with "Status:" to indicate they are linked to membership status
  - Each non-restricted member gets exactly one status-based user group
- **Manual groups**: Assigned by admins via UI

### Registration Eligibility

- Check if user is in any of the `allowedUserGroups` for the section
- If eligible and `isOpenForRegistration: true`, show registration option
- Registration adds user to the event-specific user group

### Access Control

- User can access section if they are in any user group linked to the section via `SectionAccessGroup`
- Multiple user groups can grant access to the same section
- User groups can be used for both eligibility (via `allowedUserGroups`) and access (via `SectionAccessGroup`)
