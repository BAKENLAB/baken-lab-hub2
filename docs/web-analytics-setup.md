# LAB HUB — Vercel Web Analytics rollout

## Scope
- Read-only pageview tracking for the **nine content pages**: index, TODAY, RESULT, NEXT, COURSE, BLOOD, JOCKEY, VALUE, BET.
- Do **not** track login or OAuth consent screens or call analytics from server-side APIs.
- A self-hosted Vercel relative URL is used: `/_vercel/insights/script.js`.
- No package dependencies; no changes to auth, middleware, DB, scoring, job queue, Cron, or access window (expires 2026-11-09 00:00 JST).

## Activation dependency
**Enabling the feature in Vercel is a separate required action.** Open the Vercel Dashboard > project `baken-lab` > Analytics > Enable. The client script cannot submit analytics until the Vercel-side feature is enabled and **a new deployment occurs**. See Vercel docs: https://vercel.com/docs/analytics/quickstart

Do not claim measurement works from code alone. After activation and deployment:
1. Open `https://baken-lab.vercel.app/` anonymously during the free-open period and verify no login redirect.
2. Verify `/_vercel/insights/script.js` loads (200) and the page sends a `/_vercel/insights/view` or Vercel-configured intake request.
3. View TODAY and RESULT and confirm they appear in Web Analytics > Pages; pageviews and visitors populate only from activation onward.
4. Confirm login and OAuth pages contain no tracking script.
5. On/after Nov 9 00:00 JST, confirm unauthenticated content requests still redirect to the login screen. Never weaken middleware to accommodate analytics.
6. Check analytics usage and plan allowance. Do not subscribe to a paid plan, enable Observability Plus, or accept chargeable upgrades as part of this change.

## Static verification
```sh
node --test automation/web-analytics-static.test.mjs
```

This change does not attempt to reconstruct pre-activation traffic; analytics events cannot be backfilled.
