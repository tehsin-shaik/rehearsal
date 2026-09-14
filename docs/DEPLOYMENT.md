# Deployment

## Normal Next.js Build

```bash
npm install
npm run check
npm run build
npm run start
```

The production server listens according to Next.js defaults unless the hosting platform supplies `PORT` or other standard configuration. Deploy Demo Mode unless live credentials and operational review are intentionally provided.

## Environment

Use the hosting platform's encrypted environment or secret manager. Do not upload `.env.local`. Set `DEMO_MODE=true` and build with `NEXT_PUBLIC_DEMO_MODE=true` for the default offline experience.

For live mode, set both values to `false` before building and configure only the integrations being used. See `docs/INTEGRATIONS.md` and `docs/KEYS.md`.

## Cloudflare Workers with OpenNext

The repository includes:

- `open-next.config.ts` — OpenNext Cloudflare adapter configuration;
- `wrangler.jsonc` — Worker entry point, Node compatibility, static assets, and safe Demo Mode defaults;
- `public/_headers` — immutable caching for Next.js static assets;
- `next.config.ts` — unoptimized images and local Cloudflare development initialization.

Build without deploying:

```bash
npm run build:cloudflare
```

Build and preview in the Workers runtime:

```bash
npm run preview:cloudflare
```

Deployment is deliberately never run by `npm run check` or any verification command. After reviewing the generated Worker, account, route, and secrets, deploy explicitly:

```bash
npm run deploy:cloudflare
```

The checked-in Wrangler configuration contains no secrets and deploys Demo Mode by default. Add production secrets with Cloudflare's secret tooling rather than `vars` or source control.

## Runtime Limits

Cloudflare Demo Mode is the supported Worker configuration. Gmail IMAP requires direct TCP behavior, and the prototype OAuth token store uses local filesystem persistence. Run those live capabilities on a persistent Node.js host or replace them with platform-native durable adapters before a Worker live deployment.

The in-memory observation buffer, idempotency cache, application state, and demo adapters are process-local. Server restarts clear them. A production multi-user deployment needs authenticated users, durable encrypted state, distributed idempotency, and an external OAuth token store.

Live HTTP routes do not implement end-user authentication or tenant isolation. Keep the default Demo Mode for public previews. Before exposing live mode, add an authenticated application boundary, per-user authorization, CSRF protection appropriate to the host, request-rate controls, durable audit storage, and distributed idempotency.

## Release Checklist

1. Confirm `npm run check` and `npm run build` pass.
2. Run the app and inspect all product routes at desktop and mobile widths.
3. Keep Demo Mode enabled unless live behavior is intentional.
4. Review configured adapter targets and least-privilege scopes.
5. Confirm no `.env`, `.dev.vars`, `.rehearsal`, `.next`, `.open-next`, logs, caches, or dependencies are tracked.
6. Run read-only live checks when credentials exist.
7. Do not enable external-write verification against persistent systems.
8. Deploy explicitly; no repository script deploys as part of validation.
