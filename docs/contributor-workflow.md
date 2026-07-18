# Contributor Workflow

This guide defines the expected development workflow for issues, branches, PRs, and checks.

## Environments

We target **three Firebase projects** (Dev, Beta, Prod); local development uses Vite env files pointing at **Dev** unless you intentionally aim at another project. See [operations/environments-dev-beta-prod.md](operations/environments-dev-beta-prod.md) for aliases, builds, deploy order, and Stripe notes.

## Branching

- Branch from `main` unless coordinating multi-PR stacked work.
- Prefer one issue-focused branch per PR for cleaner review.
- Use descriptive issue-linked branch names (e.g. `67-security-permission-tests-for-queries-and-functions-phased`).

## Issue-driven development

- Keep work tracked in an issue/epic.
- If scope grows, create follow-up issues rather than overloading the original issue.
- Add status/progress comments for non-trivial changes.

## Pull requests

Recommended PR body sections:

- Summary
- Test plan
- Related issues (`Closes #...`, `Part of #...`)

Keep PRs focused and independently mergeable.

## Testing expectations

Before opening/merging PRs:

- run tests for changed areas
- include negative-path tests for auth/permission-sensitive logic
- ensure generated SDK changes come from source `.gql` updates when applicable

Common commands:

```sh
# Frontend
npm run lint
npm run test

# Functions
npm --prefix functions run lint
npm --prefix functions run test
npm --prefix functions run test:coverage

# Full functions suite (includes mailers, dispatchers, wiring tests)
cd functions
npm run test

# Focused security suites (also run in CI)
cd functions
npm run test -- authGuards dataconnectAuthContracts functionEntryGuardContracts --run
```

Functions linting is self-contained: its ESLint dependencies and flat configuration live in
`functions/`, so the same check also works after a Functions-only install:

```sh
cd functions
npm ci
npm run lint
```

### Functions coverage

`npm --prefix functions run test:coverage` reports on every hand-authored TypeScript file under `functions/src`, including files that no test imports. Build output, generated Data Connect code, generated email-template manifests, declarations, tests, and test helpers are excluded. HTML and JSON summary reports are written to `functions/coverage/`, which is ignored by Git and ESLint.

The initial global floors preserve the measured baseline while allowing coverage to improve incrementally:

| Metric | Global minimum |
| --- | ---: |
| Statements | 46% |
| Branches | 42% |
| Functions | 57% |
| Lines | 46% |

Higher grouped thresholds protect code at critical boundaries:

- authorization, validation, and rate limiting (`helpers`, `rateLimiter`, `sections`, `validation`): 77% statements, 66% branches, 80% functions, 77% lines
- deterministic payment, Stripe webhook, and state-transition logic: 90% statements, 73% branches, 100% functions, 94% lines
- member-facing Stripe artifact retrieval: 95% statements, 78% branches, 100% functions, 95% lines
- notification delivery and callback handling: 81% statements, 68% branches, 69% functions, 82% lines
- notification delivery lease and idempotency logic: 65% statements, 50% branches, 57% functions, 64% lines

Treat these values as ratchets. Raise the relevant whole-number threshold when a change creates durable headroom; do not lower one without explaining the coverage loss and follow-up plan in the PR. Integration-heavy callable and webhook entry points remain covered by the global gate and security contract tests, while extracted deterministic payment and state-transition modules use the higher grouped thresholds above.

When changing transactional email (callables, webhooks, dispatchers), run the **full** functions suite and update [`operations/transactional-email-workflows.md`](operations/transactional-email-workflows.md) when triggers or delivery keys change.

## CI and required checks

- PR checks should run on every pull request via GitHub Actions.
- Security and permission contract tests should be configured as required checks in branch protection.

### Suggested required checks

After CI workflows are in place, configure these as required in branch protection:

- `Frontend and functions build checks`
- `Frontend full test suite`
- `Functions full test suite`
- `Functions coverage gate (ratcheted)`
- `Functions security tests`

Set in GitHub repository settings:

1. Settings -> Branches
2. Edit branch protection rule for `main`
3. Enable "Require status checks to pass before merging"
4. Select the CI job names above

## Documentation upkeep

When behavior changes:

1. Update relevant docs in `docs/` in the same PR.
2. Keep architecture references aligned with current code paths.
3. Remove stale or template text instead of appending conflicting guidance.
