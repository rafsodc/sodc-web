# Branch and Pull Request Workflow

This document describes the branch naming conventions and PR creation process for the development automation workflow (see issue #13).

## Branch Naming Convention

Branches should follow this format:

```
issue-<number>-<short-description>
```

**Examples:**
- `issue-13-issue-template` - For issue #13, adding issue template
- `issue-42-filter-sections` - For issue #42, filtering sections feature
- `issue-15-fix-auth-bug` - For issue #15, fixing authentication bug

**Guidelines:**
- Always prefix with `issue-<number>-`
- Use kebab-case for the description
- Keep description short (2-4 words)
- Make it descriptive of the feature/fix

## Branch Creation Process

### When to Create a Branch

Create a branch when:
- Issue has `ready-for-dev` label
- Strategy has been approved and added as comment
- Ready to begin implementation

### How to Create a Branch

**Option 1: Automatic via GitHub Actions (recommended):**
When you add the `ready-for-dev` label to an issue, GitHub Actions will automatically:
- Generate a branch name from the issue title
- Create the branch from main
- Push to remote
- Create a draft PR
- Update issue labels (remove `ready-for-dev`, add `in-progress`)
- Comment on the issue with branch and PR details

**Note:** The workflow checks if a branch/PR already exists to avoid duplicates. See `.github/workflows/auto-branch-and-pr.yml` for the workflow definition.

**Option 2: Using the automation script:**


1. **Ensure you're on main and up to date:**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Create branch from issue number:**
   ```bash
   git checkout -b issue-<number>-<short-description>
   ```

3. **Push branch to remote:**
   ```bash
   git push -u origin issue-<number>-<short-description>
   ```

### Example


**Automatic (GitHub Actions):**
1. Add `ready-for-dev` label to issue #42
2. GitHub Actions automatically creates branch and PR
3. Check the issue comment for branch name and PR link

For issue #42 "Add section filtering":

**Using script:**
```bash
.github/scripts/create-branch-and-pr.sh 42
# Generates: issue-42-add-section-filtering
```

**Manual:**
```bash
git checkout main
git pull origin main
git checkout -b issue-42-filter-sections
git push -u origin issue-42-filter-sections
```

## Pull Request Creation

### When to Create a PR

Create a **draft PR** immediately after branch creation:
- Enables CI/CD to run tests
- Allows for early discussion
- Provides previews if applicable
- Tests run on every push

### Draft PR Format

**Title:**
```
[#<issue-number>] <Brief description>
```

**Body Template:**
```markdown
Implements issue #<number> - <issue title>

## Changes
- [Brief list of changes]

## Related Issue
Closes #<number> (or "Related to #<number>" if not closing)

## Testing
- [ ] Security tests pass
- [ ] Functionality tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated (if needed)
```

### Creating Draft PR via GitHub CLI

```bash
gh pr create --draft \
  --title "[#<number>] <Description>" \
  --body "<PR body>" \
  --base main
```

### Example

For issue #42:
```bash
gh pr create --draft \
  --title "[#42] Add section filtering by access group" \
  --body "Implements issue #42 - Add section filtering

## Changes
- Add filter toggle to sections list
- Implement access group filtering logic
- Add URL query param support

Related to #42" \
  --base main
```

## Workflow Integration

### Step 5: Branch and PR Creation

1. **Issue ready**: Issue has `ready-for-dev` label
2. **Automatic creation**: GitHub Actions automatically:
   - Creates branch from main (name generated from issue title)
   - Pushes branch to remote
   - Creates draft PR
   - Updates labels (removes `ready-for-dev`, adds `in-progress`)
   - Comments on issue with branch and PR details
3. **Manual alternative**: If automation is not used:
   - Create branch: `git checkout -b issue-<number>-<description>`
   - Push branch: `git push -u origin issue-<number>-<description>`
   - Create draft PR: Use `gh pr create --draft`
   - Update labels manually
4. **Add test labels**: Add `security-tests` and/or `functionality-tests` to PR as appropriate

### Step 6: Development

- Work on branch
- Make atomic commits (one per acceptance criterion when possible)
- Push regularly (tests run on each push)
- Update PR description as needed

### Step 7: PR Review and Merge

- Remove draft status when ready for review
- Address review comments
- Ensure all tests pass
- Merge PR (closes issue automatically if PR body includes "Closes #<number>")

## Atomic Commits

Encourage commits that map to acceptance criteria:

**Good commit messages:**
```
[#42] Add filter toggle button to sections list

Implements acceptance criterion: "Add a filter toggle button to the sections list page"
```

```
[#42] Implement access group filtering logic

Implements acceptance criterion: "When filter is enabled, only display sections where user has VIEW access"
```

**Benefits:**
- Makes PR review easier
- Clear mapping to requirements
- Easy to generate PR summaries
- Better git history

## Branch Cleanup

After PR is merged:
- Branch is automatically deleted (if configured in GitHub)
- Or manually delete: `git branch -d issue-<number>-<description>`
- Pull latest main: `git checkout main && git pull`

## Automation Script

The script `.github/scripts/create-branch-and-pr.sh` automates branch and PR creation:

**Usage:**
```bash
.github/scripts/create-branch-and-pr.sh <issue-number>
```

**What it does:**
1. Fetches issue details from GitHub
2. Generates branch name from issue title (converts to kebab-case)
3. Creates branch from main
4. Pushes branch to remote
5. Creates draft PR with issue details

**Example:**
```bash
.github/scripts/create-branch-and-pr.sh 42
# For issue #42 "Add section filtering"
# Creates: issue-42-add-section-filtering
# Creates draft PR automatically
```

## Integration with Cursor

When using Cursor to implement:

1. **Tell Cursor to checkout branch:**
   ```
   Checkout branch issue-<number>-<description> and execute the plan from issue #<number>
   ```

2. **Cursor will:**
   - Checkout the branch
   - Review the strategy from issue comments
   - Implement according to plan
   - Make atomic commits
   - Push updates

3. **Tests run automatically** on each push via CI/CD
