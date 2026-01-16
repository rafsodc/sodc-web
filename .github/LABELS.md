# GitHub Labels Workflow

This document describes the label system used to track issues through the development automation workflow (see issue #13).

## Workflow Labels

These labels track the state of issues through the development cycle:

### `needs-planning` 🟡
- **When to use**: Issue has been submitted with template and acceptance criteria, ready for planning phase
- **Next step**: Dev reviews and approves for planning
- **Color**: Yellow (#FBCA04)

### `planning-approved` 🟢
- **When to use**: Issue approved for planning, ready for strategy development with Cursor/AI
- **Next step**: Dev asks Cursor to load issue and develop strategy
- **Color**: Green (#0E8A16)

### `ready-for-dev` 🔵
- **When to use**: Strategy has been agreed upon and added as comment, ready for development
- **Next step**: Branch created, Cursor executes plan
- **Color**: Blue (#1D76DB)

### `in-progress` ⚪
- **When to use**: Issue is actively being worked on
- **Next step**: Implementation, commits, and PR creation
- **Color**: Light Gray (#EDEDED)

## Test Category Labels

These labels help categorize tests for CI/CD:

### `security-tests` 🔴
- **When to use**: Tag issues/PRs that require security-focused tests
- **Purpose**: Security tests must pass and are focused on Firebase schema and functions
- **Examples**: Auth/permission checks, data validation, access control
- **Color**: Red (#B60205)

### `functionality-tests` 🔵
- **When to use**: Tag issues/PRs that require functionality tests
- **Purpose**: Component behavior, user flows, integration tests
- **Color**: Blue (#0052CC)

## Workflow Example

1. **Issue created** → User submits issue using template
2. **`needs-planning`** → Dev reviews and adds this label
3. **`planning-approved`** → Dev approves for planning, removes `needs-planning`
4. **Strategy developed** → Dev uses Cursor to develop strategy, adds as comment
5. **`ready-for-dev`** → Dev approves strategy, removes `planning-approved`, adds `ready-for-dev`
6. **Branch created** → GitHub Actions automatically creates branch and draft PR when `ready-for-dev` label is added
7. **`in-progress`** → GitHub Actions automatically updates labels (removes `ready-for-dev`, adds `in-progress`)
8. **PR created** → Draft PR created, tests run
9. **Labels on PR** → Add `security-tests` and/or `functionality-tests` as appropriate
10. **PR merged** → Issue closed, labels cleaned up

## Label Management

Labels can be managed via:
- GitHub web UI: Repository → Issues → Labels
- GitHub CLI: `gh label list`, `gh label create`, `gh label edit`
- This file: Reference for label purposes and workflow

## Adding New Labels

When adding new labels:
1. Create label via `gh label create` or GitHub UI
2. Update this documentation
3. Consider if it fits into the workflow or is a category label