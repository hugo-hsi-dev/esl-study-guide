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
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin-password
ADMIN_NAME="Test Admin"
LEARNER_USERNAME=learner
LEARNER_PASSWORD=learner-password
LEARNER_NAME="Test Learner"
```

Use dummy auth values in the agent environment. Codex cloud secrets are only available to setup scripts, so values required by `pnpm build`, `pnpm check`, `pnpm test`, or `pnpm preview` must be regular environment variables.

Optional Workers AI variables for live provider work:

```sh
CLOUDFLARE_ACCOUNT_ID=<account id for opt-in ai/run checks>
CLOUDFLARE_API_TOKEN=<token with Workers AI permissions for opt-in ai/run checks>
WORKERS_AI_TEXT_MODEL_ID=@cf/zai-org/glm-4.7-flash
WORKERS_AI_TRANSCRIPTION_MODEL_ID=@cf/openai/whisper-large-v3-turbo
WORKERS_AI_TTS_MODEL_ID=@cf/myshell-ai/melotts
```

The deployed app should prefer the Workers AI binding (`env.AI.run`). Use REST `ai/run` only for opt-in checks outside the Worker binding path. Local and test runs use deterministic stubs when the binding or live credentials are absent. Do not add AI Gateway rerouting, direct provider SDKs, or direct provider API keys to the MVP app. Scope `CLOUDFLARE_API_TOKEN` to the task-specific environment.

Optional Cloudflare variables for a separate D1-maintenance environment:

```sh
CLOUDFLARE_ACCOUNT_ID=<account id>
CLOUDFLARE_D1_DATABASE_ID=<database id>
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
pnpm auth:seed
```

Do not run `pnpm db:push` in the default cloud setup. Use a separate, explicit D1-maintenance environment if a task is specifically about remote D1 schema work.

Internet access:

- Agent internet access: `On`
- Preset: `Common dependencies`
- Additional domains:

```text
api.github.com
api.cloudflare.com
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

The seed script derives internal Better Auth email-column values from `ADMIN_USERNAME` and `LEARNER_USERNAME`. Those synthetic emails are implementation details only; setup and login stay username/password-only.

For remote D1 maintenance, set the fixed account variables and Cloudflare D1 credentials, then run:

```sh
pnpm db:push:remote
pnpm auth:seed:remote
```
