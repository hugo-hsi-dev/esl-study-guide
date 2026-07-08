<script lang="ts">
	import { getAssessmentPage, submitAssessment } from './data.remote';
</script>

<svelte:head><title>ESL Assessment</title></svelte:head>

{#await getAssessmentPage() then data}
	<main class="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-4 py-10">
		<header class="space-y-3">
			<p class="text-sm font-medium text-teal-700">Learner</p>
			<h1 class="text-4xl font-semibold text-zinc-950">ESL Assessment</h1>
			<p class="max-w-xl text-lg text-zinc-700">
				Complete one task for each area. Your answers will be saved for Skill Diagnosis.
			</p>
			<p class="text-sm text-zinc-600">Signed in as {data.learnerName}</p>
		</header>

		{#if submitAssessment.result?.saved}
			<section class="space-y-2 border-l-4 border-teal-600 bg-teal-50 px-5 py-4">
				<h2 class="text-xl font-semibold text-zinc-950">Assessment saved</h2>
				<p class="text-zinc-700">
					Attempt {submitAssessment.result.attemptId} has a Skill Profile and Study Plan.
				</p>
			</section>

			<section class="space-y-5 border-t border-zinc-200 pt-6">
				<h2 class="text-2xl font-semibold text-zinc-950">Skill Profile</h2>
				<div class="grid gap-3 sm:grid-cols-2">
					{#each Object.entries(submitAssessment.result.skillProfile.skillBands) as [area, band] (area)}
						<div class="rounded border border-zinc-200 p-3">
							<p class="text-sm font-medium uppercase text-teal-700">{area.replace('_', '/')}</p>
							<p class="text-lg font-semibold text-zinc-950">{band}</p>
						</div>
					{/each}
				</div>

				{#if submitAssessment.result.skillProfile.priorityWeaknesses.length}
					<div class="space-y-2">
						<h3 class="text-xl font-semibold text-zinc-950">Practice first</h3>
						<ol class="list-decimal space-y-1 pl-5 text-zinc-700">
							{#each submitAssessment.result.skillProfile.priorityWeaknesses as weakness (`${weakness.area}-${weakness.signal}`)}
								<li>{weakness.reason}</li>
							{/each}
						</ol>
					</div>
				{/if}

				{#if submitAssessment.result.skillProfile.missedAnswerExamples.length}
					<div class="space-y-2">
						<h3 class="text-xl font-semibold text-zinc-950">Missed-answer examples</h3>
						{#each submitAssessment.result.skillProfile.missedAnswerExamples as example (example.itemId)}
							<div class="rounded border border-zinc-200 p-3 text-sm text-zinc-700">
								<p class="font-medium text-zinc-950">{example.area.replace('_', '/')}</p>
								<p>You answered: {example.learnerAnswer}</p>
								<p>Expected: {example.expectedAnswer}</p>
								<p>{example.explanation}</p>
							</div>
						{/each}
					</div>
				{/if}

				<div class="space-y-2">
					<h3 class="text-xl font-semibold text-zinc-950">Study Plan</h3>
					<ul class="list-disc space-y-1 pl-5 text-zinc-700">
						{#each submitAssessment.result.studyPlan.today as task (task)}
							<li>{task}</li>
						{/each}
					</ul>
				</div>
			</section>
		{/if}

		{#each submitAssessment.fields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
			<p class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
				{issue.message}
			</p>
		{/each}

		<form {...submitAssessment} class="space-y-8">
			{#each data.items as item, index (item.id)}
				<section class="space-y-4 border-t border-zinc-200 pt-6">
					<input type="hidden" name={`responses[${index}].itemId`} value={item.id} />
					<div class="space-y-2">
						<p class="text-sm font-medium uppercase text-teal-700">{item.area.replace('_', '/')}</p>
						<h2 class="text-2xl font-semibold text-zinc-950">{item.prompt}</h2>
						<p class="text-zinc-700">{item.learnerTask.instructions}</p>
					</div>

					{#if item.learnerTask.choices}
						<div class="space-y-3">
							{#each item.learnerTask.choices as choice (choice.id)}
								<label class="flex gap-3 rounded border border-zinc-300 p-3">
									<input
										type="radio"
										name={`responses[${index}].answer`}
										value={choice.id}
										required
									/>
									<span>{choice.text}</span>
								</label>
							{/each}
						</div>
					{:else if item.area === 'writing'}
						<textarea
							class="min-h-40 w-full rounded border border-zinc-300 px-3 py-2"
							name={`responses[${index}].answer`}
							required></textarea>
					{:else if item.area === 'speaking'}
						<label class="flex max-w-xs flex-col gap-1 text-sm font-medium text-zinc-800">
							Response length in seconds
							<input
								class="rounded border border-zinc-300 px-3 py-2"
								type="number"
								name={`n:responses[${index}].speakingSeconds`}
								min="1"
								max="300"
								required
							/>
						</label>
						<p class="text-sm text-zinc-600">No learner audio file is stored.</p>
					{/if}
				</section>
			{/each}

			<button
				class="rounded bg-zinc-950 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
				disabled={submitAssessment.pending > 0}
			>
				{submitAssessment.pending > 0 ? 'Submitting...' : 'Submit assessment'}
			</button>
		</form>
	</main>
{/await}
