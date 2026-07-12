<script lang="ts">
	import AppNav from '$lib/AppNav.svelte';
	import { getProgress } from './data.remote';

	const data = await getProgress();
	const readable = (value: string) => value.replaceAll('_', ' ');
	const wasAssessed = (area: string, assessedAreas?: string[]) =>
		!assessedAreas || assessedAreas.includes(area);
	const date = (value: Date | null) =>
		value
			? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(
					new Date(value)
				)
			: 'In progress';
</script>

<svelte:head><title>Progress · ESL Study Guide</title></svelte:head>

<AppNav current="progress" />

<main class="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:py-12">
	<header class="space-y-3">
		<p class="text-sm font-semibold uppercase tracking-wide text-teal-700">Progress</p>
		<h1 class="text-3xl font-semibold text-zinc-950 sm:text-4xl">Evidence, not points</h1>
		<p class="max-w-2xl text-zinc-700">
			See what changed, what your responses since the latest diagnosis show, and when there is
			enough new evidence to reassess.
		</p>
	</header>

	<section class="rounded-2xl border border-zinc-200 bg-white p-6">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div>
				<h2 class="text-xl font-semibold text-zinc-950">Reassessment progress</h2>
				<p class="mt-1 text-zinc-600">
					{data.reassessment.scoredCount} of {data.reassessment.threshold} scored practice responses
				</p>
				<p class="mt-1 text-sm text-zinc-600">
					{data.reassessment.coveredTargets} of {data.reassessment.requiredTargets} priority skills have
					enough evidence · {data.reassessment.completedSessions} of {data.reassessment
						.requiredSessions} sessions complete
				</p>
			</div>
			{#if data.reassessment.recommended && data.reassessment.available}
				<a
					class="inline-flex min-h-11 items-center rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white"
					href="/assessment?new=1">Start reassessment</a
				>
			{:else if data.reassessment.recommended}
				<p class="max-w-sm font-medium text-zinc-700">
					Every reviewed diagnosis form for this test profile is complete. Keep practicing while a
					new form is prepared.
				</p>
			{:else}
				<p class="font-medium text-zinc-700">
					{data.reassessment.remaining > 0
						? `${data.reassessment.remaining} scored responses remaining`
						: 'More distributed skill evidence is needed'}
				</p>
			{/if}
		</div>
		<div
			class="mt-4 h-2 overflow-hidden rounded-full bg-zinc-200"
			role="progressbar"
			aria-label="Practice evidence toward reassessment"
			aria-valuemin="0"
			aria-valuemax={data.reassessment.threshold}
			aria-valuenow={Math.min(data.reassessment.scoredCount, data.reassessment.threshold)}
			aria-valuetext={`${data.reassessment.scoredCount} of ${data.reassessment.threshold} scored practice responses`}
		>
			<div
				class="h-full rounded-full bg-teal-600"
				style={`width: ${Math.min(100, (data.reassessment.scoredCount / data.reassessment.threshold) * 100)}%`}
			></div>
		</div>
	</section>

	{#if data.reassessment.targetEvidence.length}
		<section class="rounded-2xl border border-zinc-200 bg-white p-6">
			<h2 class="text-xl font-semibold text-zinc-950">Evidence by priority skill</h2>
			<div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.reassessment.targetEvidence as target (`${target.targetArea}:${target.targetSignal}`)}
					<div class="rounded-lg border border-zinc-200 p-3">
						<p class="font-medium capitalize text-zinc-950">{readable(target.targetSignal)}</p>
						<p class="text-sm capitalize text-zinc-600">{readable(target.targetArea)}</p>
						<p class="mt-2 text-sm text-zinc-700">
							{target.scoredCount} of {target.minimum} minimum responses
						</p>
						<p class="mt-1 text-xs text-zinc-500">
							{target.distinctContentCount} different problems · at least {target.minimumDistinctContent}
							required
						</p>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<section class="rounded-2xl border border-zinc-200 bg-white p-6">
		<h2 class="text-xl font-semibold text-zinc-950">Band changes</h2>
		{#if data.assessmentHistory.length}
			<div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each data.bandChanges as change (change.area)}
					<div class="rounded-lg border border-zinc-200 p-3">
						<p class="text-sm capitalize text-zinc-600">{readable(change.area)}</p>
						<p class="mt-1 font-semibold capitalize text-zinc-950">{readable(change.current)}</p>
						{#if change.previous}
							<p class="mt-1 text-xs capitalize text-zinc-500">
								Previous: {readable(change.previous)}{change.changed ? ' · changed' : ''}
							</p>
						{:else}
							<p class="mt-1 text-xs text-zinc-500">First diagnosis</p>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<p class="mt-3 text-zinc-600">Complete a Skill Diagnosis to establish your first profile.</p>
		{/if}
	</section>

	<section class="space-y-4">
		<h2 class="text-2xl font-semibold text-zinc-950">Assessment history</h2>
		{#if data.assessmentHistory.length}
			{#each data.assessmentHistory as attempt (attempt.attemptId)}
				<article class="rounded-2xl border border-zinc-200 bg-white p-5">
					<div class="flex flex-wrap justify-between gap-3">
						<div>
							<p class="font-semibold text-zinc-950">{date(attempt.completedAt)}</p>
							<p class="mt-1 text-sm text-zinc-600">Goal: {attempt.goal}</p>
						</div>
						{#if attempt.skillProfile}
							<span
								class="h-fit rounded-full bg-zinc-100 px-3 py-1 text-sm capitalize text-zinc-700"
								>{readable(attempt.skillProfile.diagnosisQuality)} diagnosis</span
							>
						{/if}
					</div>
					{#if attempt.skillProfile}
						<details class="mt-4 rounded-lg bg-zinc-50 p-4">
							<summary class="min-h-11 cursor-pointer font-medium text-zinc-950"
								>Evidence and plain-language feedback</summary
							>
							<div class="mt-3 space-y-3">
								{#each Object.entries(attempt.skillProfile.areaFeedback) as [area, feedback] (area)}
									{#if wasAssessed(area, attempt.skillProfile.assessedAreas)}
										<div>
											<p class="font-medium capitalize text-zinc-950">
												{readable(area)} · {attempt.skillProfile.evidenceCounts[
													area as keyof typeof attempt.skillProfile.evidenceCounts
												]} evidence item(s)
											</p>
											<p class="text-sm text-zinc-700">{feedback}</p>
										</div>
									{/if}
								{/each}
							</div>
						</details>
					{/if}
				</article>
			{/each}
		{:else}
			<p class="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600">
				No completed assessments yet.
			</p>
		{/if}
	</section>

	<section class="space-y-4">
		<h2 class="text-2xl font-semibold text-zinc-950">Recent study sessions</h2>
		{#if data.sessions.length}
			{#each data.sessions.slice(0, 12) as session (session.sessionId)}
				<article class="rounded-2xl border border-zinc-200 bg-white p-5">
					<div class="flex flex-wrap justify-between gap-3">
						<div>
							<p class="font-semibold text-zinc-950">
								{date(session.completedAt ?? session.startedAt)}
							</p>
							<p class="mt-1 text-sm text-zinc-600">
								{session.answeredCount} of 5 answered · {session.correctCount} of {session.scoredCount}
								scored responses met the target
							</p>
						</div>
						<span class="h-fit rounded-full bg-zinc-100 px-3 py-1 text-sm capitalize text-zinc-700"
							>{readable(session.status)}</span
						>
					</div>
					<details class="mt-4 rounded-lg bg-zinc-50 p-4">
						<summary class="min-h-11 cursor-pointer font-medium text-zinc-950"
							>Session feedback</summary
						>
						<div class="mt-3 space-y-3">
							{#each session.results as result (result.sequence)}
								<div class="border-l-2 border-teal-600 pl-3 text-sm">
									<p class="font-medium capitalize text-zinc-950">
										{result.sequence}. {readable(result.targetSignal)} · {readable(
											result.difficulty
										)}
									</p>
									{#if result.audioUrl && result.audioTranscript}
										<div class="mt-2 rounded-lg bg-white p-3">
											<p class="font-medium text-zinc-950">Replay the listening evidence</p>
											<audio class="mt-2 w-full" controls preload="metadata" src={result.audioUrl}>
												<a href={result.audioUrl}>Open the listening audio</a>
											</audio>
											<details class="mt-2">
												<summary class="min-h-11 cursor-pointer py-2 font-medium text-teal-800"
													>Read the transcript</summary
												>
												<p class="text-zinc-700">{result.audioTranscript}</p>
											</details>
										</div>
									{/if}
									<dl class="mt-2 space-y-2 text-zinc-700">
										<div>
											<dt class="font-medium text-zinc-950">Prompt</dt>
											<dd>{result.prompt}</dd>
										</div>
										<div>
											<dt class="font-medium text-zinc-950">Your answer</dt>
											<dd>{result.learnerAnswer}</dd>
										</div>
										<div>
											<dt class="font-medium text-zinc-950">Correct answer</dt>
											<dd>{result.expectedAnswer}</dd>
										</div>
										<div>
											<dt class="font-medium text-zinc-950">Why</dt>
											<dd>{result.explanation}</dd>
										</div>
										<div>
											<dt class="font-medium text-zinc-950">Try next</dt>
											<dd>{result.nextStep}</dd>
										</div>
									</dl>
								</div>
							{/each}
						</div>
					</details>
				</article>
			{/each}
		{:else}
			<p class="rounded-2xl border border-zinc-200 bg-white p-6 text-zinc-600">
				Your session history will appear after practice.
			</p>
		{/if}
	</section>

	<section class="rounded-2xl border border-zinc-200 bg-white p-6">
		<h2 class="text-xl font-semibold text-zinc-950">Per-signal evidence</h2>
		{#if data.signalPerformance.length}
			<div class="mt-4 overflow-x-auto">
				<table class="w-full min-w-lg text-left text-sm">
					<thead
						><tr class="border-b border-zinc-200"
							><th class="py-3 pr-4">Signal</th><th class="py-3 pr-4">Area</th><th class="py-3 pr-4"
								>Evidence</th
							><th class="py-3">Responses meeting target since diagnosis</th></tr
						></thead
					>
					<tbody>
						{#each data.signalPerformance as signal (`${signal.area}:${signal.signal}`)}
							<tr class="border-b border-zinc-100"
								><td class="py-3 pr-4 font-medium capitalize">{readable(signal.signal)}</td><td
									class="py-3 pr-4 capitalize">{readable(signal.area)}</td
								><td class="py-3 pr-4">{signal.attempts}</td><td class="py-3"
									>{Math.round(signal.accuracy * 100)}%</td
								></tr
							>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="mt-3 text-zinc-600">No scored practice evidence yet.</p>
		{/if}
	</section>
</main>
