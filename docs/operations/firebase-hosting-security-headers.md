# Firebase Hosting security headers

Firebase Hosting applies the policy in [`firebase.json`](../../firebase.json) to every hosted path
before rewrite processing. This covers the SPA document and assets, deep-link rewrites to
`index.html`, and the `/unsubscribe` Function rewrite.

## Policy

| Header | Decision |
|---|---|
| `Content-Security-Policy` | Default to same-origin content; deny plugins, framing, and foreign form targets; allow only the Firebase, Google Analytics, and reCAPTCHA origins required by browser code. |
| `X-Content-Type-Options` | `nosniff` prevents MIME-type guessing. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` retains same-origin diagnostics without leaking paths to external sites. |
| `Permissions-Policy` | Disables camera, microphone, geolocation, payment, USB, and unused motion/media capabilities. |
| `X-Frame-Options` | `DENY` backs up CSP `frame-ancestors 'none'` for older clients. |

MUI/Emotion generates style elements at runtime, so `style-src` retains `'unsafe-inline'`.
JavaScript does not allow `'unsafe-inline'` or `'unsafe-eval'`.

### Allowed browser services

- Firebase Authentication: Identity Toolkit, Secure Token, and each environment's
  `*.firebaseapp.com` auth frame.
- callable Functions: the fixed `europe-west2` endpoint for Dev, Beta, and Prod.
- Data Connect: `firebasedataconnect.googleapis.com`.
- App Check: `firebaseappcheck.googleapis.com` plus the
  [reCAPTCHA CSP origins](https://developers.google.com/recaptcha/docs/faq#im_using_content-security-policy_csp_on_my_website_how_can_i_configure_it_to_work_with_recaptcha).
- optional Firebase Analytics: Firebase web configuration, Google Tag Manager, and Google Analytics collection origins.

Stripe is intentionally absent from the CSP allowlist. The application assigns the Checkout
Session URL to `window.location`, sending the browser to a
[Stripe-hosted page](https://docs.stripe.com/payments/checkout/how-checkout-works); it does not
embed Stripe scripts, frames, or API calls in the application origin. GOV.UK Notify is server-side,
and links from email are ordinary top-level navigation, so it also needs no browser CSP source.

## HSTS ownership

Do not configure `Strict-Transport-Security` for the current default Hosting domains. Firebase
[overwrites HSTS on `*.web.app` and other default subdomains](https://firebase.google.com/docs/hosting/full-config#headers),
and live checks on 17 July 2026 confirmed that Dev, Beta, and Prod return:

```text
strict-transport-security: max-age=31556926; includeSubDomains; preload
```

If a custom domain is connected, revisit this decision before launch. Firebase serves the
repository-configured HSTS value on custom domains, so confirm HTTPS coverage and ownership of all
subdomains before adding `includeSubDomains` or `preload`.

## Deployment verification

For a full-stack release, complete the Data Connect and Functions checkpoints in the [central rollout runbook](./environments-dev-beta-prod.md#full-stack-rollout-sequence) before this Hosting step. For a Hosting-only change, deploy to Beta first:

```bash
npm run build
firebase deploy --only hosting --project beta
curl -sS -D - -o /dev/null https://sodc-web-beta.web.app/
curl -sS -D - -o /dev/null https://sodc-web-beta.web.app/sections/example
```

Confirm the five configured headers appear on both responses, HSTS remains present, and the CSP
has not been duplicated or truncated. Then smoke-test:

1. registration, email/password sign-in, sign-out, and account settings;
2. section/event Data Connect reads and a callable Function action;
3. App Check/reCAPTCHA with `VITE_RECAPTCHA_SITE_KEY` configured;
4. Analytics collection when a measurement ID is configured;
5. Stripe Checkout redirect, return, and receipt links; and
6. announcement unsubscribe GET redirect and one-click POST.

Use the browser console and Network panel to investigate CSP violations. Add an origin only after
confirming which application feature requires it; do not add broad `https:` or wildcard Google
sources to silence violations.
