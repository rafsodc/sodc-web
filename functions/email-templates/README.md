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

## Live template bindings

Each environment's **Email Templates** administration page manages the saved
Data Connect binding from a logical `templateKey` to a live Notify template UUID,
plus the version an administrator last reviewed. `template-registry.json` is
retired as runtime configuration: editing it does not configure a sender's live
binding.

The registry is retained for the legacy informational
`npm --prefix functions run check:template-sync` checker. That checker does not
read live Data Connect bindings, and its successful or skipped result is not
readiness evidence. The existing PR/nightly jobs are unchanged by this work;
their credential wiring and any replacement with an authenticated readiness job
need a separate CI authentication review. Use the audit below for live binding
configuration evidence.

Review existing templates in the environment's Notify service first. Reuse the
exact-name template when one exists; create one only if it is absent. Before
saving a binding, compare its exact ID, name, subject, body, placeholders and live
version against the reviewed Markdown source. Follow the
[registration runbook](../../docs/operations/govuk-notify-template-registration.md)
for the complete per-environment procedure and recovery-backlog review.

Binding-only changes take effect immediately and need no Functions deployment.
A missing or unreadable saved binding can use the executing Function's
`GOV_NOTIFY_TEMPLATE_*` fallback only if that fallback is actually configured.
If both are missing, sending fails before contacting Notify. The environment
fallback is not a replacement for reviewing and managing the normal saved
binding.

From the repository root, check ID configuration with:

```sh
npm run deployment:template-readiness -- --env dev
```

Use the target alias (`dev`, `beta` or `prod`) for the environment being reviewed.
The [read-only readiness audit](../../docs/operations/deployment-checks.md#transactional-template-readiness-limits)
also runs in the standard deployment audit and preflight. It checks saved IDs or
per-sender fallbacks; it does not contact Notify, validate live copy or send a
message. A passing configuration check is not proof of delivery.

## Workflow: updating a template

1. Edit the `.md` file, generate the manifest with `npm --prefix functions run generate:templates` from the repository root, and include the reviewed source/generated changes in the PR.
2. Coordinate the reviewed release and the corresponding Notify dashboard change; the administration page compares live copy against the manifest in the deployed Functions.
3. Open **Email Templates → Refresh** and review the exact template and content. Save the same binding at its reviewed current version after the content matches. If a save response fails, read back the binding/audit state before retrying.

The reviewed version is a review marker, not a pinned sending version or a send
gate. Notify sends the live version. A **Content matches** row can still show a
version-review reminder. Do not bulk-accept warnings without reviewing the
affected templates.

## Workflow: new environment setup

1. Review the target service's existing templates against every active key; create only those that are absent, using the source subject and body.
2. In that environment's **Email Templates** page, select and save each reviewed binding individually.
3. Read back the bindings, run the readiness audit, and refresh the content status. Send end-to-end tests only with an approved recipient and message.

## Admin drift detection

The admin panel's **Email Templates** page loads status when **Refresh** is
selected. It compares live Notify subject/body content with the generated
manifest and shows a diff for content drift. **No saved binding** reports missing
Data Connect binding metadata; the page does not assess the executing sender's
environment fallback. That is the separate operational readiness check above.

## Relationship to `docs/operations/govuk-notify-template-copy.md`

That file is an index and tone guide linking back to this directory. It deliberately
does not duplicate subject and body copy. This directory's template `.md` files
(excluding this README) are compiled into
[`generatedEmailTemplateManifest.ts`](../src/generatedEmailTemplateManifest.ts).
Saved live bindings remain environment data, not part of that generated copy
manifest.

When adding or removing a template, update the index in the same PR: a
`### \`templateKey\`` heading must exist in
`docs/operations/govuk-notify-template-copy.md` for every template here, and vice
versa. `functions/src/__tests__/email-templates/emailTemplateDocsContracts.test.ts`
enforces this.
