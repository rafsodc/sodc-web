# Issue: Get GitHub Issue Details and Develop Approach

Fetch and display details for a specific GitHub issue, then develop an implementation approach for the user to consider.

## Usage

Extract the issue number from the user's query. The issue number may be specified as:
- "issue 15" or "issue #15"
- "#15"
- Just "15" (if context makes it clear)

If no issue number is provided in the query, ask the user to specify which issue number they want to view.

## Mode: Planning Only (No Changes)

**IMPORTANT**: This command operates in **planning/read-only mode**. Do NOT make any file changes, commits, or modifications to the codebase. This is for analysis, discussion, and approach development only.

## Actions

1. Use `gh issue view <number>` to fetch the issue details
2. Display the issue information in a clear, structured format including:
   - Issue number and title
   - State (open/closed)
   - Author
   - Labels (if any)
   - Assignees (if any)
   - Body/description
   - URL to the issue
3. **Develop an implementation approach** by:
   - Analyzing the issue requirements and acceptance criteria
   - Reviewing the codebase to understand relevant components/files (read-only)
   - Proposing a high-level implementation strategy
   - Identifying key files/components that will need changes
   - Suggesting a step-by-step implementation order
   - Considering any technical constraints or dependencies
4. **Present the approach** in a clear, structured format for the user to review
5. **Allow the user to refine** the approach through discussion before finalizing

## Restrictions

- **No file modifications**: Do not edit, create, or delete any files
- **No git operations**: Do not stage, commit, or push any changes
- **Read-only access**: Only read files to understand the codebase structure
- **Planning only**: Focus on analysis, strategy, and discussion

## Output Format

1. **Issue Details Section**: Format the issue information in a readable way
2. **Implementation Approach Section**: Present a well-structured approach including:
   - High-level strategy
   - Files/components to modify (identified but not changed)
   - Step-by-step implementation plan
   - Technical considerations
   - Dependencies or constraints

The approach should be comprehensive enough for the user to understand the plan, but flexible enough to be refined through discussion. All changes will be made later when the user explicitly requests implementation or uses the `/review` command to submit the approach.
