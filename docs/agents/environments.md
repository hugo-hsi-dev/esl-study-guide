# Codex Environments

Do not hand-write `.codex/environment.toml`. Create or update local environments through the Codex app UI. This file records the values to enter.

Sources:

- SvelteKit remote functions: https://svelte.dev/docs/kit/remote-functions
- Codex cloud environments: https://developers.openai.com/codex/cloud/environments
- Codex agent internet access: https://developers.openai.com/codex/cloud/internet-access
- Codex local environments: https://developers.openai.com/codex/app/local-environments
- Codex worktrees: https://developers.openai.com/codex/app/worktrees

## Cloud Environment

Name: `ESL Study Guide`

Runtime/package versions:

- Node.js: active LTS
- Package manager: `pnpm` via Corepack

Environment variables available to setup and agent phases:

```sh
ORIGIN=http://localhost:4173
BETTER_AUTH_SECRET=0123456789abcdef0123456789abcdef
GITHUB_CLIENT_ID=test-client-id
GITHUB_CLIENT_SECRET=test-client-secret
ADMIN_EMAILS=admin@example.com
```

Use dummy auth values in the agent environment. Codex cloud secrets are only available to setup scripts, so values required by `pnpm build`, `pnpm check`, `pnpm test`, or `pnpm preview` must be regular environment variables.

Optional Cloudflare variables for a separate D1-maintenance environment:

```sh
CLOUDFLARE_ACCOUNT_ID=<account id>
CLOUDFLARE_D1_DATABASE_ID=<database id>
```

Secret for that D1-maintenance environment only:

```sh
CLOUDFLARE_API_TOKEN=<token with D1 permissions>
```

Default setup script:

```sh
set -euo pipefail
corepack enable
pnpm install --frozen-lockfile
pnpm gen
pnpm exec playwright install --with-deps chromium
```

Maintenance script:

```sh
set -euo pipefail
corepack enable
pnpm install --frozen-lockfile
pnpm gen
pnpm db:push
```

Do not run `pnpm db:push` in the default cloud setup. Use a separate, explicit D1-maintenance environment if a task is specifically about remote D1 schema work.

Internet access:

- Agent internet access: `On`
- Preset: `Common dependencies`
- Additional domains:

```text
api.github.com
better-auth.com
developers.cloudflare.com
developers.openai.com
docs.github.com
developer.mozilla.org
orm.drizzle.team
playwright.dev
pnpm.io
svelte.dev
tailwindcss.com
typescriptlang.org
vite.dev
```

Allowed HTTP methods for the default coding environment: `GET`, `HEAD`, `OPTIONS`.

If a task needs GitHub mutations, package publishing, or another write-capable API, create a task-specific environment or temporarily widen methods after reviewing the risk. Keep secrets out of the default agent phase.

## Local Worktree Environment

Name: `ESL Study Guide Worktree`

Setup script:

```sh
set -euo pipefail
corepack enable
test -f .env || { echo "Missing .env. Create it in the source checkout so .worktreeinclude can copy it into this worktree."; exit 1; }
pnpm install --frozen-lockfile
pnpm gen
pnpm db:push
```

Cleanup script:

```sh
true
```

No cleanup is currently needed. Codex removes managed worktrees on archive, including the local D1 state under `.wrangler/`, and this project does not start Docker containers or other external services in setup.

Actions:

| Name    | Icon     | Script                         |
| ------- | -------- | ------------------------------ |
| Dev     | play     | `pnpm dev -- --host 127.0.0.1` |
| Check   | check    | `pnpm check`                   |
| Lint    | search   | `pnpm lint`                    |
| Test    | flask    | `pnpm test`                    |
| Unit    | terminal | `pnpm test:unit -- --run`      |
| E2E     | monitor  | `pnpm test:e2e`                |
| Build   | package  | `pnpm build`                   |
| Preview | globe    | `pnpm build && pnpm preview`   |

Ignored local files copied into Codex-managed worktrees are listed in `.worktreeinclude`. Create `.env` in the source checkout before creating a managed worktree. Tracked files such as `.env.example`, `pnpm-lock.yaml`, and `wrangler.jsonc` are already present in each worktree.
