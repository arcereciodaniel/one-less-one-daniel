# V17 forecast reconciliation — staged hardening

All three workflows at commit 1907cde passed, including historical append-only mobile import. This change does not deploy or modify main.

The dated scenario remains deliberately partial. Pending items now use separate namespaces so a plan identifier cannot collide with a project, collection or native event. Explicit matching removes only the verified pending item, with no change to actual cash events. Missing salary-period coverage is reported, without imputing spending. Duplicate native debt occurrences and invalid dates suppress the numerical forecast rather than display a misleading balance. Overdue debt dates are flagged as provisional. Existing selector and visual hierarchy are unchanged; new explanatory text lives inside the existing review disclosure.

Still open: explicitly authorized USD debt equivalence, treatment of reimbursements and commitments without dated links, and broader functional parity (archives, exports, salary settings). No full forecast or actual device/Cloudflare validation claimed. CI pending on this commit.
