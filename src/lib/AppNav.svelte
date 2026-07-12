<script lang="ts">
	import { signOut } from '$lib/auth.remote';

	let {
		current,
		admin = false
	}: {
		current: 'study' | 'assessment' | 'practice' | 'progress' | 'guide' | 'admin';
		admin?: boolean;
	} = $props();

	const links = $derived(
		admin
			? [{ href: '/admin', label: 'Admin', id: 'admin' as const }]
			: [
					{ href: '/study', label: 'Today', id: 'study' as const },
					{ href: '/assessment', label: 'Diagnosis', id: 'assessment' as const },
					{ href: '/practice', label: 'Practice', id: 'practice' as const },
					{ href: '/progress', label: 'Progress', id: 'progress' as const },
					{ href: '/guide', label: 'Test guide', id: 'guide' as const }
				]
	);
</script>

<header class="border-b border-zinc-200 bg-white">
	<div
		class="mx-auto grid min-h-16 w-full max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:flex sm:flex-wrap sm:gap-4"
	>
		<a
			class="font-semibold text-zinc-950 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700"
			href={admin ? '/admin' : '/study'}
		>
			ESL Study Guide
		</a>
		<nav class="col-span-2 min-w-0 sm:flex-1" aria-label="Main navigation">
			<ul
				class="flex items-center gap-1 overflow-x-auto pb-1 sm:justify-end sm:overflow-visible sm:pb-0"
			>
				{#each links as link (link.href)}
					<li class="shrink-0">
						<a
							class={[
								'inline-flex min-h-11 items-center rounded px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700',
								current === link.id ? 'bg-teal-50 text-teal-800' : 'text-zinc-700 hover:bg-zinc-100'
							]}
							aria-current={current === link.id ? 'page' : undefined}
							href={link.href}>{link.label}</a
						>
					</li>
				{/each}
			</ul>
		</nav>
		<form {...signOut} class="col-start-2 row-start-1">
			<input type="hidden" name="intent" value="sign-out" />
			<button
				class="inline-flex min-h-11 items-center rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 disabled:text-zinc-400"
				disabled={signOut.pending > 0}
			>
				{signOut.pending > 0 ? 'Signing out…' : 'Sign out'}
			</button>
		</form>
	</div>
</header>
