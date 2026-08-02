# Safe error handling

Issue #463 establishes the shared client-side contract for turning technical
failures into safe, useful display content. The broader #302 epic migrates each
application surface to this contract.

## Rule: map, report, display

Treat caught values as `unknown` and keep these operations separate:

1. **Map** the technical error with `toUserFacingError` or
   `toAuthUserFacingError` from `src/shared/errors`.
2. **Report** the original value with `reportError`, using a stable context name
   that contains no personal data or secrets.
3. **Display** only fields from the resulting `UserFacingError`.

Never render an arbitrary `error.message`, Firebase/provider code, stack trace,
SQL or Data Connect detail, Stripe response, storage detail, or callable message.
The raw exception belongs only in controlled logs or telemetry.

```ts
try {
  await performOperation();
} catch (error: unknown) {
  reportError("perform-operation", error);
  const displayError = toUserFacingError(error);
  setError(displayError);
}
```

`UserFacingError` provides a category, title, message, retryability flag, and an
optional recommended action. UI components should use `retryable` only when the
operation itself is safe to repeat.

## Provider and domain codes

`extractErrorCode` reads provider codes such as `functions/unavailable` and uses
them only for broad classification. `extractDomainErrorCode` reads a restricted,
application-owned code from callable `details.code` (or `customData.code` for
Firebase compatibility).

Domain features should provide their own reviewed code map:

```ts
const displayError = toUserFacingError(error, {
  domainErrors: {
    BOOKING_ALREADY_SUBMITTED: {
      category: "conflict",
      title: "Already booked",
      message: "You already have a booking for this event.",
      retryable: false,
    },
  },
});
```

Do not build a single global map of server message strings. Server copy is not a
stable API and may expose implementation details. Add stable domain codes to the
callable contract where they are missing.

## Authentication and privacy

`toAuthUserFacingError` centralises Firebase Auth mapping and takes a context so
registration, sign-in, account changes, and action links can give appropriate
guidance. Flows that could reveal whether an account exists must use neutral copy;
for example, invalid credentials, unknown users, and wrong passwords map to the
same sign-in response.

## Adding a mapping

- Prefer an existing category when only generic guidance is required.
- Add contextual Auth wording to `authErrors.ts`.
- Add business-rule wording in the owning feature, keyed by a stable domain code.
- Always retain the safe unknown fallback.
- Test the known code, malformed/unknown input, raw-message non-disclosure, and
  retryability or privacy behaviour.
