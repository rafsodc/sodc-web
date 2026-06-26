# Epic #231 member UX — UAT runbook

Manual test plan for **`231-epic-ui-improvements`** before merging to `main`.

- **GitHub issue:** [#250](https://github.com/rafsodc/sodc-web/issues/250)
- **Epic:** [#231](https://github.com/rafsodc/sodc-web/issues/231)
- **Automation:** child PRs include unit tests and CI; this runbook covers journeys CI cannot fully verify (Stripe redirect, multi-step UX, copy).

Tick checkboxes in [#250](https://github.com/rafsodc/sodc-web/issues/250) as you complete each section. Link any defects as new issues and reference #231.

## When to run

| Pass | When |
|------|------|
| **Smoke** | After large child merges (#232, #234, #236, #245) — ~10 min |
| **Full UAT** | All child issues merged into `231-epic-ui-improvements`, **before** epic → `main` |

## Smoke checklist

- [ ] Enabled member can sign in and reach welcome/home without UID debug UI (#232)
- [ ] Sections list opens; one section loads (#238, #245)
- [ ] Events list shows upcoming; one event opens (#233)
- [ ] Header Account menu works (#236); Profile saves (#241)
- [ ] Stripe checkout return lands on `/payments` with notice (#237, #239)

## Full UAT — authentication and onboarding

Related: #232, #236, #241, #243, #244

- [ ] Logged-out `/` shows public home with Join / Log in (#243)
- [ ] Register → verification email flow (#244)
- [ ] Unverified user sees verification message; resend works
- [ ] Profile completion for new user; pending activation message (#244)
- [ ] PENDING user sees account status message; cannot access sections
- [ ] Approved user gains access; welcome dashboard (#232)
- [ ] `/account` when logged out: sign-in only; when enabled: not UID dump

## Full UAT — account and profile

Related: #236, #241

- [ ] Header dropdown: Account, Profile, My Bookings, My Payments, Log out
- [ ] Profile: edit name/service fields; no self-service membership status dropdown (#241)
- [ ] Account: change password (reauth if required) (#236)
- [ ] Account: resign flow (confirm, status → RESIGNED, access removed) — **dev test user only** (#236)
- [ ] RESIGNED user sees appropriate status message

## Full UAT — navigation and sections

Related: #238, #242, #245, #246, #248

- [ ] Side nav: sections, My Payments, My Bookings, admin links (if admin)
- [ ] Sections list: cards/descriptions, search (#238)
- [ ] Section detail tabs: About / Events / Members (#245)
- [ ] Labels: no raw enum strings in member UI (#242)
- [ ] Member directory: privacy matches agreed policy (#246)
- [ ] Back / breadcrumbs: section → event → back to events list (#248)

## Full UAT — events and booking

Related: #233, #234, #247, #235, #240

- [ ] Events tab: upcoming only by default; past events link (#233)
- [ ] Event detail: readable layout (#234)
- [ ] Booking wizard: ticket → guests → review → payment → confirmation (#234)
- [ ] Guest count over cap: moderation messaging (#234)
- [ ] Post-booking status panel on event page (#247)
- [ ] My Bookings hub lists cross-event bookings (#240)

## Full UAT — payments

Related: #237, #239, #234, #235

- [ ] Pay from booking flow; Stripe test card succeeds
- [ ] Return URL: `/payments?checkout=success&orderId=...` (#237)
- [ ] Checkout status notice shows success; dismiss works
- [ ] Cancel checkout shows cancel notice
- [ ] My Payments: friendly copy, receipt link when paid (#239)
- [ ] Unpaid hold expiry (#235) — note configured timeout if tested in dev

## Full UAT — regression and environments

- [ ] Desktop browser (Chrome or Firefox)
- [ ] Narrow viewport / mobile: header menu, side drawer, booking stepper
- [ ] Offline banner when network disabled
- [ ] Admin paths unchanged for admin test user (smoke only unless admin UX in scope)

## Sign-off

| Role | Name | Date | Pass? |
|------|------|------|-------|
| Dev | | | |
| Product / owner | | | |

**Notes / defects:** (link new issues from failures)

## Pre-merge automation sanity (dev)

Run on `231-epic-ui-improvements` before epic → `main`:

```bash
npm ci && npm test -- --run && npm run build
cd functions && npm ci && npm test && npm run build
```
