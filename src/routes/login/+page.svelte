<script lang="ts">
	import { getLoginPage, signInEmail, signUpEmail } from './data.remote';

	await getLoginPage();
</script>

<svelte:head><title>Sign in</title></svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4">
	<header class="space-y-2">
		<p class="text-sm font-medium text-teal-700">ESL Study Guide</p>
		<h1 class="text-3xl font-semibold text-zinc-950">Sign in</h1>
	</header>

	<form {...signInEmail} class="flex flex-col gap-4">
		<label class="flex flex-col gap-1 text-sm font-medium text-zinc-800">
			Email
			<input class="rounded border border-zinc-300 px-3 py-2" type="email" name="email" required />
		</label>

		<label class="flex flex-col gap-1 text-sm font-medium text-zinc-800">
			Password
			<input
				class="rounded border border-zinc-300 px-3 py-2"
				type="password"
				name="password"
				required
			/>
		</label>

		<button
			class="rounded bg-zinc-950 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
			disabled={signInEmail.pending > 0}
		>
			{signInEmail.pending > 0 ? 'Signing in...' : 'Sign in'}
		</button>
	</form>

	<form {...signUpEmail} class="flex flex-col gap-4 border-t border-zinc-200 pt-6">
		<label class="flex flex-col gap-1 text-sm font-medium text-zinc-800">
			Email
			<input class="rounded border border-zinc-300 px-3 py-2" type="email" name="email" required />
		</label>

		<label class="flex flex-col gap-1 text-sm font-medium text-zinc-800">
			Password
			<input
				class="rounded border border-zinc-300 px-3 py-2"
				type="password"
				name="password"
				required
			/>
		</label>

		<label class="flex flex-col gap-1 text-sm font-medium text-zinc-800">
			Name
			<input class="rounded border border-zinc-300 px-3 py-2" name="name" />
		</label>

		<button
			class="rounded border border-zinc-300 px-4 py-2 font-medium text-zinc-950 disabled:cursor-not-allowed disabled:text-zinc-400"
			disabled={signUpEmail.pending > 0}
		>
			{signUpEmail.pending > 0 ? 'Registering...' : 'Register'}
		</button>
	</form>

	{#each [...(signInEmail.fields.allIssues() ?? []), ...(signUpEmail.fields.allIssues() ?? [])] as issue, index (`${issue.message}-${index}`)}
		<p class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
			{issue.message}
		</p>
	{/each}
</main>
