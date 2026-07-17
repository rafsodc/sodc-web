# DataConnect Directory Structure

This directory contains all Firebase DataConnect configuration, schema, queries, and mutations for the SODC (Signal Officers' Dinner Club) application.

## Directory Structure

```
dataconnect/
├── api/                          # GraphQL operations (queries and mutations)
│   ├── connector.yaml            # DataConnect connector configuration
│   ├── queries.gql               # User-facing and admin queries
│   ├── user-mutations.gql         # User profile mutations
│   ├── user-group-mutations.gql       # Section and user group mutations
│   ├── admin-mutations.gql        # SDK-only mutations (NO_ACCESS, used by Firebase Functions/CLI)
│   └── mutations.gql             # Legacy file (deprecated)
├── schema/                 # GraphQL schema definitions
│   └── schema.gql          # Type definitions, enums, and table schemas
├── dataconnect.yaml        # Main DataConnect service configuration
├── seed_data.gql           # Seed data for development/testing
├── AUTH_EXPRESSIONS.md     # Documentation of all auth expressions used
└── README.md               # This file
```

## File Descriptions

### Configuration Files

- **`dataconnect.yaml`**: Main service configuration including location, database connection, and schema/connector paths
- **`api/connector.yaml`**: Connector-specific configuration including SDK generation settings

### Schema

- **`schema/schema.gql`**: Defines all GraphQL types, enums, and table structures
  - Enums: `SectionType`, `MembershipStatus`
  - Types: `User`, `Section`, `UserGroup`, `UserUserGroup`, `SectionAccessGroup`
  - Includes audit fields (`createdAt`, `updatedAt`, `createdBy`, `updatedBy`) on all tables

### Operations

- **`api/queries.gql`**: All GraphQL queries
  - User queries: `GetCurrentUser`, `CheckUserProfileExists`
  - Admin queries: `GetUserById`, `ListUsers`, `ListSections`, `ListAccessGroups`
  - System queries: `GetUserMembershipStatus` (SDK-only)
  - Access control queries: `GetSectionsForUser`, `GetUserAccessGroups`

- **`api/user-mutations.gql`**: User profile mutations (accessible from frontend/client SDK)
  - `CreateUserProfile` - Initial profile creation (before enabled claim)
  - `UpsertUser` - Create or update own profile (requires enabled claim)
  - `UpdateUser` - Admin update any user profile

- **`api/user-group-mutations.gql`**: Section and user group mutations (admin only)
  - Section mutations: `CreateSection`
  - User group mutations: `CreateUserGroup`, `AddUserToUserGroup`, `RemoveUserFromUserGroup`
  - Section access mutations: `GrantAccessGroupToSection`, `RevokeAccessGroupFromSection`

- **`api/admin-mutations.gql`**: SDK-only mutations (used by Firebase Functions/CLI)
  - `CreateUser`: Create user profiles from service account (CLI/dev reset)
  - `UpdateUserMembershipStatus`: Update membership status with server-side validation
  - `DeleteUser`: Delete user rows (dev reset operations)

### Documentation

- **`AUTH_EXPRESSIONS.md`**: Complete reference of all auth expressions used across queries and mutations
  - User access: `"auth.token.enabled == true"`
  - Admin access: `"auth.token.admin == true && auth.token.enabled == true"`
  - System access: `@auth(level: NO_ACCESS)`

- **`seed_data.gql`**: Seed data for development/testing environments
  - Currently empty, reserved for future use
  - See file comments for usage guidelines

## Adding New Operations

### Adding a Query

1. Open `api/queries.gql`
2. Add your query with appropriate `@auth()` directive
3. Reference `AUTH_EXPRESSIONS.md` for correct auth expression
4. Update `AUTH_EXPRESSIONS.md` if adding a new auth pattern

### Adding a User-Facing Mutation

1. Determine which feature file to use:
   - User-related: `api/user-mutations.gql`
   - Access control: `api/user-group-mutations.gql`
   - New feature: Create `api/[feature-name]-mutations.gql`
2. Add your mutation with appropriate `@auth()` directive
3. Use `@auth(expr: "auth.token.enabled == true")` for user operations
4. Use `@auth(expr: "auth.token.admin == true && auth.token.enabled == true")` for admin operations
5. Update `AUTH_EXPRESSIONS.md` if adding a new auth pattern

### Adding an SDK-Only Mutation

1. Open `api/admin-mutations.gql`
2. Add your mutation with `@auth(level: NO_ACCESS)`
3. These mutations can only be called from Firebase Functions/CLI using Admin SDK
4. Update `AUTH_EXPRESSIONS.md` to list the new mutation

### Adding a New Type/Table

1. Open `schema/schema.gql`
2. Add your type definition with `@table` directive
3. Include audit fields: `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
4. Use appropriate default expressions (see existing types for patterns)

## Auth Patterns

All auth patterns are documented in `AUTH_EXPRESSIONS.md`. Key patterns:

- **User Access**: `@auth(expr: "auth.token.enabled == true")` - Requires enabled claim
- **Admin Access**: `@auth(expr: "auth.token.admin == true && auth.token.enabled == true")` - Requires admin + enabled
- **System Access**: `@auth(level: NO_ACCESS)` - SDK-only, no user auth required
- **Basic Auth**: `@auth(level: USER)` - Any authenticated user (used for initial profile creation)

## Deployment

After making changes, generate and compile against the SDKs **before** changing a remote environment:

1. Run `npx firebase dataconnect:sdk:generate` from the repository root.
2. Run `git diff --exit-code -- src/dataconnect-generated functions/src/dataconnect-admin-generated` and `git status --short -- src/dataconnect-generated functions/src/dataconnect-admin-generated`; both must produce no output, including no untracked generated files.
3. Run `npm run build` and `npm --prefix functions run build` to verify frontend and Admin SDK compatibility.
4. Deploy the schema and `api` connector together with `firebase deploy --only dataconnect --project <dev|beta|prod>`.
5. Confirm the service with `firebase dataconnect:services:list --project <dev|beta|prod>` and complete the Data Connect smoke-test checkpoint.
6. Only then deploy dependent Functions, followed by Hosting, using the central [Dev, Beta, and Prod rollout runbook](../docs/operations/environments-dev-beta-prod.md#full-stack-rollout-sequence).

The Firebase CLI applies required SQL migration steps before updating the Data Connect schema and connectors. Granular targets such as `dataconnect:sodc-web-service:schema` or `dataconnect:sodc-web-service:api` are reserved for an explicitly planned expand/contract rollout; they are not the default application release path.

## Related Documentation

- [Firebase DataConnect Documentation](https://firebase.google.com/docs/data-connect)
- [GraphQL Schema Reference](https://firebase.google.com/docs/data-connect/graphql-reference)
- See `AUTH_EXPRESSIONS.md` for complete auth expression reference
