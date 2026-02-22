# Firebase Data Connect Auth Expressions

This file documents all auth expressions used in queries and mutations. Use these exact strings to ensure consistency and avoid typing errors.

## File Organization

- **`queries.gql`** - All queries (user-facing and admin)
- **`user-mutations.gql`** - User profile mutations (require user authentication)
- **`access-control-mutations.gql`** - Section and access group mutations (admin only)
- **`admin-mutations.gql`** - SDK-only mutations (NO_ACCESS, used by Firebase Functions/CLI)
- **`mutations.gql`** - Legacy file (deprecated, kept for backward compatibility)

## Auth Expression Constants

### Basic User Access (Any Authenticated User)
**Expression:** `@auth(level: USER)`

**Usage:** Any authenticated user can access these operations. Used for initial profile creation before the `enabled` claim is set.

**Used in:**
- `CheckUserProfileExists` query
- `CreateUserProfile` mutation

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
- `CreateEvent` mutation
- `UpdateEvent` mutation
- `DeleteEvent` mutation
- `CreateTicketType` mutation
- `UpdateTicketType` mutation
- `DeleteTicketType` mutation

### System Access (No Auth Required)
**Expression:** `@auth(level: NO_ACCESS)`

**Usage:** Operations used by Firebase Functions with service account credentials. No user authentication required.

**Used in:**
- `GetUserMembershipStatus` query (queries.gql)
- `UpdateUserMembershipStatus` mutation (admin-mutations.gql)
- `DeleteUser` mutation (admin-mutations.gql)
- `CreateUser` mutation (admin-mutations.gql)

## Notes

- All users (including admins) must have `enabled == true` to access any user-facing operations
- Admins must have both `admin == true` AND `enabled == true` to access admin operations
- When copying expressions, ensure exact string matching including quotes and spacing

