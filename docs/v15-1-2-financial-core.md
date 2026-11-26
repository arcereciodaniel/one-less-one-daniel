# V15.1 / V15.2 — development only

No app-shell, CSS, generated HTML, build scripts, persistence, mobile, production or Lab changes. This pure CommonJS prototype is not loaded by the app. Production remains on the V15.0 recovery. 

V15.1: auditLedger reports record counts, duplicate IDs/period slots, malformed budget amounts/currencies and missing category references; flags experimental V13/V14 records for manual reconciliation. No personal data is read by GitHub. A local user backup is required to reconcile actual adjustments; do not automatically merge or delete them.

V15.2: queryBudget(raw, scope, endFor) requires explicit financial or calendar basis and the original period end resolver. Financial month/quarter/half/year select the original budgetMonth labels; fortnight selects original period key. Calendar week starts Monday, month/quarter/half/year use calendar boundaries, custom requires explicit dates. Whole periods sum original category amounts in integer minor units per currency, never mixed or converted. Partial intersections are not prorated: totals=null, knownSubtotal reports whole periods only; gaps and missing financial slots are explicit. Unknown or ambiguous periods are rejected. This is a budget allocation query, not a cash-balance, actuals, income schedule or forecast engine. Actuals and adapters to existing UI/legacy totals need separate integration and regression validation. 

Next: validate with anonymized copy of user data locally, compare original engine outputs, then build a separately deployable Lab candidate before any user-visible work. Do not promote this branch without approval.
