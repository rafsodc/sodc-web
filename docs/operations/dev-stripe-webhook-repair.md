# Dev Stripe webhook signing and subscription repair

This procedure repairs the confirmed signing-secret mismatch for Dev's existing
Stripe TEST webhook. It also adds the four missing event subscriptions. It is a
configuration operation, not a Functions deployment.

Use `npm run operations:dev-stripe-webhook`. The command is fixed to:

| Resource | Required value |
| --- | --- |
| Google project | `sodc-web` (`931675247602`) |
| Region and Function | `europe-west2`, `stripeWebhookPayments` |
| Signing secret | `STRIPE_WEBHOOK_SECRET_PAYMENTS`, initially version `1` |
| Stripe TEST account | `acct_1SgTanEJWVZaraSf` (RAF SODC sandbox) |
| Stripe endpoint | `we_1TOixKEJWVZaraSfeonnSQby` |
| Endpoint URL | `https://europe-west2-sodc-web.cloudfunctions.net/stripeWebhookPayments` |
| Runtime identity | `931675247602-compute@developer.gserviceaccount.com` |
| Maximum instances | `20` |
| Email ceiling | `SIMULATION` |

There is no Production flag, endpoint override, deployment, IAM change, event
resend, claim reset or automatic write retry. Do not substitute the old Notify
binding-repair tool, which has a different target and preservation contract.

## Agreed Dev data policy

The operator accepts processing of the existing Dev TEST backlog because Dev data
is disposable. Preparation therefore does not enumerate pending events or require
a backlog review. Once signatures verify, Stripe automatic retries can invoke
normal Dev payment processing and change Dev records. The proposal records this
acceptance. It does not authorize a manual replay or any Production business-data
change. The exact TEST account and the `SIMULATION` email ceiling remain required.

## Review and preparation

Review this procedure and its code before running its write phases. Freeze other
configuration changes to the target, signing secret, Stripe endpoint and shared
deployment baseline for the repair window. The APIs offer no compare-and-swap;
the repeated metadata checks cannot exclude a concurrent operator on another
machine.

Use a clean checkout containing this tool. Install the locked root and Functions
dependencies, use Node 24 and build Functions with `npm --prefix functions run
build`. The command binds the clean tracked bytes, commit, tree, compiled
Functions and SDK-discovered manifest (SDK `7.2.5`). The target must declare exactly
its five current secrets. It does not deploy that build or reconcile unrelated
source/live differences.

In particular, #745's reconciliation declaration is a separate release gate.
This repair preserves the existing live declarations on other Functions. It
does not approve the earlier Notify binding repair's failed verification, the
historical gaps, or any Production repair. Ordinary guard and full-preflight
requirements remain in force for a later Functions release.

Run from the reviewed checkout. Choose a new run path directly under
`/private/tmp` on macOS (the system temporary directory on Linux), with the shown
prefix. The path must not already exist. Do not create it yourself.

```bash
npm run operations:dev-stripe-webhook -- --env dev --phase prepare \
  --run-dir /private/tmp/sodc-dev-stripe-webhook-repair-run-UNIQUE --secret-stdin
```

Paste the exact signing secret from **that endpoint in that sandbox** at the
hidden terminal prompt. Input is needed again at `apply-secret`, after review.
Do not use the Stripe CLI's forwarding secret or a different endpoint's secret.
Do not put the value in chat, arguments, an environment variable, shell history,
evidence, or a regular file. A protected pipe is supported for an approved
credential source; a regular-file stdin redirect is rejected before reading.
The tool removes only one terminal line ending; it never trims
or repairs the candidate. Existing webhook endpoint GETs do not return its secret,
so the private Dashboard comparison is a prerequisite, not something the tool
can rediscover through the API.

The signing candidate is the only credential supplied through stdin. Separately,
the provider reads the existing `STRIPE_SECRET` payload from Secret Manager, using
the numeric version bound to the target and cross-checked against that version's
enabled metadata. It uses that TEST API key only in memory to check the account
and inspect/update the fixed endpoint. No key value enters proposals or logs.

Preparation makes provider reads and creates only local private files. It requires
the existing seven subscriptions, exactly one enabled signing version (`1`), the
fixed target runtime contract, a direct unconditional signing-secret accessor
grant, and an unchanged, active deployed baseline. It hashes the actual
generation-bound Function source archive and the successful Cloud Build's resolved
input archive; their bytes must agree. Archives are streamed in memory and are
not retained. Unsupported or unreadable metadata blocks preparation.

