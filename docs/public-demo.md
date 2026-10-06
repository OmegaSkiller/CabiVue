# Public GitHub Pages demo

The public demo is a separate static build at
https://omegaskiller.github.io/CabiVue/. It uses fictional medicine packs and
simulated scans/interviews. It has no Express server, SQLite database, account
security, real OCR, or provider connection. Do not enter real health information.

Visitor changes exist only in memory in the current tab. Reloading or selecting
**Reset demo** restores the synthetic cabinet. Tabs and visitors have independent
state. Language/theme preferences remain browser preferences. Photos are previewed
locally; the demo does not read their contents, send them, or keep their bytes in
its data model. The simulated receipt is always the same fixture; it does not
identify duplicate real receipts. Server backups and provider-key forms are
available only in the self-hosted application.

Inventory input uses the shared runtime schemas. Expiry calculations and interview
safety states use the existing domain rules. Simulation is explicitly labeled;
these checks do not establish OCR accuracy, translation accuracy, clinical safety,
or suitability of any medicine. All bundled languages remain available.

## Local preview

```sh
npm ci
npm run build:demo
npm run preview:demo
```

Open http://127.0.0.1:5176/CabiVue/. `npm run test:pages` builds and tests this exact
subpath using a static preview server with no API. The service worker is scoped to
`/CabiVue/`, caches public files only, and supports loading the demo offline after
an initial visit. The existing UI disables edits while offline. Every reload
starts a new synthetic session, including an offline reload.

`npm run build` remains the full self-hosted build in `dist/web`.
`npm run build:demo` writes only public demo files to `dist/pages`. The runtime API
adapter in `src/web/demo/api.ts` is dynamically included only in the Pages mode.
It makes no network calls and stores no visitor data. The shared scan fixture
lives in `src/domain/simulation.ts`.

## Publication

Repository Pages source is **GitHub Actions**. CI tests the self-hosted app,
production PWA, static Pages demo and container before uploading the demo artifact
and deploying it. Only main-branch pushes or manual main-branch workflow runs
publish; pull requests run verification only. Actions are pinned to commits, and
Pages permissions are confined to the deployment job.

To stop publication, disable GitHub Pages in repository settings. To roll back,
revert the offending commit on main; the tested build will deploy after CI passes.
Do not upload databases, credentials, receipts, or bootstrap secrets to the Pages
artifact.
