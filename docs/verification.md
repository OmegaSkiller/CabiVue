# Verification evidence

Checks use synthetic products, receipts, images, credentials, and reported history.
They prove application behavior and handling of mocked provider output. They do
not establish live OCR accuracy, clinical safety, real catalog coverage, or an
external deployment.

## Local checks completed

| Proof                                        | Result                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------- |
| TypeScript, production frontend/server build | Passed                                                                            |
| Vitest domain/API/provider tests             | 30 passed                                                                         |
| Playwright browser flows                     | 4 passed                                                                          |
| Production service-worker browser flow       | 1 passed                                                                          |
| Layout widths                                | 320, 360, 390, 768, 1024, 1440 px                                                 |
| axe checks                                   | Cabinet/dialogs in both themes, scan review, recovery settings                    |
| Docker ARM64 build/runtime                   | Passed; UID 1000, actual health check                                             |
| Docker recovery/persistence                  | Export/restore and preceding recovery artifact; same-volume container replacement |
| Runtime secrets                              | Session/key cleared after logout, idle expiry, restore, restart                   |

The API tests cover independent pack dates, combination ingredients, stale pack
and product changes, origin/CSRF protection, image validation, bounded provider
failure handling, atomic/idempotent imports, quoted history/reference validation,
and application-controlled urgency. Recovery tests use the downloaded JSON
artifact, preserve normalized receipt links/totals, reject invalid relationships
and stale preparation, preserve the account, and reject pre-restore editor versions.

The production browser test controls a real service worker. A changed worker waits
while settings are unsaved; the draft remains intact. Cached requests are all on
the app origin and contain no API paths. Offline private requests fail, an offline
reload serves the public shell without stock, and reconnect loads current records.

Actual synthetic screenshots are in [screenshots](screenshots/). The brandkit
overview board is a design concept and is not used as application proof.

## Public CI

[GitHub Actions](https://github.com/OmegaSkiller/CabiVue/actions/workflows/ci.yml)
runs three gates on pushes and pull requests: checks, browser/PWA, and container.
Actions are pinned to release commits and repository permissions are read-only.
The container gate builds/runs on Ubuntu Linux AMD64 and checks persistent data
after replacement. Its per-commit result is separate from local ARM64 proof;
inspect the green run for the commit being reviewed. There is no deployment job.

Reproduce with the commands in the README. Docker checks create unique disposable
containers/volumes and remove them in `finally`; browser checks use temporary
databases. Production PWA checks copy the built shell into an isolated temporary
directory. No real private data or paid provider request is needed.

## Remaining evaluation

No live OpenAI call or real OCR dataset was evaluated. The supported model and
official API capability evidence are recorded in [provider evaluation](provider-evaluation.md).
Camera capture, installation prompts, and browser behavior on physical iOS/Android
devices still need device testing. Chromium responsive checks do not establish
cross-browser/device support. No clinical/regulatory review or trademark clearance
is claimed. No external service has been deployed.