Review `proposal.json` and its printed SHA-256. The proposal expires after one hour.
It contains the exact scope, before bindings, eleven intended subscriptions,
source proof, Dev backlog acceptance and HMAC fingerprints. It contains no secret
values or environment values. Keep `comparison.key` and the entire run directory
private; never publish or copy the key into an evidence archive.

**Before any write, obtain approval of that exact proposal.** Create `review.json`
in the private run directory from `review-template.json`, set `decision` to
`APPROVED`, and fill `reviewedBy` and `reason` with the real review details. Keep
mode `0600` and its exact proposal hash. An expired proposal cannot authorize a
write. Do not extend an expiry or edit the proposal; obtain a new proposal before
any write has begun. Verification remains available after expiry.

The hour starts at **prepare**, not at approval or the first write. Finish code
review first, arrange the maintenance freeze and have the exact-proposal reviewer
available before preparing. Begin writes only when the operator can remain for
the entire sequence, including Google's update and the final Stripe update,
within the remaining hour. If approval is delayed or too little time remains,
prepare a fresh run before any claim or write has started.
Check that the operator machine's clock is synchronized before preparation:
verification compares locally recorded intent times with Google's UTC metadata,
so clock skew can cause a chronology stop after an intent is recorded.

Expiry after a claim/write does not have an in-tool renewal or restart. It can
leave an enabled new signing version unbound, or leave the signing correction
complete while the endpoint still has only seven subscriptions. Verification
remains read-only and available, but completing the remaining writes then needs
separate operator review and a separately reviewed recovery procedure. Do not
delete the claim, edit timestamps, extend approval, or start another run to evade
that stop. No automatic rollback is attempted.

## Execute once, in order

Every write phase rechecks the source, review and live baseline, records a durable
intent, and rechecks immediately before its single request. The first write also
claims the fixed Dev target in the repository's shared Git checkout at
`.firebase/dev-stripe-webhook-repair-locks/sodc-web.json`. All worktrees share that
claim. It is a different namespace from the original Notify repair and does not
modify its claim or run. The claim is retained for every outcome. It cannot prevent
another clone or machine from operating, so keep the maintenance freeze.

1. Add one signing-secret version, entering the same candidate at the hidden prompt:

   ```bash
   npm run operations:dev-stripe-webhook -- --env dev --phase apply-secret \
     --run-dir /private/tmp/sodc-dev-stripe-webhook-repair-run-UNIQUE --secret-stdin
   ```

   Require `SECRET_VERSION_CREATED`. The acknowledged numeric version is read back
   and privately matched to the reviewed HMAC. The command never chooses a version
   by reading `latest`. Version `1` is not disabled or deleted. Adding a latest
   version can temporarily block the ordinary guard until the binding is repaired.

2. Rebind only the target's signing reference to that acknowledged version:

   ```bash
   npm run operations:dev-stripe-webhook -- --env dev --phase apply-function \
     --run-dir /private/tmp/sodc-dev-stripe-webhook-repair-run-UNIQUE
   ```

   Require `FUNCTION_UPDATE_ACCEPTED_VERIFY_REQUIRED`. The only PATCH mask is
   `serviceConfig.secretEnvironmentVariables`; the body retains the other four
   bindings. Google may rebuild the Function even for this configuration update.

3. Verify the acknowledged operation by reads only:

   ```bash
   npm run operations:dev-stripe-webhook -- --env dev --phase verify-function \
     --run-dir /private/tmp/sodc-dev-stripe-webhook-repair-run-UNIQUE
   ```

   `PENDING` permits another verification read, never another PATCH. Require
   `FUNCTION_VERIFIED` before continuing. Both supported outcomes require the
   acknowledged operation's target and update verb, an active new revision and
   update time after the intent, the exact numeric binding and all preservation
   checks. If Google creates a new build, it must succeed after the intent; both
   the Function archive and the build's resolved input must hash to the original
   source bytes, even if archive names or generations move. If Google does not
   rebuild, the reviewed successful build, build-input archive proof and exact
   build/source/provenance references must remain unchanged. If Function source
   provenance is present, it must identify the hash-proven archive in either case.

   `verify-function` is the pre-subscription phase. After the Stripe update use
   final `verify`; repeating `verify-function` then fails its expected seven-event
   baseline rather than checking the completed eleven-event state.

   Only target update time, state messages, revision, source/build references and
   the signing version may differ. All other target settings, environment values,
   identity, traffic, max instances, other Functions, invokers, shared secret
   metadata/policies and Scheduler configuration must be preserved. Invoker-policy
   etags and Scheduler `lastAttemptTime`, `scheduleTime`, and `status` are excluded
   as volatile observations. This supplies a before/after source proof for this
   repair; it cannot recover missing evidence from the earlier Notify update.

