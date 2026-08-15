# Email Templates

GOV Notify email templates for SODC, stored as Markdown for version control and review.

## Files

Each template is a `.md` file with YAML frontmatter:

```markdown
---
subject: "Your subject line with ((variable)) support"
templateKey: camelCaseKey
variables:
  - variableName
  - anotherVariable
---
Email body in GOV Notify Markdown.
```

- **`subject`** — the email subject line, may include `((variable))` placeholders
- **`templateKey`** — must match the key used in the dispatcher TypeScript file
- **`variables`** — the full list of `((variable))` names used in this template; must match exactly what the dispatcher sends

## Template registry

`template-registry.json` maps each `templateKey` to its GOV Notify template UUID per environment. UUIDs are not secrets — they are safe to commit.

Environments match the Firebase project aliases in `.firebaserc`:

```json
{
  "bookingConfirmation": {
    "dev": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "beta": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
    "production": "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz"
  }
}
```

Fill in UUIDs after creating/locating each template in the GOV Notify dashboard for that environment.

## Workflow: updating a template

1. Edit the `.md` file and commit the change (PR review applies here)
2. Log in to the GOV Notify dashboard and update the corresponding template manually
3. Check the admin template drift page to confirm the live template matches the `.md` file

> GOV Notify does not provide a template create/update API — all dashboard changes must be made manually.

## Workflow: new environment setup

1. Create each template in the GOV Notify dashboard by copying subject and body from the `.md` files
2. Fill in the returned UUIDs in `template-registry.json`
3. Commit the updated registry

## Admin drift detection

The admin panel includes a **Template sync** page that fetches each template from GOV Notify via the API and compares it against the `.md` file. This catches cases where the dashboard was updated without updating the codebase, or vice versa. A diff is shown for any template that has drifted.

## Relationship to `docs/operations/govuk-notify-template-copy.md`

That file is an index and tone guide linking back to this directory. It deliberately
does not duplicate subject and body copy. This directory (`.md` files +
`template-registry.json`, compiled into `generatedEmailTemplateManifest.ts`) is the
source the Template sync page checks.

When adding or removing a template, update the index in the same PR: a
`### \`templateKey\`` heading must exist in
`docs/operations/govuk-notify-template-copy.md` for every template here, and vice
versa. `functions/src/__tests__/email-templates/emailTemplateDocsContracts.test.ts`
enforces this.
