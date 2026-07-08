<script lang="ts">
	import type { PageServerData } from './$types';

	let { data }: { data: PageServerData } = $props();
</script>

<svelte:head><title>Assessment start</title></svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-8 px-4">
	<header class="space-y-3">
		<p class="text-sm font-medium text-teal-700">Learner</p>
		<h1 class="text-4xl font-semibold text-zinc-950">Find what to practice first</h1>
		<p class="max-w-xl text-lg text-zinc-700">
			Answer a few short questions. You will get a simple skill profile and one practice problem to
			start.
		</p>
	</header>

	<section class="space-y-4 border-l-4 border-teal-600 pl-5">
		<p class="text-sm text-zinc-600">Signed in as {data.learnerName}</p>
		<a class="inline-flex rounded bg-zinc-950 px-4 py-2 font-medium text-white" href="/assessment"
			>Start</a
		>
	</section>
</main>
