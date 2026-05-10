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
npm run test

# Functions
cd functions
npm run test

# Focused security suites
cd functions
npm run test -- authGuards dataconnectAuthContracts functionEntryGuardContracts --run
```

## CI and required checks

- PR checks should run on every pull request via GitHub Actions.
- Security and permission contract tests should be configured as required checks in branch protection.

### Suggested required checks

After CI workflows are in place, configure these as required in branch protection:

- `Frontend targeted tests`
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
