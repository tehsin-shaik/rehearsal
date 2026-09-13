# Deployment

## Standard Node host

Node 24 is the supported runtime. Install from the committed lock, build, and start:

```sh
npm ci
npm run check
npm start
```

Both demo flags default to `true`. `NEXT_PUBLIC_DEMO_MODE` is a build-time setting: changing modes requires rebuilding. Configure `REHEARSAL_BASE_URL` to the actual browser origin for live requests. HTTPS is required outside localhost. The app emits content-type, framing, referrer and permissions headers.

The Dockerfile builds Next's standalone output and runs it as an unprivileged user. A demo container can be built with `docker build -t rehearsal .` and started with `docker run --rm -p 3000:3000 rehearsal`. The container recipe is supplied for review; Docker deployment has not been performed in this workspace.

## Optional Cloudflare demo

The `deployment/cloudflare` directory contains explicit example configuration. It is intended for **Demo Mode only**. Follow the current [OpenNext Cloudflare installation guide](https://opennext.js.org/cloudflare/get-started), install its adapter and Wrangler, and copy the two `.example` files to the repository root as `open-next.config.ts` and `wrangler.jsonc`.

```sh
npm install --save-dev @opennextjs/cloudflare wrangler
npx opennextjs-cloudflare build
npx opennextjs-cloudflare preview
```

Confirm the selected adapter supports this project's Next version before deployment. The template is optional and is not part of the verified Node build. Do not enable live adapters on it: in-memory sessions/receipts do not form a reliable shared Worker store, and the optional loopback IMAP/SMTP/CopilotKit process is unavailable there.

## Before hosting live credentials

A long-lived single Node process can run the local live prototype behind authenticated access. Scaling or restarting it changes the safety guarantees. Production infrastructure must provide:

- Tenant-scoped authentication/authorization instead of a shared local access key.
- Durable plans, approvals, action receipts and job states with transactional uniqueness.
- A durable queue, per-run lease and vendor-specific reconciliation for uncertain writes.
- Protected secret storage, rotation, audit retention and operational alerting.
- Deployment-specific rate limits, request limits and restrictive outbound access.
- Real-account acceptance checks for every enabled adapter and extension surface.

Do not configure automatic retries for non-idempotent sends after an unknown network outcome. Inspect the actual destination first. This repository does not claim cross-restart exactly-once delivery.
