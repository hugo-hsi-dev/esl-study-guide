<script lang="ts">
	import { goto } from '$app/navigation';
	import { getLoginPage, signInUsername } from './data.remote';

	const page = await getLoginPage();
	const signInIssues = $derived(signInUsername.fields.allIssues() ?? []);

	$effect(() => {
		const redirectTo = signInUsername.result?.redirectTo ?? page.redirectTo;
		if (redirectTo) void goto(redirectTo);
	});
</script>

<svelte:head><title>Sign in</title></svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4">
	<header class="space-y-2">
		<p class="text-sm font-medium text-teal-700">ESL Study Guide</p>
		<h1 class="text-3xl font-semibold text-zinc-950">Sign in</h1>
	</header>

	<form {...signInUsername} class="flex flex-col gap-4">
		<input type="hidden" name="redirectTo" value={page.requestedRedirectTo} />
		<label class="flex flex-col gap-1 text-sm font-medium text-zinc-800">
			Username
			<input
				class="min-h-11 rounded border border-zinc-300 px-3 py-2 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
				name="username"
				autocomplete="username"
				aria-invalid={signInIssues.length ? 'true' : undefined}
				aria-describedby={signInIssues.length ? 'sign-in-errors' : undefined}
				required
			/>
		</label>

		<label class="flex flex-col gap-1 text-sm font-medium text-zinc-800">
			Password
			<input
				class="min-h-11 rounded border border-zinc-300 px-3 py-2 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
				type="password"
				name="password"
				autocomplete="current-password"
				aria-invalid={signInIssues.length ? 'true' : undefined}
				aria-describedby={signInIssues.length ? 'sign-in-errors' : undefined}
				required
			/>
		</label>

		<button
			class="min-h-11 rounded bg-zinc-950 px-4 py-2 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 disabled:cursor-not-allowed disabled:bg-zinc-400"
			disabled={signInUsername.pending > 0}
		>
			{signInUsername.pending > 0 ? 'Signing in...' : 'Sign in'}
		</button>
	</form>

	<div id="sign-in-errors" aria-live="assertive" aria-atomic="true">
		{#if signInIssues.length}
			<div class="space-y-2" role="alert">
				{#each signInIssues as issue, index (`${issue.message}-${index}`)}
					<p class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
						{issue.message}
					</p>
				{/each}
			</div>
		{/if}
	</div>

	{#if signInUsername.result?.redirectTo}
		<p
			class="rounded border border-teal-200 bg-teal-50 px-3 py-2 text-sm text-teal-800"
			role="status"
		>
			Signed in. Redirecting…
		</p>
	{/if}
</main>
