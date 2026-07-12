<script lang="ts">
	import { page } from '$app/state';

	const content = $derived(
		page.status === 404
			? {
					eyebrow: 'Page not found',
					heading: 'We couldn’t find that page',
					message: 'The link may be old, or the page may have moved.'
				}
			: page.status === 403
				? {
						eyebrow: 'Access unavailable',
						heading: 'This area isn’t available for this account',
						message: 'Return home or sign in with the account that can open this page.'
					}
				: {
						eyebrow: 'Something went wrong',
						heading: 'Your study guide hit a problem',
						message: 'Your saved work is still safe. Try the page again, or return home.'
					}
	);
</script>

<svelte:head><title>{content.eyebrow} · ESL Study Guide</title></svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center gap-6 px-4 py-12">
	<header class="space-y-3">
		<p class="text-sm font-semibold uppercase tracking-wide text-teal-700">{content.eyebrow}</p>
		<h1 class="text-3xl font-semibold text-zinc-950 sm:text-4xl">{content.heading}</h1>
		<p class="max-w-lg text-zinc-700">{content.message}</p>
	</header>

	<div class="flex flex-wrap gap-3">
		<button
			type="button"
			class="min-h-11 rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
			onclick={() => window.location.reload()}>Try again</button
		>
		<a
			class="inline-flex min-h-11 items-center rounded-lg border border-zinc-300 px-5 py-2 font-medium text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
			href="/">Return home</a
		>
	</div>
</main>
