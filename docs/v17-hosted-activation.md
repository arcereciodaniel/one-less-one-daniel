# V17 hosted activation — gated checklist (not deployed)

Release branch only; never dispatch the production Cloudflare or Pages workflows. Only synthetic data. No real backup import in mobile-enabled staging.

## Gate A — code and local validation
- Latest candidate, staging and mobile bridge workflows green for the selected exact commit, not earlier commits.
- Build both packages from that same commit; inspect artifacts, no production credentials or real data.
- Verify historic preservation, split participant totals and ack retry.

## Gate B — Cloudflare account owner
- In the correct Cloudflare account, check free-plan entitlements and quota, workers.dev subdomain and unique project name. No paid plan or production changes.
- Create a distinct Pages project named one-less-one-v17-daniel-staging using direct upload. Verify actual HTTPS origin matches the exact allowlist.
- Create a distinct D1 named one-less-one-mobile-v17-staging. Verify its UUID is different from Daniel's existing D1 in the dashboard before applying staging/schema.sql. Never apply that schema to the production database.
- Create distinct Worker one-less-one-mobile-v17-staging and verify hostname one-less-one-mobile-v17-staging.one-less-one-rastro.workers.dev. If not available, stop and update the fixed host allowlist, CORS and CSP in code before deployment.
- Use only new random independent staging mobile and desktop secrets through dashboard or Wrangler secret commands; never paste keys into chat, repository or logs. Keep production secrets and databases untouched.
- Deploy the generated isolated Worker package with the verified new D1 binding, not the production config. Do not use the deliberately invalid UUID as-is.
- Upload only the mobile bridge synthetic web artifact to the dedicated Pages project. Keep offline staging separate. Verify noindex, no-store and CSP; the public test project is not an authentication boundary.
- Check health and CORS from the intended origin and denial of the production origin. Use a synthetic catalog.

## Gate C — real iPhone
- Create a separate shortcut labeled OLO V17 Prueba pointing to the verified staging Worker. Do not edit existing shortcut.
- Register synthetic CRC expense, USD income, individual collection and split collection. Enter a synthetic historic exchange rate when needed and use a date in the sample payroll calendar.
- Sync manually in staging settings using the staging desktop key. Verify each row, FX, group, participant amounts, original expense not duplicated and pending inbox cleared after acknowledgement.
- Repeat synchronization and reload; ensure no duplicate records. Verify production and its shortcut remain unchanged.
- Share only pass/fail and non-sensitive diagnostic codes. No keys or personal financial records.

## Status
This is a runbook, not execution. Cloudflare account access, host availability, free-plan eligibility, deployment, actual iPhone validation and recovery after production upgrade remain unverified. No resources created or charged by this work. Do not publish V17.
