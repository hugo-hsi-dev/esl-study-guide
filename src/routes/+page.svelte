<svelte:head><title>ESL Study Guide</title></svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-4">
	<header class="space-y-3">
		<p class="text-sm font-medium text-teal-700">ESL Study Guide</p>
		<h1 class="text-4xl font-semibold text-zinc-950">Assessment and study shell</h1>
		<p class="max-w-xl text-lg text-zinc-700">
			Sign in as the Learner to start the diagnostic flow, or as Admin to review the read-only
			account shell.
		</p>
	</header>

	<nav class="flex flex-wrap gap-3">
		<a class="rounded bg-zinc-950 px-4 py-2 font-medium text-white" href="/login">Sign in</a>
		<a
			class="rounded border border-zinc-300 px-4 py-2 font-medium text-zinc-950"
			data-sveltekit-preload-data="off"
			href="/assessment">Learner</a
		>
		<a
			class="rounded border border-zinc-300 px-4 py-2 font-medium text-zinc-950"
			data-sveltekit-preload-data="off"
			href="/admin">Admin</a
		>
	</nav>
</main>
