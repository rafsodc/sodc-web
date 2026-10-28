# Stage 2: data correctness

Parent: #645. Integration branch: `codex/data-correctness`.

Stage 1 is merged into main and deployed; cleanup #681 is merged. This stage fixes trusted subscription identity and the freshness of confirmed server state. Work is prepared for review; environment deployment and live acceptance remain separate release actions.

## Shared freshness policy — #648

Use one session-aware authoritative-refresh mechanism for successful callable/server writes, explicit Refresh/Retry and payment reconciliation/polling. Refresh both the Data Connect SDK cache and the TanStack/locally rendered state; invalidating only TanStack is insufficient. Keep ordinary reads bounded and cached, preserve the existing booking server-refresh behavior and Stage 1 account/session fencing, and prevent earlier cached/in-flight reads from overwriting newer state.

Acceptance: booking approvals/rejections and attendance changes show confirmed rows/counts; payment polling reaches the server and terminates on confirmed outcomes; mutation dependencies cover subscriptions, profile/preferences, sections, groups, bookings and payments. A successful write followed by a failed refresh must report the saved-but-not-refreshed condition truthfully, retain recoverable input and offer a read retry without replaying the write.

Tests must model a primed stale SDK cache, assert server-read behavior and rendered values, revisit dependent views, and reject late results after session/account changes. Merely asserting `refetch` or invalidation calls is insufficient.

## Focused rendered-state regressions — #595, #596, #649

Apply the shared policy to user-group creation, ticket-type create/edit/delete and directory refresh. New/updated groups and tickets must appear immediately and remain selectable/reopenable; failures must not create phantom rows or lose retry data. Directory Refresh must update the member rows/counts and own loading/error state, with valid search/pagination after membership changes.

Component/integration tests must click the actual controls and assert different successive rendered responses, including mutation failure and refresh failure. Include event detail/list dependencies and navigation back to a previously cached view.

## Verified subscription identity — #652

Server-only group subscription and section-registration mutations must take an explicit user ID derived only from verified callable authentication. The client may not nominate another identity. Preserve current enabled/versioned authorization, subscribable-group validation, idempotency and denied/missing/disabled cases; regenerate SDKs reproducibly.

Tests must cover forged payload identity, both callable paths, idempotent membership insertion, rejection cases and the actual local Data Connect/database boundary. Use a disposable demo/emulator context only; mocks alone cannot establish the server-account identity behavior. Refresh membership-dependent views through the same shared freshness policy.

## Integration and release checks

Run focused behavior tests as each change lands, then frontend/Functions suites and coverage, lint/build/type checks, deployment-safety checks and the strict authorization inventory as appropriate. Independently review session/cache fencing and trusted identity changes. Retain explicit evidence and limitations for the local integration run; do not claim live acceptance from mocked tests. No cloud accounts, real subscriptions, financial activity or deployment are part of this implementation task.
