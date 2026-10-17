# Phase-0 Capture Runbook — Shopmonkey behavioral study (clean-room)

Status: trial requested via web form 2026-10-17 (`submissionGuid b94a579f…`).
Onboarding is sales-led — expect a call within minutes to 1 business day.
App domain: `app.shopmonkey.cloud/login` (cloud app; pricing observed same day:
Basic $239/mo ×3 users, Clever $399, Genius $499, +$20/user — record actual
tier granted).

## What to request on the sales call
1. A trial of **Clever** (if offered) — it unlocks Customizable Workflow,
   Purchase Orders, Inventory Management: the workflow board is the core of
   our behavioral capture. Basic fallback is acceptable (DVI ×2 templates,
   e-signatures, 2-way SMS included).
2. Email confirmation that trial access is self-serve (no rep-only onboarding
   call for data entry).

## Account setup (user does, fictional data only)
- Garage name: `ተሞክሮ ጋራዥ Demo Garage` — never real business data.
- Customers/vehicles: 3–5 fictional (names like መብረብ ወ/አለም, plate 3-AA-12045).
- Payment methods: leave disabled/unconfigured (no real cards).
- No real phone numbers; use `+1 555 0100` style dummies so SMS never sends.

## Capture walkthroughs (10–15 min each, logged per flow)
For each flow: narrate intent → click through → note what appeared, in order.
Label every line **Observed** (on screen) or **Inferred** (my guess). No code
inspection, no CSS copying, no asset/name reuse — behavior only (brief §0 rules).

1. **Intake** — create order: required fields, vehicle lookup (VIN decode
   exists per pricing page), plate-only entry viability.
2. **Inspection / DVI** — template structure (2 templates on Basic), photo
   attach, how findings convert to estimate lines.
3. **Estimate build & send** — canned jobs/labor rates, parts pricing,
   approval-link generation, SMS/email compose surface.
4. **Customer approval link** — open the link as the customer (own browser,
   incognito): line selection? e-signature? expiry? impersonation checks?
5. **Approval → work** — status changes on approval; tech assignment; job
   board (workflow customization) states.
6. **Invoice** — auto-from-estimate? line diffs vs approved estimate; tax
   handling granularity (labor vs parts — matches our TOT 10%/2% question).
7. **Payment** — integrated payments screen ( observe only; no real charge),
   deposit/partial payments, refunds flow.
8. **Daily summary / reporting** — what the day-end report contains; both
   calendars visibility; export options.
9. **Notifications** — what SMS/email templates exist; reminder triggers;
   language (English-only?).
10. **Parts waitlist / POs** (Clever) — ordering surface, backorder handling.

## Evidence capture (per brief §18)
- Browser HAR from own session only (devtools → export) while walking flows.
- Screenshots of *screens* (behavioral evidence) allowed; never of code views.
- Log each flow immediately in `docs/phase0-observations.md` (create on first
  flow): date, flow #, Observed/Inferred lines, open questions for interviews.
- §18 readiness checklist: every checked box cites the runbook flow + date.

## REA usage
- REA MCP is registered in opencode config (restart opencode to load tools).
- Point REA at: the HAR + screenshots + the APK (if we ever pull the mobile
  app — via JADX, APK from own device backup only) — never their web bundle.
- Output: behavior spec deltas → feed brief §5f–g/§6 additions as Observed/Inferred.
