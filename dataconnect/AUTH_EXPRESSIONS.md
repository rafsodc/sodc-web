# Data Connect authorization boundaries

Auth claims are restrictive compatibility mirrors. They never grant authority by
themselves. Every enabled client operation also reads redacted server-owned
`UserSecurityState`, requires READY access, profile/status consistency and eligible
membership, and compares the exact current security version to the session claim.
Protected client mutations perform these checks before writing in `@transaction`.

- Onboarding: verified-email own-profile operations only.
- Current member: enabled claim plus current authority; resource/ownership checks
  apply in the operation or its callable.
- Current section moderator: the member boundary plus either current adminReady
  and an admin claim, or an explicit/status-derived MODERATOR group relationship
  to the section owned by the event/ticket being read or changed.
- Current global administrator: enabled/admin claims and current adminReady.
  Section configuration, global groups and assignments, users and global payment
  reconciliation retain this boundary.
- Service-only: `@auth(level: NO_ACCESS)` rejects all client identities. Trusted
  callables must await their current-authority and resource checks. Both booking
  decision transactions additionally check the caller-supplied server-verified
  actor identity/version and current section relationship at the database write.

Section event/ticket mutations cannot move an existing event or ticket to another
section: UpdateEvent has no sectionId parameter, and UpdateTicketType has no
eventId parameter. Ticket access groups must already be linked to the section or
used by an existing ticket type in it. Group assignment is still global admin.

`ListSectionTicketAccessGroups` exposes bounded id/name options only.
`GetSectionMembers` remains service-only. The directory and
`getSectionMemberNamesByIds` callable preserve the existing MEMBER/event fallback
population, Auth verification and contact-privacy rules; admin access does not
add an administrator to the roster.

The complete reviewed boundary inventory is
[authorization-operations.json](../docs/security/authorization-operations.json).
Run `node scripts/check-authorization-inventory.mjs` to verify drift and required
current-authority, scope and transaction markers. The isolated section SQL suite
exercises actual operation authorization and rollback without signed JWTs or
cloud deployment.