4. Add subscriptions only after that verification, within the proposal's lifetime:

   ```bash
   npm run operations:dev-stripe-webhook -- --env dev --phase apply-subscriptions \
     --run-dir /private/tmp/sodc-dev-stripe-webhook-repair-run-UNIQUE
   ```

   The single Stripe update preserves the seven existing events and adds exactly:
   `checkout.session.async_payment_succeeded`, `refund.created`, `refund.updated`,
   and `refund.failed`. It preserves endpoint URL, API version, mode, status and
   other endpoint metadata. The API key is read only in memory; the provider checks
   `/v1/account` against the fixed TEST account before Stripe operations. The update
   uses a proposal-bound idempotency key without issuing an automatic retry.

5. Require final metadata verification:

   ```bash
   npm run operations:dev-stripe-webhook -- --env dev --phase verify \
     --run-dir /private/tmp/sodc-dev-stripe-webhook-repair-run-UNIQUE
   ```

   Require `PASS`, the same verified revision/build, all eleven subscriptions and
   unchanged protected state. Verification records are append-only. A metadata
   `PASS` explicitly sets `runtimeAcceptancePassed: false` and
   `productionAuthorized: false`.

## Stops and recovery limits

Stop on a fixed error code, `UNKNOWN_OUTCOME_OPERATOR_REVIEW_REQUIRED`, or
`OPERATION_FAILED_OPERATOR_REVIEW_REQUIRED`. Retain the private run and claim.
Do not retry a write, delete the claim, infer an acknowledgement from live state,
create another run to escape a claim, rotate another version, deploy around the
guard, or manually resend an event.

Any lost, malformed or unpersisted write acknowledgement is an unknown outcome,
including an HTTP rejection. Later phases cannot proceed without the matching
durable acknowledgement. A pre-request check can also stop after an intent has
been recorded; a separate reviewed investigation must establish what happened.
The tool has no unlock, rollback or unknown-outcome adoption command. The local
private filesystem checks are not atomic against a malicious local rename.

Exit `0` means help, proposal prepared, secret version acknowledged, Function
verified, or final metadata PASS. Exit `3` means an accepted write still needs
verification, a pending operation, or an unresolved outcome. Exit `1` is a block;
an intent or claim may already exist. Read the status as well as the exit code.
An exit `1` can also mean an auxiliary verification-log append failed after a
stage acknowledgement was durably stored. The stage records remain authoritative;
do not repeat the mutation because its command failed to append that log.

## Runtime acceptance afterwards

Prepare a separate exact Dev test after metadata PASS. A bounded signature check
can create and expire one unpaid TEST Checkout Session without order-routing
metadata, then verify a successful `checkout.session.expired` delivery and the
expected ignored ledger result. This repair command does not create that session
or perform the runtime call.

The earlier paid Dev Checkout fixture was retired. Do not re-admit its user,
recreate its order/hold, call reconciliation, or replay its event without a fresh
test proposal. No email is delivered under `SIMULATION`. The shared Notify callback
can still create ignored technical receipts in Production; any test that reaches
it needs its own scoped authorization. Metadata preservation alone proves neither
signature acceptance, runtime secret access, Notify key validity nor delivery.

## API references

- [Secret Manager addVersion](https://docs.cloud.google.com/secret-manager/docs/reference/rest/v1/projects.secrets/addVersion)
- [Secret Manager version access](https://docs.cloud.google.com/secret-manager/docs/reference/rest/v1/projects.secrets.versions/access)
- [Functions v2 PATCH and field mask](https://docs.cloud.google.com/functions/docs/reference/rest/v2/projects.locations.functions/patch)
- [Cloud Build source provenance](https://docs.cloud.google.com/build/docs/api/reference/rest/v1/projects.builds#SourceProvenance)
- [Stripe endpoint update](https://docs.stripe.com/api/webhook_endpoints/update)
- [Stripe webhook signature errors](https://docs.stripe.com/events/manage-webhook-endpoints#signature-errors)
