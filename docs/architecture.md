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
compare a monotonically increasing version. Parameterized SQL and foreign keys
protect relationships. Numbered migrations run transactionally at startup.

better-sqlite3 was selected for supported Node LTS builds, simple prepared SQL,
synchronous transactions, and online backup support. Synchronous transactions
fit one small household and keep import/restore commits atomic. This is not an
architecture intended for large shared multi-tenant workloads.

Passwords use Node scrypt with a random 32-byte salt, N=32768, r=8, p=1. Sessions
have random tokens, database token hashes, HttpOnly/SameSite cookies, and 12-hour
expiry. Startup invalidates sessions. Memory-only optional provider keys expire
with their session. Restart and logout therefore cannot leave reusable keys.

Expiry is date-only in the configured IANA timezone. The cabinet banner counts
active packs with null expiry regardless of the current search/filter. The review
action clears other filters and selects unknown dates. The same unknown state
renders card warnings and the empty field warning. Reminder status is derived
at read/render time, so it changes across household date boundaries.
