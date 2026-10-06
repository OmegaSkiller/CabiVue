# Operating one household instance

Use the pinned Node version or the production Compose build. This is a single-process, single-household application; do not share one database directory across multiple running application processes. No external database or provider key is required for inventory.

## Setup and access

Run `npm run setup` once to create `secrets/bootstrap` with mode 0600. Supply the secret in the initial setup form, then create a household username and password of at least 12 characters. The account uses a salted scrypt hash. There is no public registration. The setup secret cannot create another account after initialization.

Compose mounts the secret file at runtime and publishes port 3210 only on loopback. Configure an HTTPS reverse proxy for remote/phone access. Set the exact origin (scheme, host, and optional port, without a path) and secure cookies:

```dotenv
CABIVUE_PUBLIC_ORIGIN=https://cabinet.example.org
SECURE_COOKIES=true
TRUST_PROXY=172.20.0.2/32
```

The proxy address above is illustrative: use your actual trusted proxy address/CIDR and network route. The reverse proxy must preserve the host and forward the client scheme. Do not trust all proxies or log request bodies, cookies, credentials, photos, or interview answers. Keep access limited to your household.

## Backups and recovery

In **Settings → Backup & recovery**, download a JSON backup. It reads one consistent transaction of the live database, including pending WAL-backed changes. It contains products, physical packs, settings, locations, source metadata, receipt purchase lines/links, and consumed import IDs. It excludes credentials, sessions, keys, interview history, images, and active extraction drafts.

Downloads and recovery points are plaintext. Store them privately on protected storage and copy backups away from the instance volume. A recovery point in the same volume is protection against a mistaken restore, not disk loss. There is no automatic off-site backup scheduler.

To restore:

1. Finish or cancel active scans in every session. Save or discard other edits.
2. Select a Cabivue JSON backup under 8 MB. Review its date and record counts.
3. Type `RESTORE` and choose **Replace cabinet & sign out**.
4. Sign in with the existing household account. All sessions and provider keys were cleared.

The server validates the full schema and relationships, checks that the cabinet has not changed since preparation, and writes/fsyncs a mode-0600 recovery file before replacing records in one transaction. Product/pack revisions move forward so editors opened before restore cannot overwrite restored rows. Invalid input, stale preparation, or recovery-write failure prevents replacement.

Use **List recovery points** to download the preceding cabinet and restore it through the same flow. Files remain under `/data/recovery` in Docker until an operator removes them. There is no automatic pruning. Restore does not change the account; to recover into a fresh instance, initialize its account first, then restore the JSON file.

The logical format currently accepts up to 5,000 products/packs/purchase lines, 1,000 source records, 200 locations, and 10,000 consumed imports within the upload limit. It is designed for a small household. Keep periodic backups and monitor instance storage.

Do not copy only `cabivue.db` while the server is running: pending data can be in `cabivue.db-wal`. For a full account-preserving operator snapshot, cleanly stop the app and copy the entire data volume/directory, preserving ownership and permissions. Keep all SQLite files together. Never edit an active database file.

## Upgrades and rollback

Download a backup before upgrading. Record the current Git commit/image, then update the checkout and run `docker compose up --build -d`. Numbered SQL migrations run transactionally at startup. A migration failure aborts startup. Check `docker compose ps`, `/api/health`, sign-in, and your cabinet after replacement. Startup intentionally invalidates sessions and cancels pending extraction drafts.

Older binaries are not guaranteed to understand newer schemas. To roll back, stop the app, preserve the current volume, and use the matching previous image with its pre-upgrade full-volume snapshot. Prefer a corrected forward migration when appropriate. Never remove a volume as an upgrade step.

`docker compose down` removes containers/networks and keeps data. `docker compose down -v` deliberately deletes the instance volume. Export first if deleting the instance; local downloads are not removed by Compose. Keep `secrets/`, `.env`, database files, recovery exports, and real health records out of Git.

## Runtime state

Sessions last 12 hours. Keys and interviews live in session memory and clear at the expiry deadline, on logout/removal, restore, and restart. Provider requests are aborted when their session is destroyed. In-flight scan buffers are transient; provider consent is required for each request.

The service worker caches public assets only. Offline reload can show the public shell and urgent-help content; it cannot load private stock. An already-open page may retain fetched records in memory. Saving requires reaching the server. Updates wait for active edits, scans, or interviews.

The minimal health endpoint exposes only `{"status":"ok"}`. Docker checks it and runs as UID 1000 with a read-only root filesystem, bounded temporary storage, dropped capabilities, and no extra privileges. The writable data volume belongs to that user. Custom host bind mounts must supply compatible ownership; do not run the application as root to hide a permissions problem.
