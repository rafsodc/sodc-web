# GOV.UK Notify email reply-to address

Reply-to addresses are managed by an administrator on the site's **Email
delivery** page. Each environment has its own records because GOV.UK Notify
reply-to UUIDs belong to a particular Notify service.

The site supports:

- one optional system default;
- an optional override for each automated email template; and
- an administrator-approved list from which section moderators can choose when
  sending a bulk announcement.

`GOV_NOTIFY_EMAIL_REPLY_TO_ID` remains available only as a migration fallback.
New installations should use the admin page. Resolution is: verified template
override, verified system default, valid environment fallback, then the Notify
service default. A stale database record or malformed fallback cannot block a
password-reset or verification email.

## Find the UUID

Use the GOV.UK Notify service for the target environment:

1. Open **Settings**.
2. In **Email settings**, select **Manage** beside **Reply-to email addresses**.
3. Add and verify the required address, or open the existing address for editing.
4. Copy the `reply_to_email_id` UUID from the edit-page URL. It is the UUID
   immediately before `/edit` in:

   ```text
   /services/<service UUID>/service-settings/email-reply-to/<reply-to UUID>/edit
   ```

Only a Notify administrator with permission to manage service settings can add
or change these addresses. GOV.UK Notify's current setup guidance is available
at [Reply-to email address](https://www.notifications.service.gov.uk/using-notify/reply-to-email-address).

## Deploy the feature

Deploy Data Connect before Functions and Hosting so the new schema exists before
the runtime and admin page use it. The standard environment commands do this in
the correct order:

```sh
npm run deploy:dev
npm run deploy:beta
npm run deploy:prod
```

Use only the intended target and confirm the project summary before approving
the deployment.

## Add and verify an address

1. In the target site's admin area, open **Email delivery**.
2. Under **Reply-to addresses**, enter the display label, visible email address,
   and the environment's Notify reply-to UUID.
3. Enter an audit reason and add the address. It starts disabled and unverified.
4. Set the site email mode to **Team test** or **Live**, then select **Send test**.
   The test goes only to the signed-in administrator's verified account email.
5. Open the delivered message and inspect its `Reply-To` header. Confirm that it
   is the address recorded on the admin page.
6. Select **Confirm Reply-To**, then **Enable**.
7. Optionally make it the system default, allow it for announcements, or select
   it as an override for an automated template.

GOV.UK Notify accepting the UUID is only the first verification stage. An
operator must inspect the delivered header and explicitly confirm it in the UI.
Editing the label, email address, or UUID resets verification and disables the
record. A default record must be moved or cleared before it can be edited.

Disabling the current default clears it atomically in the UI. The backend also
supports replacing it atomically. Records and audit history are retained; there
is no hard-delete operation.

## Optional migration fallback

Add the UUID to the ignored Functions environment file selected by the Firebase
project ID. For example:

```dotenv
GOV_NOTIFY_EMAIL_REPLY_TO_ID=11111111-1111-4111-8111-111111111111
```

Use the appropriate file for the target project:

```text
functions/.env.sodc-web
functions/.env.sodc-web-beta
functions/.env.sodc-web-production
```

Deploy all Functions so every legacy fallback path receives the same value:

```sh
npm run deploy:dev
npm run deploy:beta
npm run deploy:prod
```

## Verify

Check the queued announcement Function directly, replacing the project ID for
Beta or Prod as required:

```sh
gcloud functions describe processAnnouncementEmail \
  --gen2 \
  --region=europe-west2 \
  --project=sodc-web \
  --format="value(serviceConfig.environmentVariables.GOV_NOTIFY_EMAIL_REPLY_TO_ID)"

npm run deployment:check -- --env dev
```

The deployment check warns when the optional value is absent and fails when a
deployed value is malformed, inconsistent, or missing from only some Functions.
It reports configuration state without printing the UUID.

Finally, send one automated message and one section announcement using the
appropriate safe delivery mode. For the announcement, confirm the moderator sees
only enabled, verified, announcement-approved addresses and a system-default
option. Inspect the received headers and confirm the expected address appears in
`Reply-To`. Repeat for each environment before enabling live delivery.
