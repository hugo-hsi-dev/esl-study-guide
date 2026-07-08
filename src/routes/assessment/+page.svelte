<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import type { PageServerData } from './$types';

	let { data, form }: { data: PageServerData; form: ActionData } = $props();
</script>

<svelte:head><title>ESL Assessment</title></svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-4 py-10">
	<header class="space-y-3">
		<p class="text-sm font-medium text-teal-700">Learner</p>
		<h1 class="text-4xl font-semibold text-zinc-950">ESL Assessment</h1>
		<p class="max-w-xl text-lg text-zinc-700">
			Complete one task for each area. Your answers will be saved for Skill Diagnosis.
		</p>
		<p class="text-sm text-zinc-600">Signed in as {data.learnerName}</p>
	</header>

	{#if form?.saved}
		<section class="space-y-2 border-l-4 border-teal-600 bg-teal-50 px-5 py-4">
			<h2 class="text-xl font-semibold text-zinc-950">Assessment saved</h2>
			<p class="text-zinc-700">
				Attempt {form.attemptId} is pending Skill Diagnosis. Results will appear after diagnosis is available.
			</p>
		</section>
	{/if}

	{#if form?.message}
		<p class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
			{form.message}
		</p>
	{/if}

	<form method="post" use:enhance class="space-y-8">
		{#each data.items as item (item.id)}
			<section class="space-y-4 border-t border-zinc-200 pt-6">
				<div class="space-y-2">
					<p class="text-sm font-medium uppercase text-teal-700">{item.area.replace('_', '/')}</p>
					<h2 class="text-2xl font-semibold text-zinc-950">{item.prompt}</h2>
					<p class="text-zinc-700">{item.learnerTask.instructions}</p>
				</div>

				{#if item.learnerTask.choices}
					<div class="space-y-3">
						{#each item.learnerTask.choices as choice (choice.id)}
							<label class="flex gap-3 rounded border border-zinc-300 p-3">
								<input type="radio" name={`answer:${item.id}`} value={choice.id} required />
								<span>{choice.text}</span>
							</label>
						{/each}
					</div>
				{:else if item.area === 'writing'}
					<textarea
						class="min-h-40 w-full rounded border border-zinc-300 px-3 py-2"
						name={`answer:${item.id}`}
						required></textarea>
				{:else if item.area === 'speaking'}
					<label class="flex max-w-xs flex-col gap-1 text-sm font-medium text-zinc-800">
						Response length in seconds
						<input
							class="rounded border border-zinc-300 px-3 py-2"
							type="number"
							name={`speakingSeconds:${item.id}`}
							min="1"
							max="300"
							required
						/>
					</label>
					<p class="text-sm text-zinc-600">No learner audio file is stored.</p>
				{/if}
			</section>
		{/each}

		<button class="rounded bg-zinc-950 px-4 py-2 font-medium text-white">Submit assessment</button>
	</form>
</main>
