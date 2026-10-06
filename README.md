# Cabivue

**Know what you have.** A self-hosted household medicine cabinet. Track physical packs and dates, review scanned labels, and prepare questions for a pharmacist or doctor.

## Development

Use Node 24.20.0 (`nvm use`), then:

```sh
npm ci
npm run setup
cp .env.example .env
npm run dev
```

Read `secrets/bootstrap` locally and use the one-time setup form at http://localhost:5173 to create your household account. The API reads `.env` via Node's environment loader (configured in the development script). No public registration. No AI key is needed for the inventory.

## Docker

```sh
npm run setup
docker compose up --build -d
```

Open http://localhost:3210 and complete setup. SQLite stays in the `cabivue-data` volume. `docker compose down` preserves it; do not add `-v` unless deliberately deleting your data. The final image serves the built frontend and API together as a non-root user.

For phone access, put the service behind an HTTPS reverse proxy. Set `CABIVUE_PUBLIC_ORIGIN` (Compose) or `APP_ORIGIN` (Node) to its exact HTTPS origin, `SECURE_COOKIES=true`, and `TRUST_PROXY` to the proxy's actual IP/CIDR. Change the host port binding only for your intended proxy/network. HTTP on a LAN address does not provide camera/PWA secure-context support.

## Checks

```sh
npm run check
npm run test:e2e
```

The project is being built in runnable stages. Provider features use simulated results during tests; no paid requests are made during development. This app does not diagnose or select medicines, and expiry information never establishes suitability for a person.
