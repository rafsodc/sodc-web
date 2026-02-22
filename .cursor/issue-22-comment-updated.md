## Implementation Approach (updated)

### High-level strategy

Treat status-based access group membership as **inherited**: users whose membership status matches a group's `membershipStatuses` are considered members for display only, with no rows in `UserAccessGroup`. A **section-scoped callable** returns merged members (explicit + inherited) **only if the caller has permission to view that section**; no generic "list users by status" API is exposed. For the **admin access group panel**, show users **by each membership status** (not a merged list), with a **clickable** list (e.g. user rows open user detail or actions). No changes to `membershipStatus.ts` that add users to status-based groups.

### Step-by-step implementation plan

1. **Section-scoped callable: `getSectionMembersMerged`**
   - New Firebase Callable (e.g. `functions/src/sections.ts`): input `{ sectionId: string }`, auth required.
   - **Permission**: Caller may only get merged members if they can view the section (getSectionById + getUserAccessGroupsById; intersection of caller's groups with section's VIEW groups must be non-empty; else throw permission-denied).
   - **Merge**: getSectionMembers(sectionId) for explicit members and each group's membershipStatuses; collect distinct statuses; listUsers() and filter by those statuses; merge explicit first, then inherited, dedupe by user id.
   - **Return**: `{ members: Array<{ id, firstName, lastName, email, membershipStatus }> }`. Export from functions index.

2. **Section member list (frontend)**
   - In `src/features/sections/components/SectionDetail.tsx`: Replace useGetSectionMembers + getAllUsersFromSection with httpsCallable(getSectionMembersMerged)({ sectionId }); use returned `members` as `allMembers`. Keep useGetSectionById. Handle loading and permission-denied.

3. **Admin access group view**
   - **Not a merged list**: Show users grouped or filterable **by each membership status** (e.g. LOST, REGULAR). No single combined "explicit + inherited" list.
   - **Clickable**: List is interactive—e.g. each user row (or status section) is clickable (open user detail, or action). Follow existing admin patterns (e.g. row click → user profile/edit).
   - **Data**: Use existing ListUsers (admin-only); group or filter users client-side by `membershipStatus`. No new callable.
   - In `src/features/admin/components/AccessGroups.tsx`: For groups with membershipStatuses, show users per status (tabs/sections or filter), with clickable user rows (or status headers).

4. **Backend (membershipStatus.ts)**
   - No change to add users to status-based groups when status is restricted (e.g. LOST). Optional: comment that status-based membership is inherited (computed in getSectionMembersMerged), not written to UserAccessGroup.

5. **Docs and tests**
   - Update `docs/access-groups-architecture.md`: explicit vs inherited; section-scoped callable; admin sees users by status, clickable.
   - Tests: callable permission when no view access; merged list when permitted; SectionDetail uses merged list (mock callable).

### Files/components to be modified

- **functions** (e.g. `functions/src/sections.ts`): New callable `getSectionMembersMerged(sectionId)`; export in index.
- `src/features/sections/components/SectionDetail.tsx`: Replace GetSectionMembers + getAllUsersFromSection with callable; use returned members as allMembers.
- `src/features/admin/components/AccessGroups.tsx`: For groups with membershipStatuses, show users **by membership status** (ListUsers + client-side group/filter); make list **clickable** (e.g. user row → user detail or action). No new callable.
- `functions/src/membershipStatus.ts`: Optional comment that status-based is inherited.
- `docs/access-groups-architecture.md`: Document section-scoped backend, inherited membership, and admin by-status clickable list.
- **Tests**: Callable permission + merge; SectionDetail merged list.

### Technical considerations

- **Permission**: Section view = caller's access group IDs ∩ section's viewing access group IDs ≠ ∅.
- **Deduplication**: Backend merges explicit first, then inherited (by status) not already in set.
- **Admin**: List users by membership status (grouped/filterable), clickable; no merged list and no new callable.
- **No client "list users by status"**: Only the section-scoped callable returns merged section members; admin uses ListUsers and groups/filters by status client-side.

### Dependencies / constraints

- Existing Admin SDK: getSectionById, getSectionMembers, getUserAccessGroupsById, listUsers. No Data Connect schema or new client queries for section member list.
