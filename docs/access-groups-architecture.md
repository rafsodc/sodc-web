# Access Groups Architecture

## Core Principle

- **Access Groups** = Control section/space visibility (what you can see/access)
- **Membership Status** = Control eligibility and actions (what you can do: ticket types, registration eligibility, filtering)

## Access Group Types

### Status-Based Access Groups (Auto-Assigned)

- Automatically assigned based on membership status
- Prefixed with "Status:" to indicate they are linked to membership status
- Examples: "Status:Regular", "Status:Reserve", "Status:Civil Service", "Status:Industry", "Status:Retired"
- Each non-restricted member gets exactly one status-based access group
- Restricted statuses (PENDING, RESIGNED, LOST, DECEASED) have NO access groups

### Manual Access Groups

- Manually assigned by admins
- Examples: "Committee Members", "Event: Annual Dinner 2024", "Event Organizers"
- Can be assigned to any non-restricted member regardless of status

## Section Model

Sections have:
- `isOpenForRegistration: Boolean` - Whether users can register for this section
- `allowedAccessGroups: [UUID]` - Which access groups are eligible to register (can include both status-based and manual groups)
- Access to section is controlled via `SectionAccessGroup` junction table (links section to access groups)

## Default Sections

- **Members space** (type: MEMBERS) - Accessible to all status-based access groups (Status:Regular, Status:Reserve, etc.)
- **Committee space** (type: MEMBERS) - Accessible to all status-based access groups (or separate "Committee" group if needed)
- **Events page** (type: EVENTS) - Accessible to all status-based access groups

Default sections are linked to all status-based access groups via `SectionAccessGroup` junction table.

## Event Registration Flow

Example: "Annual Dinner 2024" event section

1. Section has `isOpenForRegistration: true`
2. Section has `allowedAccessGroups: ["Status:Regular", "Status:Reserve"]` (status-based groups)
3. Section is linked to "Event: Annual Dinner 2024" access group via `SectionAccessGroup`
4. User with REGULAR status is in "Status:Regular" group → eligible to register
5. User clicks "Register" → automatically added to "Event: Annual Dinner 2024" access group
6. User can now access the section (via the event-specific access group)
7. User can unregister themselves (removed from event access group)

## Status Transitions

- **Restricted → Non-restricted**: Add to appropriate status-based access group (e.g., REGULAR → "Status:Regular")
- **Non-restricted → Restricted**: Remove from ALL access groups
- **Non-restricted → Non-restricted**: Remove from previous status-based group, add to new status-based group, preserve manual groups

## Admin Capabilities

- Admins can manually add/remove users from any access groups
- Admins can override registration eligibility (manually add users to event access groups even if they don't meet status requirements)
- Users cannot modify their own access groups (except unregistering from events they've registered for)

## Implementation Notes

### Access Group Assignment

- **Status-based groups**: Automatically created and assigned when membership status is set to non-restricted status
  - Prefixed with "Status:" to indicate they are linked to membership status
  - Each non-restricted member gets exactly one status-based access group
- **Manual groups**: Assigned by admins via UI

### Registration Eligibility

- Check if user is in any of the `allowedAccessGroups` for the section
- If eligible and `isOpenForRegistration: true`, show registration option
- Registration adds user to the event-specific access group

### Access Control

- User can access section if they are in any access group linked to the section via `SectionAccessGroup`
- Multiple access groups can grant access to the same section
- Access groups can be used for both eligibility (via `allowedAccessGroups`) and access (via `SectionAccessGroup`)
