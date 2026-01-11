# Firebase Data Connect Auth Expressions

This file documents all auth expressions used in queries and mutations. Use these exact strings to ensure consistency and avoid typing errors.

## File Organization

- **`queries.gql`** - All queries (user-facing and admin)
- **`mutations.gql`** - User-facing mutations (require user authentication)
- **`admin-mutations.gql`** - SDK-only mutations (NO_ACCESS, used by Firebase Functions/CLI)

## Auth Expression Constants

### User Access (Enabled Required)
**Expression:** `"auth.token.enabled == true"`

**Usage:** All authenticated users (including admins) must have the `enabled` claim set to `true` to access these operations.

**Used in:**
- `GetCurrentUser` query
- `GetSectionsForUser` query
- `GetUserAccessGroups` query
- `UpsertUser` mutation

### Admin Access (Admin + Enabled Required)
**Expression:** `"auth.token.admin == true && auth.token.enabled == true"`

**Usage:** Admin-only operations. Admins must have both `admin == true` AND `enabled == true` to access these operations.

**Used in:**
- `GetUserById` query
- `ListUsers` query
- `ListSections` query
- `ListAccessGroups` query
- `UpdateUser` mutation
- `CreateSection` mutation
- `CreateAccessGroup` mutation
- `AddUserToAccessGroup` mutation
- `RemoveUserFromAccessGroup` mutation
- `GrantAccessGroupToSection` mutation
- `RevokeAccessGroupFromSection` mutation

### System Access (No Auth Required)
**Expression:** `@auth(level: NO_ACCESS)`

**Usage:** Operations used by Firebase Functions with service account credentials. No user authentication required.

**Used in:**
- `GetUserMembershipStatus` query (queries.gql)
- `UpdateUserMembershipStatus` mutation (admin-mutations.gql)
- `DeleteUser` mutation (admin-mutations.gql)
- `CreateOrUpdateUser` mutation (admin-mutations.gql)

## Notes

- All users (including admins) must have `enabled == true` to access any user-facing operations
- Admins must have both `admin == true` AND `enabled == true` to access admin operations
- When copying expressions, ensure exact string matching including quotes and spacing

