#!/bin/bash

# Script to sync labels from labels.json to GitHub
# Usage: ./sync-labels.sh
# Requires: GitHub CLI (gh) and authentication

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LABELS_FILE="$SCRIPT_DIR/../labels.json"

if [ ! -f "$LABELS_FILE" ]; then
  echo "Error: labels.json not found at $LABELS_FILE"
  exit 1
fi

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
  echo "Error: GitHub CLI (gh) is not installed"
  echo "Install it from: https://cli.github.com/"
  exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
  echo "Error: Not authenticated with GitHub CLI"
  echo "Run: gh auth login"
  exit 1
fi

echo "Syncing labels from labels.json to GitHub..."
echo ""

# Function to create or update a label
sync_label() {
  local name=$1
  local description=$2
  local color=$3
  
  # Check if label exists
  if gh label view "$name" &> /dev/null; then
    echo "Updating label: $name"
    gh label edit "$name" --description "$description" --color "$color"
  else
    echo "Creating label: $name"
    gh label create "$name" --description "$description" --color "$color"
  fi
}

# Read labels.json and sync workflow labels
echo "Syncing workflow labels..."
workflow_labels=$(jq -r '.workflow[] | "\(.name)|\(.description)|\(.color)"' "$LABELS_FILE")
while IFS='|' read -r name description color; do
  if [ -n "$name" ]; then
    sync_label "$name" "$description" "$color"
  fi
done <<< "$workflow_labels"

# Read labels.json and sync test category labels
echo ""
echo "Syncing test category labels..."
test_labels=$(jq -r '.test-categories[] | "\(.name)|\(.description)|\(.color)"' "$LABELS_FILE")
while IFS='|' read -r name description color; do
  if [ -n "$name" ]; then
    sync_label "$name" "$description" "$color"
  fi
done <<< "$test_labels"

echo ""
echo "✓ Label sync complete!"
echo ""
echo "To verify, run: gh label list"
