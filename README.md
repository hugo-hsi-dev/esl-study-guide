# ESL Study Guide

Private SvelteKit study tool for exam-aligned ESL placement readiness baselines, teaching-led Adaptive Practice, spaced review, and evidence-based progress, backed by Cloudflare D1 and Workers AI. The tool supports explicit test profiles and does not claim to issue an official placement score.

## Development

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm gen
pnpm db:push
pnpm auth:seed
pnpm dev
```

`pnpm db:push` applies Drizzle-generated migrations to the local D1 database. Local D1 state lives under `.wrangler/state`, so each git worktree gets its own database.
`pnpm auth:seed` upserts the fixed Admin and Learner username/password accounts from `.env`. Better Auth still stores an email column internally; the seed command derives stable synthetic emails from the configured usernames, and those values are not login credentials.

For remote D1 setup, set the same fixed account env vars plus Cloudflare credentials, then run:

```sh
pnpm db:push:remote
pnpm auth:seed:remote
```

## Common Commands

```sh
pnpm check
pnpm lint
pnpm test
pnpm build
pnpm preview
```

Use `pnpm db:generate` after changing `src/lib/server/db/schema.ts`.

Production promotion is manual. See [the release runbook](docs/runbooks/release.md) for staging, D1 migration, smoke-test, and rollback steps.
