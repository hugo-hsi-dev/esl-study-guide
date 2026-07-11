<script lang="ts">
	import { signOut } from '$lib/auth.remote';

	let {
		current,
		admin = false
	}: { current: 'study' | 'assessment' | 'practice' | 'progress' | 'admin'; admin?: boolean } =
		$props();

	const links = $derived(
		admin
			? [{ href: '/admin', label: 'Admin', id: 'admin' as const }]
			: [
					{ href: '/study', label: 'Today', id: 'study' as const },
					{ href: '/assessment', label: 'Diagnosis', id: 'assessment' as const },
					{ href: '/practice', label: 'Practice', id: 'practice' as const },
					{ href: '/progress', label: 'Progress', id: 'progress' as const }
				]
	);
</script>

<header class="border-b border-zinc-200 bg-white">
	<div class="mx-auto flex min-h-16 w-full max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
		<a class="mr-auto font-semibold text-zinc-950" href={admin ? '/admin' : '/study'}>
			ESL Study Guide
		</a>
		<nav aria-label="Main navigation">
			<ul class="flex flex-wrap items-center gap-1">
				{#each links as link (link.href)}
					<li>
						<a
							class={[
								'inline-flex min-h-11 items-center rounded px-3 text-sm font-medium',
								current === link.id ? 'bg-teal-50 text-teal-800' : 'text-zinc-700 hover:bg-zinc-100'
							]}
							aria-current={current === link.id ? 'page' : undefined}
							href={link.href}>{link.label}</a
						>
					</li>
				{/each}
			</ul>
		</nav>
		<form {...signOut}>
			<input type="hidden" name="intent" value="sign-out" />
			<button
				class="inline-flex min-h-11 items-center rounded border border-zinc-300 px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:text-zinc-400"
				disabled={signOut.pending > 0}
			>
				{signOut.pending > 0 ? 'Signing out…' : 'Sign out'}
			</button>
		</form>
	</div>
</header>
