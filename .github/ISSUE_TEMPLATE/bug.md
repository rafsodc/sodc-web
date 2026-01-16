---
name: Bug Report
about: Template for reporting bugs and issues
title: '[BUG] '
labels: ''
assignees: ''
---

## Description

**What is the bug?**

Provide a clear, concise description of the bug. What happened vs. what you expected to happen?

**Example:**
> When clicking the "Save" button on the profile page, the form data is not being saved and no error message is displayed. The page appears to do nothing when the button is clicked.

---

## Steps to Reproduce

**How can we reproduce this bug?**

List the steps that lead to the bug:

1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

**Example:**
1. Log in as a user with MEMBER status
2. Navigate to Profile page
3. Change email address field
4. Click "Save" button
5. Observe that no save confirmation appears and changes are not persisted

---

## Expected Behavior

**What should happen instead?**

Describe what you expected to happen.

**Example:**
> After clicking "Save", I expected to see a success message and the email address should be updated in my profile.

---

## Actual Behavior

**What actually happens?**

Describe what actually happens when you follow the steps.

**Example:**
> The button appears to be clicked (visual feedback), but no network request is made, no success/error message appears, and the email address remains unchanged after page refresh.

---

## Environment

**Where and how did this occur?**

- **Browser**: [e.g., Chrome 120, Firefox 121, Safari 17]
- **OS**: [e.g., macOS 14.2, Windows 11, Linux]
- **User Role**: [e.g., Admin, Member, Pending]
- **Access Groups**: [e.g., Status-based only, Manual groups, Multiple groups]
- **Environment**: [e.g., Production, Staging, Local/Dev]

---

## Screenshots/Logs

**Visual evidence or error messages**

If applicable, add screenshots or error logs to help explain the problem.

**Example:**
```
Error in console:
Uncaught TypeError: Cannot read property 'save' of undefined
    at ProfileForm.saveProfile (Profile.tsx:45)
```

---

## Technical Details

**Any relevant technical information?**

- Network requests (if applicable)
- Console errors
- DataConnect query/response issues
- Authentication/authorization problems
- Related to specific access groups or permissions

---

## Acceptance Criteria

**What conditions must be met for this to be considered fixed?**

List specific, testable criteria for the fix:

- [ ] Bug is fixed - [specific behavior that should work]
- [ ] No regression - [related functionality still works]
- [ ] Error handling - [appropriate error messages if applicable]
- [ ] Edge cases handled - [specific edge cases to test]

**Example:**
- [ ] Save button successfully saves profile changes
- [ ] Success message appears after save
- [ ] Changes persist after page refresh
- [ ] Appropriate error message shown if save fails
- [ ] Works for users with different access group configurations

---

## Technical Considerations

**Any constraints, dependencies, or technical notes?**

Include information about:
- Database/schema implications
- API/GraphQL query issues
- Authentication/authorization concerns
- Performance considerations
- Integration points affected

**Example:**
> - Issue appears to be in the `saveProfile` mutation call
> - May be related to DataConnect auth expressions
> - Need to verify user has UPDATE permission for profile
> - Check if mutation is being called with correct parameters

---

## Testing Notes

**What should be tested? Any special test scenarios?**

Describe test cases, edge cases, and any specific testing requirements.

**Security Tests (Must Pass):**
- [ ] Verify fix doesn't introduce security vulnerabilities
- [ ] Verify proper authorization checks are in place
- [ ] Verify no data leakage or unauthorized access

**Functionality Tests:**
- [ ] Bug is fixed in the reported scenario
- [ ] Related functionality still works correctly
- [ ] Edge cases are handled appropriately
- [ ] Works across different user roles and access groups

---

## Implementation Plan

**To be filled in during planning phase**

This section will be populated after discussion with Cursor/AI to develop the fix strategy. The plan should include:
- Root cause analysis
- High-level approach to fix
- File/component changes needed
- Step-by-step implementation order
- Any architectural decisions

---

## Related Issues

Link to any related issues, PRs, or discussions.

**Example:**
> Related to #42 (Profile page improvements)
> Possibly related to #38 (DataConnect mutation issues)
