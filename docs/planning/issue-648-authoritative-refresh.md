# Authoritative refresh and mutation dependencies (#648)

Parent: #645; Stage 2 integration: `codex/data-correctness`. Related rendered regressions: #595, #596, #649; verified subscription identity: #652.

## Read policy

App-owned readers in `src/shared/query/authoritativeHooks.ts` use `dataConnectQueryOptions`. TanStack retains the application's ordinary 30-second stale cache; when a query actually executes, public Data Connect `SERVER_ONLY` execution refreshes the SDK cache as well. Generated SDK files are unchanged by this frontend policy. Imperative `executeDataConnectQuery` reads also default to server reads, with explicit fetch-policy overrides supported.

`refreshDataConnectQuery` cancels an older exact-key TanStack read, registers/fetches the authoritative query function, and updates both caches. Session tokens, authorization-read epochs, abort signals and per-reference generations fence late results and superseded requests. Prefix invalidation cancels affected in-flight queries and refetches cached active/inactive authoritative query functions with errors propagated. A caller must not interpret an invalidation/refetch failure as a failed write or automatically replay the write.

The SDK may still finish a cancelled transport and overwrite its own cache with an older response. App-owned readers therefore bypass that lower cache on every actual execution, and generation/session fences prevent the older result from replacing newer rendered/TanStack state. Cached views sharing these operations must use the app-owned reader policy; merely issuing one server read does not make later cache-preferring readers safe.

## Mutation dependency inventory

| Write / refresh trigger | Authoritative dependencies and rendered state |
| --- | --- |
| User group create/edit/delete and explicit group membership administration | `ListUserGroups`, `GetUserGroupById`, group member names/detail; current-user access/section/preference aggregate caches via shared access invalidation. The group list/detail is read from the server on initial/revisit and after mutation. |
| Event create/edit/delete | `GetEventsForSection`, selected `GetEventById`; close/reset selected state only after confirmed write; show a separate refresh warning if the saved list/detail cannot reload. |
| Ticket-type create/edit/delete | Selected `GetEventById` and `GetEventsForSection`; list, reopened form and member event lookup use authoritative state. |
| Booking approval/rejection; attendance create/edit/delete/restore | Event booking list/detail, event ticket orders and booking adjustments; dependent member booking/payment caches are invalidated. Approvals and payment state remain distinct. |
| Member booking draft/submit/amend/cancel and checkout creation | Existing event-first `refreshMyBookingsFromServer`, then `GetMyBookings`, `GetMyTicketOrders`, `GetMyBookingPaymentAdjustments`; booking wizard and cross-event history use the same authoritative reader policy. |
| Checkout reconciliation, payment polling and explicit payment Retry/Refresh | `GetMyTicketOrderById` server read, plus shared member booking/order/adjustment invalidation; reconciliation completion cancels a pre-write initial order request. Polling stays bounded and does not re-run payment creation. |
| Self-subscription/section registration and unsubscription | `GetUserAccessGroups`, `GetSectionsForUser`, and aggregate communication preferences; section metadata/member list callables refetch separately. The backend caller-binding change is in #652; browser payloads still contain only the group ID. |
| Section create/edit/delete and group-purpose links | Imperative section/list/detail reads are authoritative; shared section/access navigation caches are invalidated. Member section/event lookup callables already reach the server and retain their request guards. |
| Profile/privacy/review and membership status | Existing forced profile reload and Stage 1 own-status verification/read blockade remain; preference aggregates are refreshed after confirmed profile/review writes. Failed follow-up refresh offers a read-only retry rather than repeating the saved profile change. |
| Global/section announcement preferences | `GetMyAnnouncementPreferences` and all cached `GetSectionAnnouncementOptOut` variants; confirmed local/cache state remains visible if revalidation fails, with a read-only retry. Failed writes retain/revert the appropriate input with actionable feedback. |
| Directory Refresh (#649) | The merged member-directory callable, its own loading/error state and rendered rows/counts; search/pagination clamp to the returned data. Section metadata refresh alone is insufficient. |

Server webhooks and other sessions do not send arbitrary invalidation events to this browser. Payment polling and explicit refresh perform fresh reads; this change does not claim realtime updates from every external writer. Public bearer-capability queries keep their separate session boundary.

## Verification

Use actual installed Data Connect SDK tests with an in-memory transport to prime stale cache data, mutate server responses and observe forced reads, cross-view values and late-result fencing. Rendered MUI regressions exercise group/ticket/approval/attendance changes and directory controls. Test confirmed-write/failed-refresh/retry orderings and assert that retry does not call the write again. Keep the existing session/logout/own-status suites and ordinary cache reuse assertions. The #652 disposable local database run separately proves the server-account identity/transaction boundary; no browser mocks establish that result.
