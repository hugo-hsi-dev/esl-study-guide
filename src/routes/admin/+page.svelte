<script lang="ts">
	import { getAdminPage } from './data.remote';

	const data = await getAdminPage();
</script>

<svelte:head><title>Admin shell</title></svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-4 py-10">
	<header class="space-y-3">
		<p class="text-sm font-medium text-indigo-700">Admin</p>
		<h1 class="text-4xl font-semibold text-zinc-950">Learner progress</h1>
		<p class="max-w-xl text-lg text-zinc-700">
			Read-only review of learner assessment, adaptive practice, and model metadata.
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
					<p class="text-sm text-zinc-600">
						Attempt {attempt.id} - Learner {attempt.learnerUserId}
					</p>
					<p class="font-medium text-zinc-950">{attempt.status}</p>
				</div>
				{#if attempt.skillProfileJson}
					<div class="grid gap-2 sm:grid-cols-3">
						{#each Object.entries(attempt.skillProfileJson.evidence) as [area, evidence] (area)}
							<p class="text-sm text-zinc-700">
								<span class="font-medium text-zinc-950">{area.replace('_', '/')}:</span>
								{evidence.taskCount} task{evidence.taskCount === 1 ? '' : 's'} - {evidence.status}
							</p>
						{/each}
					</div>
					{const feedback = attempt.skillProfileJson.rubricOutputs}
					<div class="space-y-1 text-sm text-zinc-700">
						<p>
							<span class="font-medium text-zinc-950">Writing sample note:</span>
							{feedback.writing.feedback}
						</p>
						<p>
							<span class="font-medium text-zinc-950">Speaking response note:</span>
							{feedback.speaking.feedback}
						</p>
						<p>
							<span class="font-medium text-zinc-950">Pronunciation feedback:</span>
							{feedback.pronunciation.feedback}
						</p>
					</div>
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
					{#if attempt.skillProfileJson.missedAnswerExamples.length}
						<div class="space-y-2">
							<h3 class="font-medium text-zinc-950">Missed answers</h3>
							{#each attempt.skillProfileJson.missedAnswerExamples as example (example.itemId)}
								<p class="text-sm text-zinc-700">
									{example.area.replace('_', '/')} - answered {example.learnerAnswer}, expected
									{example.expectedAnswer}. {example.explanation}
								</p>
							{/each}
						</div>
					{/if}
				{/if}
				{#if attempt.studyPlanJson}
					<div class="grid gap-3 sm:grid-cols-2">
						<div>
							<h3 class="font-medium text-zinc-950">Study Plan today</h3>
							<ul class="list-disc space-y-1 pl-5 text-sm text-zinc-700">
								{#each attempt.studyPlanJson.today as task (task)}
									<li>{task}</li>
								{/each}
							</ul>
						</div>
						<div>
							<h3 class="font-medium text-zinc-950">This week</h3>
							<ul class="list-disc space-y-1 pl-5 text-sm text-zinc-700">
								{#each attempt.studyPlanJson.thisWeek as task (task)}
									<li>{task}</li>
								{/each}
							</ul>
						</div>
					</div>
				{/if}
				<div class="space-y-2">
					<h3 class="font-medium text-zinc-950">Learner answers</h3>
					{#each attempt.responsesJson as response (`${response.itemId}-${response.kind}`)}
						<p class="text-sm text-zinc-700">
							{response.area.replace('_', '/')}:
							{#if response.kind === 'speaking_metadata'}
								{response.metadata.responseSeconds}s response
							{:else}
								{response.answer}
							{/if}
						</p>
					{/each}
				</div>
				{#if attempt.selectedItemReviews.length}
					<div class="space-y-2">
						<h3 class="font-medium text-zinc-950">Assessment item review</h3>
						{#each attempt.selectedItemReviews as item (`${item.id}-${item.version}`)}
							{#if item.review}
								<p class="text-xs text-zinc-500">
									{item.id} v{item.version}: {item.review.reviewerModel} reviewed
									{item.review.reviewedAt} - {item.review.notes}
								</p>
							{/if}
						{/each}
					</div>
				{/if}
				{#if attempt.diagnosisMetadataJson}
					<p class="text-xs text-zinc-500">
						{attempt.diagnosisMetadataJson.model} v{attempt.diagnosisMetadataJson.modelVersion} - schema
						{attempt.diagnosisMetadataJson.schemaVersion}
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
					{attempt.practiceProblemJson.targetArea?.replace('_', '/') ?? 'unknown skill'} -
					{attempt.practiceProblemJson.targetSignal.replaceAll('_', ' ')}
				</p>
				<p>{attempt.practiceProblemJson.prompt}</p>
				<p>Answer: {attempt.answer}</p>
				<p>{attempt.feedbackJson.message}</p>
				<p class="text-xs text-zinc-500">
					{attempt.metadataJson.model} v{attempt.metadataJson.modelVersion} - schema
					{attempt.metadataJson.schemaVersion}
				</p>
			</article>
		{/each}
	</section>
</main>
