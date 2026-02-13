# Review: Submit Finalized Approach to Issue

Submit the finalized implementation approach as a comment on the issue and update the project status to "Plan Review".

## Usage

This command should be used after the `/issue` command has been used to develop and refine an approach. The user will indicate they are ready to submit the finalized approach.

## Prerequisites

- An issue number must be available from context (from previous `/issue` command)
- A finalized implementation approach must be ready to submit
- The issue should be in the GitHub project

## Actions

1. **Confirm the issue number** from context or ask the user if not clear
2. **Format the approach** as a well-structured comment that includes:
   - Clear heading (e.g., "## Implementation Approach")
   - High-level strategy summary
   - Step-by-step implementation plan
   - Files/components to be modified
   - Technical considerations
   - Any dependencies or constraints
3. **Post the comment** to the issue using `gh issue comment <number> --body "<formatted approach>"`
4. **Update project status** to "Plan Review":
   - Get the issue's node ID using `gh issue view <number> --json id`
   - Query the issue's project items to find the project and item IDs
   - Query the project's fields to find the Status field and "Plan Review" option ID
   - Update the status using GraphQL mutation with the discovered IDs
   - No repo variables needed - all IDs are discovered dynamically

## Project Status Update

The command should use GitHub GraphQL API with the following steps:

1. **Get issue node ID**: Use `gh issue view <number> --json id` to get the issue's GraphQL node ID

2. **Find project item**: Query the issue's project items:
   ```graphql
   query($id: ID!) {
     node(id: $id) {
       ... on Issue {
         projectItems(first: 20) {
           nodes {
             id
             project { id title }
           }
         }
       }
     }
   }
   ```

3. **Find Status field and "Plan Review" option**: Query the project fields to find the Status field and its options:
   ```graphql
   query($projectId: ID!) {
     node(id: $projectId) {
       ... on ProjectV2 {
         fields(first: 20) {
           nodes {
             ... on ProjectV2SingleSelectField {
               id
               name
               options {
                 id
                 name
               }
             }
           }
         }
       }
     }
   }
   ```
   - Find the field with `name: "Status"`
   - Find the option with `name: "Plan Review"` and note its `id`

4. **Update status**: Use the mutation with proper JSON format:
   ```graphql
   mutation($input: UpdateProjectV2ItemFieldValueInput!) {
     updateProjectV2ItemFieldValue(input: $input) {
       projectV2Item { id }
     }
   }
   ```
   
   With variables:
   ```json
   {
     "input": {
       "projectId": "<project_id_from_step_2>",
       "itemId": "<item_id_from_step_2>",
       "fieldId": "<status_field_id_from_step_3>",
       "value": {
         "singleSelectOptionId": "<plan_review_option_id_from_step_3>"
       }
     }
   }
   ```
   
   Execute using: `gh api graphql --input -` with the full query and variables as JSON

## Error Handling

- If the issue is not in the project, post the comment but warn that status couldn't be updated
- If the Status field or "Plan Review" option is not found, post the comment but warn that status update was skipped
- If the GraphQL mutation fails (e.g., insufficient token scopes), post the comment but warn that status update failed
- Always post the comment even if status update fails
- If token lacks `project` scope, inform user they need to add it at https://github.com/settings/tokens

## Output

Confirm to the user that:
- The approach has been posted as a comment on the issue
- The project status has been updated to "Plan Review" (or note if it couldn't be updated)
