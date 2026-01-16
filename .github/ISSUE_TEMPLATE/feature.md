---
name: Feature Request
about: Template for new features and enhancements
title: '[FEATURE] '
labels: ''
assignees: ''
---

## Description

**What needs to be implemented?**

Provide a clear, concise description of the feature or enhancement. Be specific about what the feature should do and who will use it.

**Example:**
> Add ability for users to filter sections by access group membership. Users should be able to see only sections they have access to, with an optional toggle to show all sections. This will help users navigate the sections list more efficiently, especially as the number of sections grows.

---

## Context

**Why is this needed? What problem does it solve?**

Explain the background, motivation, or use case that led to this request. Include any relevant user stories or scenarios.

**Example:**
> Currently, users see all sections in the sections list, including ones they don't have access to. This creates confusion and makes it harder to find relevant sections. As we add more event-specific sections, the list will become cluttered. Users have requested a way to filter to only see sections they can actually access. This aligns with our goal of improving user experience and reducing cognitive load.

---

## Acceptance Criteria

**What conditions must be met for this to be considered complete?**

List specific, testable criteria. Each criterion should map to a logical unit of work that can be implemented and tested independently. Use checkboxes to track progress.

**Example:**
- [ ] Add a filter toggle button to the sections list page (e.g., "Show only my sections")
- [ ] When filter is enabled, only display sections where user has VIEW access via their access groups
- [ ] Filter state persists across page navigation (use localStorage or query params)
- [ ] Filter toggle is visible and accessible to all enabled users
- [ ] Filter respects existing section access control (no security bypass)
- [ ] Empty state message shown when filter results in no sections
- [ ] Filter works correctly with both status-based and manual access groups

---

## Technical Considerations

**Any constraints, dependencies, or technical notes?**

Include information about:
- Database/schema changes needed
- API/GraphQL query modifications
- Authentication/authorization requirements
- Performance considerations
- Integration points with existing features
- Breaking changes

**Example:**
> - No schema changes required - we can use existing `GetSectionsForUser` query which already filters by access groups
> - Need to modify `SectionsList` component to add filter UI and state management
> - Should leverage existing `useGetSectionsForUser` hook from `src/features/sections/`
> - Consider using React Query's caching to avoid unnecessary refetches when toggling filter
> - Filter state should be stored in URL query params (e.g., `?filter=mine`) for shareability
> - Must ensure filter doesn't bypass any existing auth expressions in DataConnect queries
> - Test with users who have multiple access groups (status-based + manual)

---

## Testing Notes

**What should be tested? Any special test scenarios?**

Describe test cases, edge cases, and any specific testing requirements. Consider both Security and Functionality test categories.

**Example:**

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

---

## Implementation Plan

**To be filled in during planning phase**

This section will be populated after discussion with Cursor/AI to develop the implementation strategy. The plan should include:
- High-level approach
- File/component changes needed
- Step-by-step implementation order
- Any architectural decisions

---

## Related Issues

Link to any related issues, PRs, or discussions.

**Example:**
> Related to #12 (Improve sections navigation UX)