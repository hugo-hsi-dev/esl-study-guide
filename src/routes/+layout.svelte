<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { navigating } from '$app/state';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
{#if navigating.to}
	<div class="fixed inset-x-0 top-0 z-50 h-1 bg-teal-100" role="status" aria-live="polite">
		<div class="h-full w-1/2 animate-pulse bg-teal-700"></div>
		<span class="sr-only">Loading page…</span>
	</div>
{/if}
{@render children()}
