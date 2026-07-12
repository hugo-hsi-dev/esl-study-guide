<script lang="ts">
	import AppNav from '$lib/AppNav.svelte';
	import { getLearnerDashboard } from './data.remote';

	const data = await getLearnerDashboard();
	const readable = (value: string) => value.replaceAll('_', ' ');
	const placementLabel = (kind: string) =>
		({
			accuplacer_esl: 'ACCUPLACER ESL',
			cambridge_cept: 'Cambridge CEPT',
			school_specific: 'School-specific test',
			not_sure: 'General readiness'
		})[kind] ?? readable(kind);
	const wasAssessed = (area: string, assessedAreas?: string[]) =>
		!assessedAreas || assessedAreas.includes(area);
	const formatDate = (value: Date | string | null) => {
		if (!value) return 'Not completed';
		const isCalendarDate = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
		return new Intl.DateTimeFormat('en', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			...(isCalendarDate ? { timeZone: 'UTC' } : {})
		}).format(new Date(isCalendarDate ? `${value}T00:00:00Z` : value));
	};
</script>

<svelte:head><title>Today · ESL Study Guide</title></svelte:head>

<AppNav current="study" />

<main class="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:py-12">
	<header
		class="grid gap-6 rounded-3xl bg-teal-950 px-6 py-8 text-white sm:grid-cols-[1fr_auto] sm:items-end sm:px-9"
	>
		<div class="space-y-3">
			<p class="text-sm font-semibold uppercase tracking-wide text-teal-200">Today</p>
			<h1 class="text-3xl font-semibold sm:text-4xl">Welcome back, {data.learnerName}</h1>
			<p class="max-w-xl text-teal-50">
				One focused session is enough for today. Your work saves as you go.
			</p>
		</div>
		<a
			class="inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-5 py-3 font-semibold text-teal-950"
			href={data.primaryAction.href}
		>
			{data.primaryAction.label}
		</a>
	</header>

	<section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<article class="rounded-2xl border border-zinc-200 bg-white p-5">
			<p class="text-sm font-medium text-zinc-600">Weekly goal</p>
			<p class="mt-2 text-3xl font-semibold text-zinc-950">
				{data.weeklyGoal.completed} / {data.weeklyGoal.target}
			</p>
			<div
				class="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200"
				role="progressbar"
				aria-valuemin="0"
				aria-valuemax={data.weeklyGoal.target}
				aria-valuenow={Math.min(data.weeklyGoal.completed, data.weeklyGoal.target)}
				aria-valuetext={`${data.weeklyGoal.completed} sessions completed; goal ${data.weeklyGoal.target}`}
				aria-label={`${data.weeklyGoal.completed} of ${data.weeklyGoal.target} sessions complete`}
			>
				<div
					class="h-full rounded-full bg-teal-600"
					style={`width: ${Math.min(100, (data.weeklyGoal.completed / data.weeklyGoal.target) * 100)}%`}
				></div>
			</div>
			<p class="mt-2 text-sm text-zinc-600">
				completed sessions this week{data.weeklyGoal.basedOnTestDate
					? ` · paced to ${formatDate(data.weeklyGoal.testDate)}`
					: ''}
			</p>
		</article>

		<article class="rounded-2xl border border-zinc-200 bg-white p-5">
			<p class="text-sm font-medium text-zinc-600">Reviews due</p>
			<p class="mt-2 text-3xl font-semibold text-zinc-950">{data.reviewSchedule.due}</p>
			<p class="mt-2 text-sm text-zinc-600">
				{data.reviewSchedule.due > 0
					? 'Due skills come first in your next session.'
					: data.reviewSchedule.nextReviewAt
						? `Next review ${formatDate(data.reviewSchedule.nextReviewAt)}.`
						: 'Finish a scored practice item to start scheduled review.'}
			</p>
			<p class="mt-2 text-xs text-zinc-500">Intervals expand from 1 to 3, 7, then 14 days.</p>
		</article>

		<article class="rounded-2xl border border-zinc-200 bg-white p-5">
			<p class="text-sm font-medium text-zinc-600">Reassessment</p>
			<p class="mt-2 text-3xl font-semibold text-zinc-950">
				{data.reassessment.scoredCount} / {data.reassessment.threshold}
			</p>
			<p class="mt-2 text-sm text-zinc-600">
				{data.reassessment.recommended && data.reassessment.available
					? 'A new Skill Diagnosis is recommended.'
					: data.reassessment.recommended
						? 'You have completed every reviewed diagnosis form available for this test profile. Keep practicing while a new form is prepared.'
						: data.reassessment.remaining > 0
							? `${data.reassessment.remaining} scored responses remain, with evidence needed across every priority skill.`
							: 'The response total is met; keep practicing until every priority skill and session requirement is covered.'}
			</p>
			<p class="mt-2 text-xs text-zinc-500">
				{data.reassessment.coveredTargets}/{data.reassessment.requiredTargets} priority skills ·
				{data.reassessment.completedSessions}/{data.reassessment.requiredSessions} completed sessions
			</p>
			{#if data.reassessment.recommended && data.reassessment.available}
				<a
					class="mt-3 inline-flex min-h-11 items-center font-semibold text-teal-800 underline"
					href="/assessment?new=1">Reassess now</a
				>
			{/if}
		</article>

		<article class="rounded-2xl border border-zinc-200 bg-white p-5 sm:col-span-2 lg:col-span-1">
			<p class="text-sm font-medium text-zinc-600">Latest diagnosis</p>
			{#if data.latestAssessment}
				<p class="mt-2 text-lg font-semibold capitalize text-zinc-950">
					{readable(data.latestAssessment.skillProfile?.diagnosisQuality ?? 'limited')} evidence
				</p>
				<p class="mt-1 text-sm font-medium text-teal-800">
					{placementLabel(data.latestAssessment.placementTest.kind)}
				</p>
				<p class="mt-2 text-sm text-zinc-600">{formatDate(data.latestAssessment.completedAt)}</p>
			{:else}
				<p class="mt-2 text-zinc-700">No completed diagnosis yet.</p>
			{/if}
		</article>
	</section>

	<section class="grid gap-6 lg:grid-cols-2">
		<article class="rounded-2xl border border-zinc-200 bg-white p-6">
			<h2 class="text-xl font-semibold text-zinc-950">Current priorities</h2>
			{#if data.currentTargets.length}
				<ol class="mt-4 space-y-3">
					{#each data.currentTargets as target (`${target.area}:${target.signal}`)}
						<li class="flex items-start gap-3 rounded-lg bg-zinc-50 p-3">
							<span class="font-semibold text-teal-700">{target.priority}</span>
							<span
								><strong class="capitalize text-zinc-950">{readable(target.signal)}</strong><br
								/><span class="text-sm capitalize text-zinc-600">{readable(target.area)}</span
								>{#if target.reason}<span class="mt-1 block text-xs normal-case text-zinc-500"
										>{target.reason}</span
									>{/if}</span
							>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="mt-3 text-zinc-600">Complete the Skill Diagnosis to set your priorities.</p>
			{/if}
		</article>

		<article class="rounded-2xl border border-zinc-200 bg-white p-6">
			<h2 class="text-xl font-semibold text-zinc-950">Last session</h2>
			{#if data.lastSession}
				<p class="mt-3 text-zinc-700">
					{data.lastSession.answeredCount} of 5 answered · {data.lastSession.correctCount} of {data
						.lastSession.scoredCount} scored responses met the target
				</p>
				<p class="mt-3 text-sm capitalize text-zinc-600">
					{[
						...new Set(
							data.lastSession.results.map(
								(result) => `${readable(result.targetArea)}: ${readable(result.targetSignal)}`
							)
						)
					].join(' · ')}
				</p>
				<a
					class="mt-4 inline-flex min-h-11 items-center font-semibold text-teal-800 underline"
					href="/progress">View the recap</a
				>
			{:else}
				<p class="mt-3 text-zinc-600">Your first five-problem recap will appear here.</p>
			{/if}
		</article>
	</section>

	{#if data.latestAssessment?.skillProfile}
		<section class="rounded-2xl border border-zinc-200 bg-white p-6">
			<h2 class="text-xl font-semibold text-zinc-950">Skill Profile</h2>
			<div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each Object.entries(data.latestAssessment.skillProfile.skillBands) as [area, band] (area)}
					{#if wasAssessed(area, data.latestAssessment.skillProfile.assessedAreas)}
						<div class="rounded-lg bg-zinc-50 p-3">
							<p class="text-sm capitalize text-zinc-600">{readable(area)}</p>
							<p class="mt-1 font-semibold capitalize text-zinc-950">{readable(band)}</p>
						</div>
					{/if}
				{/each}
			</div>
		</section>
	{/if}

	<section class="rounded-2xl border border-zinc-200 bg-white p-6">
		<h2 class="text-xl font-semibold text-zinc-950">
			Responses meeting the target since your latest diagnosis
		</h2>
		{#if data.signalPerformance.length}
			<div class="mt-4 grid gap-3 sm:grid-cols-2">
				{#each data.signalPerformance as signal (`${signal.area}:${signal.signal}`)}
					<div class="rounded-lg border border-zinc-200 p-3">
						<div class="flex justify-between gap-3">
							<p class="font-medium capitalize text-zinc-950">{readable(signal.signal)}</p>
							<p class="text-sm font-semibold text-teal-800">
								{Math.round(signal.accuracy * 100)}% meeting target
							</p>
						</div>
						<p class="mt-1 text-sm text-zinc-600">
							{signal.correct} of {signal.attempts} scored responses met the target
						</p>
					</div>
				{/each}
			</div>
		{:else}
			<p class="mt-3 text-zinc-600">Signal-level results appear after practice.</p>
		{/if}
	</section>
</main>
