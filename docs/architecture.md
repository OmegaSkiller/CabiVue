# Architecture

Cabivue is one Node 24 application and one SQLite database. React/Vite compiles to
public files served by Express on the API's origin. Tailwind 4 and daisyUI 5 use
the supplied Cabivue theme; the frontend implements interaction semantics.

`Product` describes an identity/formulation; `Pack` describes physical inventory.
Ingredients are normalized and ordered, allowing combination products. Locations,
source facts, purchase metadata, import drafts/consumptions, account and session
records have separate tables. An unknown field stays null. Month-only expiry stays
month-only; the current month cannot imply a verified end-of-month convention.

All private endpoints authorize before fetching records. Mutations validate
shared Zod contracts, exact request origin and session CSRF token. Pack updates
compare a durable instance revision; products have their own revision too. Restore
allocates newer revisions, so a pre-restore editor cannot accidentally match a
restored row. Shared-product edits invalidate leaflet review and verified
prescription status without changing individual pack dates or quantities.
Parameterized SQL and foreign keys
protect relationships. Numbered migrations run transactionally at startup.

better-sqlite3 was selected for supported Node LTS builds, simple prepared SQL,
synchronous transactions, and online backup support. Synchronous transactions
fit one small household and keep import/restore commits atomic. This is not an
architecture intended for large shared multi-tenant workloads.

Passwords use Node scrypt with a random 32-byte salt, N=32768, r=8, p=1. Sessions
have random tokens, database token hashes, HttpOnly/SameSite cookies, and 12-hour
expiry. Startup invalidates sessions. Memory-only optional provider keys expire
with their session. Per-session expiry timers abort provider work and clear secrets
even when the browser sends no more requests. Restart and logout therefore cannot
leave reusable keys.

Expiry is date-only in the configured IANA timezone. The cabinet banner counts
active packs with null expiry regardless of the current search/filter. The review
action clears other filters and selects unknown dates. The same unknown state
renders card warnings and the empty field warning. Reminder status is derived
at read/render time, so it changes across household date boundaries.

## Ownership and data flow

`src/contracts` owns Zod schemas crossing browser/API/provider/backup boundaries.
`src/domain` owns date precision, extraction evidence checks, permitted source
revisions, and fixed interview escalation. `src/server` owns authorization,
media decoding, provider limits, and SQL transactions. `src/web` owns consent,
editable review, navigation preservation, and native dialog/focus behavior.

Images are decoded and re-encoded in bounded memory before provider processing.
Extracted values become expiring drafts, never stock. One confirmation path checks
edited fields and creates selected packs transactionally; durable consumption IDs
make retries idempotent. Receipt lines retain their own original quantity/prices;
multiple physical packs link to that line without inventing a divided price.

The assistant's provider step extracts quoted history spans. Application content
owns urgent action, scope limitations, and source cards; model output cannot
downgrade urgency, mutate inventory, or produce treatment instructions. A reviewed
source needs permission/provenance, a review date, and the exact product revision.
The same eligibility helper governs server context and rendered facts. No real
catalog is bundled, so the ordinary installation offers intake and inventory
organization while blocking medicine-specific information without evidence.

Logical backups omit secrets and transient drafts. Restore validates all durable
relationships, checks a current content revision, fsyncs a recovery point, then
replaces inventory in one immediate transaction. Account identity stays in place;
all sessions clear after success. Source product revisions are remapped only when
they match the restored identity. See [operations](operations.md).

## Tradeoffs

One synchronous SQLite process fits one small household and gives explicit atomic
ownership. It avoids distributed workers and offline conflict handling. Media and
provider work are bounded; private inventory requires connectivity. The service
worker precaches only public assets and does not intercept API navigation.

SQL row types are explicit; there is no ORM or separate repository abstraction.
New database changes use new numbered migrations. Do not edit an applied migration.
The pinned dependencies and Node image make clean public builds reproducible.
Tailwind scans only frontend sources, so documentation/tests cannot change the
production stylesheet between local and container builds.
