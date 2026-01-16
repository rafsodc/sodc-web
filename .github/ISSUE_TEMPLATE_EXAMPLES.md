# Issue Template Examples

This file contains examples for filling out issue templates. These examples are provided as reference to help you understand what kind of information to include in each section.

## Bug Report Examples

### Description Example

> When clicking the "Save" button on the profile page, the form data is not being saved and no error message is displayed. The page appears to do nothing when the button is clicked.

### Steps to Reproduce Example

1. Log in as a user with MEMBER status
2. Navigate to Profile page
3. Change email address field
4. Click "Save" button
5. Observe that no save confirmation appears and changes are not persisted

### Expected Behavior Example

> After clicking "Save", I expected to see a success message and the email address should be updated in my profile.

### Actual Behavior Example

> The button appears to be clicked (visual feedback), but no network request is made, no success/error message appears, and the email address remains unchanged after page refresh.

### Environment Example

- **Browser**: Chrome 120, Firefox 121, Safari 17
- **OS**: macOS 14.2, Windows 11, Linux
- **User Role**: Admin, Member, Pending
- **Access Groups**: Status-based only, Manual groups, Multiple groups
- **Environment**: Production, Staging, Local/Dev

### Screenshots/Logs Example

```
Error in console:
Uncaught TypeError: Cannot read property 'save' of undefined
    at ProfileForm.saveProfile (Profile.tsx:45)
```

### Acceptance Criteria Example

- [ ] Save button successfully saves profile changes
- [ ] Success message appears after save
- [ ] Changes persist after page refresh
- [ ] Appropriate error message shown if save fails
- [ ] Works for users with different access group configurations

### Technical Considerations Example

> - Issue appears to be in the `saveProfile` mutation call
> - May be related to DataConnect auth expressions
> - Need to verify user has UPDATE permission for profile
> - Check if mutation is being called with correct parameters

### Testing Notes Example

**Security Tests (Must Pass):**
- [ ] Verify fix doesn't introduce security vulnerabilities
- [ ] Verify proper authorization checks are in place
- [ ] Verify no data leakage or unauthorized access

**Functionality Tests:**
- [ ] Bug is fixed in the reported scenario
- [ ] Related functionality still works correctly
- [ ] Edge cases are handled appropriately
- [ ] Works across different user roles and access groups

### Related Issues Example

> Related to #42 (Profile page improvements)
> Possibly related to #38 (DataConnect mutation issues)

---

## Feature Request Examples

### Description Example

> Add ability for users to filter sections by access group membership. Users should be able to see only sections they have access to, with an optional toggle to show all sections. This will help users navigate the sections list more efficiently, especially as the number of sections grows.

### Context Example

> Currently, users see all sections in the sections list, including ones they don't have access to. This creates confusion and makes it harder to find relevant sections. As we add more event-specific sections, the list will become cluttered. Users have requested a way to filter to only see sections they can actually access. This aligns with our goal of improving user experience and reducing cognitive load.

### Acceptance Criteria Example

- [ ] Add a filter toggle button to the sections list page (e.g., "Show only my sections")
- [ ] When filter is enabled, only display sections where user has VIEW access via their access groups
- [ ] Filter state persists across page navigation (use localStorage or query params)
- [ ] Filter toggle is visible and accessible to all enabled users
- [ ] Filter respects existing section access control (no security bypass)
- [ ] Empty state message shown when filter results in no sections
- [ ] Filter works correctly with both status-based and manual access groups

### Technical Considerations Example

> - No schema changes required - we can use existing `GetSectionsForUser` query which already filters by access groups
> - Need to modify `SectionsList` component to add filter UI and state management
> - Should leverage existing `useGetSectionsForUser` hook from `src/features/sections/`
> - Consider using React Query's caching to avoid unnecessary refetches when toggling filter
> - Filter state should be stored in URL query params (e.g., `?filter=mine`) for shareability
> - Must ensure filter doesn't bypass any existing auth expressions in DataConnect queries
> - Test with users who have multiple access groups (status-based + manual)

### Testing Notes Example

**Security Tests (Must Pass):**
- [ ] Verify users cannot see sections they don't have access to, even if filter is disabled
- [ ] Verify filter doesn't expose any section data through API calls
- [ ] Verify filter respects DataConnect auth expressions (`auth.token.enabled == true`)
- [ ] Test with users who have restricted membership status (PENDING, RESIGNED) - should see no sections

**Functionality Tests:**
- [ ] Filter toggle shows/hides sections correctly
- [ ] Filter state persists when navigating away and back
- [ ] Filter works with users who have multiple access groups
- [ ] Filter works with users who have only status-based access groups
- [ ] Filter works with users who have only manual access groups
- [ ] Empty state displays correctly when filter results in no sections
- [ ] Filter can be toggled on/off multiple times without issues
- [ ] URL query param updates correctly when filter is toggled
- [ ] Page loads with filter enabled if query param is present

### Related Issues Example

> Related to #12 (Improve sections navigation UX)
