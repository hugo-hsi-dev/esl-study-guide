<script lang="ts">
	import { getAdminPage } from './data.remote';

	const data = await getAdminPage();
</script>

<svelte:head><title>Admin shell</title></svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-8 px-4">
	<header class="space-y-3">
		<p class="text-sm font-medium text-indigo-700">Admin</p>
		<h1 class="text-4xl font-semibold text-zinc-950">Learner progress</h1>
		<p class="max-w-xl text-lg text-zinc-700">
			Read-only account shell for reviewing assessment and study data when those records are added.
		</p>
	</header>

	<section class="grid gap-3 sm:grid-cols-3">
		<div class="rounded border border-zinc-200 p-4">
			<p class="text-sm text-zinc-600">Signed in</p>
			<p class="font-medium text-zinc-950">{data.adminName}</p>
		</div>
		<div class="rounded border border-zinc-200 p-4">
			<p class="text-sm text-zinc-600">Assessment attempts</p>
			<p class="font-medium text-zinc-950">{data.assessmentAttempts.length}</p>
		</div>
		<div class="rounded border border-zinc-200 p-4">
			<p class="text-sm text-zinc-600">Practice attempts</p>
			<p class="font-medium text-zinc-950">{data.practiceAttempts.length}</p>
		</div>
	</section>

	<section class="space-y-4 border-t border-zinc-200 pt-6">
		<h2 class="text-2xl font-semibold text-zinc-950">Learner attempts</h2>
		{#each data.assessmentAttempts as attempt (attempt.id)}
			<article class="space-y-3 rounded border border-zinc-200 p-4">
				<div>
					<p class="text-sm text-zinc-600">Attempt {attempt.id}</p>
					<p class="font-medium text-zinc-950">{attempt.status}</p>
				</div>
				{#if attempt.skillProfileJson}
					<div class="grid gap-2 sm:grid-cols-3">
						{#each Object.entries(attempt.skillProfileJson.skillBands) as [area, band] (area)}
							<p class="text-sm text-zinc-700">
								<span class="font-medium text-zinc-950">{area.replace('_', '/')}:</span>
								{band}
							</p>
						{/each}
					</div>
					<p class="text-sm text-zinc-700">
						Pronunciation: {attempt.skillProfileJson.rubricOutputs.pronunciation.feedback}
					</p>
					{#if attempt.skillProfileJson.priorityWeaknesses.length}
						<ul class="list-disc space-y-1 pl-5 text-sm text-zinc-700">
							{#each attempt.skillProfileJson.priorityWeaknesses as weakness (`${weakness.area}-${weakness.signal}`)}
								<li>
									Error signal: {weakness.signal.replaceAll('_', ' ')} ({weakness.area.replace(
										'_',
										'/'
									)})
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
				{#if attempt.studyPlanJson}
					<ul class="list-disc space-y-1 pl-5 text-sm text-zinc-700">
						{#each attempt.studyPlanJson.today as task (task)}
							<li>{task}</li>
						{/each}
					</ul>
				{/if}
				{#if attempt.diagnosisMetadataJson}
					<p class="text-xs text-zinc-500">
						{attempt.diagnosisMetadataJson.model} v{attempt.diagnosisMetadataJson.modelVersion}
					</p>
				{/if}
			</article>
		{/each}
	</section>

	<section class="space-y-4 border-t border-zinc-200 pt-6">
		<h2 class="text-2xl font-semibold text-zinc-950">Practice feedback</h2>
		{#each data.practiceAttempts as attempt (attempt.id)}
			<article class="rounded border border-zinc-200 p-4 text-sm text-zinc-700">
				<p class="font-medium text-zinc-950">
					{attempt.practiceProblemJson.targetSignal.replaceAll('_', ' ')}
				</p>
				<p>Answer: {attempt.answer}</p>
				<p>{attempt.feedbackJson.message}</p>
				<p class="text-xs text-zinc-500">
					{attempt.metadataJson.model} v{attempt.metadataJson.modelVersion}
				</p>
			</article>
		{/each}
	</section>
</main>
