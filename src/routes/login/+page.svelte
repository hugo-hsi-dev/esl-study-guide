<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<svelte:head><title>Sign in</title></svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4">
	<header class="space-y-2">
		<p class="text-sm font-medium text-teal-700">ESL Study Guide</p>
		<h1 class="text-3xl font-semibold text-zinc-950">Sign in</h1>
	</header>

	<form method="post" action="?/signInEmail" use:enhance class="flex flex-col gap-4">
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

		<div class="grid grid-cols-2 gap-3">
			<button class="rounded bg-zinc-950 px-4 py-2 font-medium text-white">Sign in</button>
			<button
				formaction="?/signUpEmail"
				class="rounded border border-zinc-300 px-4 py-2 font-medium text-zinc-950">Register</button
			>
		</div>
	</form>

	{#if form?.message}
		<p class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
			{form.message}
		</p>
	{/if}
</main>
