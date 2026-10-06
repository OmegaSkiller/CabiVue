# Contributing

Use Node 24.20.0 and `npm ci`. See the README for local setup and verification.

Keep business invariants in `src/domain`, runtime contracts in `src/contracts`,
authorization and transactions on the server, and interactions in `src/web`.
Make database changes with new numbered migrations; do not edit an applied migration.

Open an issue describing the user-visible problem before a large change. Pull
requests should explain behavior, evidence, and material limitations. Use emoji
plus Conventional Commits, such as `🐛 fix(inventory): preserve unknown expiry`.
Run `npm run check` and applicable browser tests before submitting.

Use synthetic fixtures. Never include real health records, receipts, keys,
credentials, or database files in issues, screenshots, commits, or logs. Do not
mark synthetic medicine information as clinically verified. Source contributions
need exact formulation, official provenance, revision, permission/license, and
an accountable review process. Do not add copied leaflets under the code license.

This app must not select treatments or generate dosing. Changes to intake or
medical wording require appropriate clinical and regulatory review before public
medical use. Keep the fixed urgency screen independent of AI.
