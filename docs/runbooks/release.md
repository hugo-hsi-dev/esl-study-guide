# Release runbook

Production promotion is manual. Never deploy application code that expects an unapplied D1 migration.

## One-time environment setup

- Production Worker: `esl-study-guide`, D1: `esl-study-guide-db`.
- Staging Worker: `esl-study-guide-staging`, D1: `esl-study-guide-staging`.
- Configure `BETTER_AUTH_SECRET` separately for each Worker (`pnpm auth:secret:staging`
  generates a staging-only value; `pnpm auth:secret:production` reads the production value from
  `.env`).
- Account usernames, passwords, and display names are seed-only values. They are not Worker runtime bindings.
- Keep account passwords and display names only in ignored `.env` / `.env.staging` files used by the seed command.

The Cloudflare token used for release work needs Workers Scripts, Worker Secrets, D1, and Workers AI permissions scoped to this account.

## Staging

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm check
pnpm test:server
pnpm test:browser
pnpm db:push:staging
pnpm auth:seed:staging
pnpm deploy:staging
curl --fail https://esl-study-guide-staging.hugo-hsi.workers.dev/health
pnpm test:e2e
```

Smoke-test Learner sign-in, assessment resume/completion, a five-problem practice session, Admin read-only access, role denial, and sign-out. Confirm Workers Logs contain no answers, transcripts, or audio.

For a non-mutating post-deploy check, load the fixed credentials privately and run:

```sh
RELEASE_SMOKE=1 PLAYWRIGHT_BASE_URL=https://example.workers.dev \
  node --env-file=.env ./node_modules/@playwright/test/cli.js test --grep "Release smoke"
```

## Production

1. Record the current Worker version and D1 Time Travel bookmark.
2. Export D1 to a secure temporary path.
3. Confirm the staging smoke test passed for the exact commit.
4. Apply migrations, seed the two configured accounts, then deploy code.

```sh
pnpm exec wrangler d1 migrations list DB --remote
pnpm exec wrangler d1 export DB --remote --output=/secure/tmp/esl-study-guide.sql
pnpm db:push:remote
pnpm auth:seed:remote
pnpm deploy:production
pnpm exec wrangler d1 migrations list DB --remote
curl --fail https://esl-study-guide.hugo-hsi.workers.dev/health
```

The final migration list must report no pending migrations. Check `/`, `/login`, Learner and Admin sign-in, protected-route redirects, D1 reads, and one Workers AI-backed request.

## Rollback

- Code: use `wrangler versions list`, then `wrangler rollback <VERSION_ID>`.
- Data: prefer a forward repair migration. For destructive or corrupt writes, restore the recorded D1 Time Travel bookmark or the pre-release export.
- After rollback, repeat the health and role-gate smoke checks and record the incident without learner content.
