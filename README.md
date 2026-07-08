# ESL Study Guide

SvelteKit app for an ESL assessment and adaptive practice loop, backed by Cloudflare D1.

## Development

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm gen
pnpm db:push
pnpm dev
```

`pnpm db:push` applies Drizzle-generated migrations to the local D1 database. Local D1 state lives under `.wrangler/state`, so each git worktree gets its own database.

## Common Commands

```sh
pnpm check
pnpm lint
pnpm test
pnpm build
pnpm preview
```

Use `pnpm db:generate` after changing `src/lib/server/db/schema.ts`.
