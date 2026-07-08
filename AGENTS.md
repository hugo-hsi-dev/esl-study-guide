## Project Configuration

- **Language**: TypeScript
- **Package Manager**: pnpm
- **Add-ons**: prettier, eslint, vitest, playwright, tailwindcss, sveltekit-adapter, drizzle, better-auth, experimental

---

## Svelte syntax

Follow the official SvelteKit Remote functions, Svelte await expressions, and Svelte declaration tags docs. Use async Svelte with remote functions and direct `await` expressions, not `{#await}` wrappers. Use `{const ...}` / `{let ...}` declaration tags, not `{@const}`. Verify with `rg '\{#await|\{@const' src/routes src/lib` and the Svelte MCP autofixer in async mode for changed `.svelte` files.

---

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues; external PRs are not a triage request surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo uses the single-context layout: root `CONTEXT.md` plus `docs/adr/`. See `docs/agents/domain.md`.

### Codex environments

Use the Codex app UI for cloud and local environment setup. Do not hand-write `.codex/environment.toml`. See `docs/agents/environments.md`.
