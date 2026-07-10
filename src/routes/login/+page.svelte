<script lang="ts">
	import { getLoginPage, signInUsername } from './data.remote';

	await getLoginPage();
</script>

<svelte:head><title>Sign in</title></svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4">
	<header class="space-y-2">
		<p class="text-sm font-medium text-teal-700">ESL Study Guide</p>
		<h1 class="text-3xl font-semibold text-zinc-950">Sign in</h1>
	</header>

	<form {...signInUsername} class="flex flex-col gap-4">
		<label class="flex flex-col gap-1 text-sm font-medium text-zinc-800">
			Username
			<input
				class="min-h-11 rounded border border-zinc-300 px-3 py-2"
				name="username"
				autocomplete="username"
				required
			/>
		</label>

		<label class="flex flex-col gap-1 text-sm font-medium text-zinc-800">
			Password
			<input
				class="min-h-11 rounded border border-zinc-300 px-3 py-2"
				type="password"
				name="password"
				autocomplete="current-password"
				required
			/>
		</label>

		<button
			class="min-h-11 rounded bg-zinc-950 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
			disabled={signInUsername.pending > 0}
		>
			{signInUsername.pending > 0 ? 'Signing in...' : 'Sign in'}
		</button>
	</form>

	{#each signInUsername.fields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
		<p class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
			{issue.message}
		</p>
	{/each}
</main>
