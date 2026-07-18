# Validation Evidence

## Local release candidate

Validated on July 17, 2026 before the v1.0.0 publication.

- Repository validator: passed. Checked required files, valid synthetic fixtures, AI and human-decision disclosures, privacy patterns, accessibility hooks, and workflow logic.
- Logic suite: passed. Covered extraction, classification, policy outcomes, blocked plans, response drafting, event construction, and export boundaries.
- Desktop browser: passed at 1440 x 1000. Completed both human approval gates, edited the response draft, and downloaded the local JSON record.
- Mobile browser: passed at 390 x 844 with no horizontal overflow.
- Blocked path: passed. The seat-mismatch request cannot be approved while required evidence is missing.
- Validation path: passed. Short request text produces an inline error instead of running the workflow.
- Keyboard path: passed. The skip link receives focus first and moves focus to the workflow.
- Loading failure: passed. A failed fixture request produces a visible recovery state and Retry control.
- Browser health: zero console errors and zero failed normal requests.
- Privacy scan: passed. No personal email address, API key, GitHub token, or private-key material is present in public project text.

## Visual evidence

- `docs/screenshots/reviewflow-approved-workflow.png`: 1440 x 2398 full-workflow desktop capture.
- `docs/screenshots/reviewflow-mobile-workflow.png`: 390 x 4221 full-workflow mobile capture.

## Deployment verification

Verified on July 17, 2026 at `https://jubjub-cpu.github.io/reviewflow-agent/`.

- GitHub Pages build: passed.
- Deployed browser suite: passed with the same desktop, mobile, keyboard, blocked-state, export, and recovery checks as local.
- Deployed browser health: zero console errors and zero failed normal requests.
- Public synthetic workflow fixture: HTTP 200.
- Published commit identity: author and committer use the GitHub no-reply address.

## v1.0.1 hardening

Validated locally on July 18, 2026.

- Added keyboard focus to the horizontally scrollable workflow-stage strip.
- Repository validator, logic tests, and local browser workflow passed.
- Local and deployed axe-core audits passed at desktop and mobile viewports with zero violations.
- The deployed browser workflow passed with zero console errors, failed requests, or desktop/mobile overflow.
