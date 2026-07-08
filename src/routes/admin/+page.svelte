<script lang="ts">
	import { getAdminPage } from './data.remote';
</script>

<svelte:head><title>Admin shell</title></svelte:head>

{#await getAdminPage() then data}
	<main class="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-8 px-4">
		<header class="space-y-3">
			<p class="text-sm font-medium text-indigo-700">Admin</p>
			<h1 class="text-4xl font-semibold text-zinc-950">Learner progress</h1>
			<p class="max-w-xl text-lg text-zinc-700">
				Read-only account shell for reviewing assessment and study data when those records are
				added.
			</p>
		</header>

		<section class="grid gap-3 sm:grid-cols-3">
			<div class="rounded border border-zinc-200 p-4">
				<p class="text-sm text-zinc-600">Signed in</p>
				<p class="font-medium text-zinc-950">{data.adminName}</p>
			</div>
			<div class="rounded border border-zinc-200 p-4">
				<p class="text-sm text-zinc-600">Assessment attempts</p>
				<p class="font-medium text-zinc-950">Read-only</p>
			</div>
			<div class="rounded border border-zinc-200 p-4">
				<p class="text-sm text-zinc-600">Study plan</p>
				<p class="font-medium text-zinc-950">Read-only</p>
			</div>
		</section>
	</main>
{/await}
