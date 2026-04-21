# Repository Structure Conventions

This document defines where code should live and how to keep structure changes low-risk.

## Directory ownership

- `src/features/`: product-domain frontend code (admin, sections, users, auth).
- `src/shared/`: reusable UI and utilities shared across features.
- `src/constants/`: route/auth/static app constants.
- `functions/src/`: backend logic and entry points for callable/onRequest functions.
- `dataconnect/schema/`: source-of-truth data model.
- `dataconnect/api/`: source-of-truth GraphQL operations.
- `docs/architecture/`: technical architecture and process docs.

## Testing layout

- Frontend tests live near domain code in `src/**/__tests__/`.
- Functions/backend tests live in `functions/src/__tests__/`.
- Permission and auth contract tests should be backend-owned by default, even when they validate Data Connect operation directives.

## Generated artifacts

Generated SDKs should remain isolated and treated as build outputs:

- `src/dataconnect-generated/`
- `functions/src/dataconnect-admin-generated/`

Rules:

1. Prefer updating `.gql` sources, then regenerate.
2. Avoid manual edits in generated folders unless handling a documented emergency unblock.
3. If generated output changes, include source operation/schema changes in the same PR when possible.

## Safe cleanup rules

When performing structure cleanup:

1. Prefer small, scoped PRs.
2. Avoid broad moves and behavior changes in one step.
3. Preserve import boundaries (`features` -> `shared`, not the reverse for domain-specific logic).
4. Keep tests updated in the same PR as file moves/refactors.
