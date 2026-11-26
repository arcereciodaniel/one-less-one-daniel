# V15.0 emergency recovery (2026-11-26)

Restore the exact V12.1.3 financial model and UI (e82b7924), with a narrowly scoped local backup guard before legacy migration. V14.5 code is retained on rescue/v14-5-before-v15. The visible version remains v12.1.3 to indicate the restored UI and satisfy its original build assertions.

The first load with existing local records creates a separate exact copy under STORAGE_KEY + "_pre_v15_recovery_v1" without overwriting an existing copy. A failed backup blocks financial writes; the primary storage key is unchanged. Legacy migration retains unknown top-level fields, including flexBudgets and livingBudgets, but the original budget engine does not apply them. Do not merge or delete such adjustments without reconciling a user-provided backup. No financial data is sent to GitHub. Daniel and Lab retain their respective independent keys.

User validation of the actual browser ledger is still required before resuming budget edits. Gloriana is out of scope.
