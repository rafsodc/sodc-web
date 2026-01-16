#!/bin/bash

# Script to create a branch and draft PR for an issue
# Usage: ./create-branch-and-pr.sh <issue-number>

set -e

if [ $# -lt 1 ]; then
  echo "Usage: $0 <issue-number>"
  echo "Example: $0 42"
  exit 1
fi

ISSUE_NUMBER=$1

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "Error: Not in a git repository"
  exit 1
fi

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
  echo "Error: GitHub CLI (gh) is not installed"
  exit 1
fi

# Fetch issue details
echo "Fetching issue #${ISSUE_NUMBER}..."
ISSUE_TITLE=$(gh issue view $ISSUE_NUMBER --json title --jq '.title')
if [ $? -ne 0 ]; then
  echo "Error: Could not fetch issue #${ISSUE_NUMBER}"
  exit 1
fi

echo "Issue: #${ISSUE_NUMBER} - ${ISSUE_TITLE}"

# Generate branch description from issue title
# Convert to lowercase, replace spaces/special chars with hyphens, remove leading/trailing hyphens
SHORT_DESC=$(echo "$ISSUE_TITLE" | \
  tr '[:upper:]' '[:lower:]' | \
  sed 's/[^a-z0-9]/-/g' | \
  sed 's/--*/-/g' | \
  sed 's/^-\|-$//g' | \
  cut -c1-50 | \
  sed 's/-$//')

# If description is empty or too short, use a default
if [ -z "$SHORT_DESC" ] || [ ${#SHORT_DESC} -lt 3 ]; then
  SHORT_DESC="feature"
fi

BRANCH_NAME="issue-${ISSUE_NUMBER}-${SHORT_DESC}"
echo "Generated branch name: $BRANCH_NAME"

# Ensure we're on main and up to date
echo "Checking out main branch..."
git checkout main
git pull origin main

# Check if branch already exists
if git show-ref --verify --quiet refs/heads/$BRANCH_NAME; then
  echo "Error: Branch $BRANCH_NAME already exists"
  exit 1
fi

# Create and checkout branch
echo "Creating branch: $BRANCH_NAME"
git checkout -b $BRANCH_NAME

# Push branch
echo "Pushing branch to remote..."
git push -u origin $BRANCH_NAME

# Create draft PR
echo "Creating draft PR..."
PR_URL=$(gh pr create --draft \
  --title "[#${ISSUE_NUMBER}] ${ISSUE_TITLE}" \
  --body "Implements issue #${ISSUE_NUMBER} - ${ISSUE_TITLE}

## Changes
- [To be filled during implementation]

## Related Issue
Related to #${ISSUE_NUMBER}

## Testing
- [ ] Security tests pass
- [ ] Functionality tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated (if needed)" \
  --base main)

if [ $? -eq 0 ]; then
  echo ""
  echo "✓ Branch created: $BRANCH_NAME"
  echo "✓ Draft PR created: $PR_URL"
  echo ""
  echo "Next steps:"
  echo "1. Update issue labels: remove 'ready-for-dev', add 'in-progress'"
  echo "2. Start implementing on this branch"
  echo "3. Tests will run automatically on each push"
else
  echo "Error: Failed to create PR"
  exit 1
fi
