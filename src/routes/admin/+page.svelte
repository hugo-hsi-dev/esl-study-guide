<script lang="ts">
	import AppNav from '$lib/AppNav.svelte';
	import { getAdminDashboard } from './data.remote';

	const data = await getAdminDashboard();
	const readable = (value: string) => value.replaceAll('_', ' ');
	const date = (value: Date | null) =>
		value
			? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
					new Date(value)
				)
			: 'Not completed';
</script>

<svelte:head><title>Admin · ESL Study Guide</title></svelte:head>

<AppNav current="admin" admin />

<main class="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:py-12">
	<header class="space-y-3">
		<p class="text-sm font-semibold uppercase tracking-wide text-indigo-700">Read-only Admin</p>
		<h1 class="text-3xl font-semibold text-zinc-950 sm:text-4xl">Learner study overview</h1>
		<p class="max-w-2xl text-zinc-700">
			Current and previous diagnosis evidence, recent sessions, and signal-level performance. Admin
			access cannot change learner work.
		</p>
	</header>

	{#if !data.learner || !data.dashboard}
		<section class="rounded-2xl border border-zinc-200 bg-white p-6">
			<h2 class="text-xl font-semibold text-zinc-950">No Learner account found</h2>
			<p class="mt-2 text-zinc-600">Seed the fixed accounts before using the Admin view.</p>
		</section>
	{:else}
		<section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<article class="rounded-2xl border border-zinc-200 bg-white p-5">
				<p class="text-sm text-zinc-600">Learner</p>
				<p class="mt-1 font-semibold text-zinc-950">{data.learner.name}</p>
			</article>
			<article class="rounded-2xl border border-zinc-200 bg-white p-5">
				<p class="text-sm text-zinc-600">Weekly sessions</p>
				<p class="mt-1 text-2xl font-semibold text-zinc-950">
					{data.dashboard.weeklyGoal.completed} / 5
				</p>
			</article>
			<article class="rounded-2xl border border-zinc-200 bg-white p-5">
				<p class="text-sm text-zinc-600">Scored since diagnosis</p>
				<p class="mt-1 text-2xl font-semibold text-zinc-950">
					{data.dashboard.reassessment.scoredCount} / {data.dashboard.reassessment.threshold}
				</p>
			</article>
			<article class="rounded-2xl border border-zinc-200 bg-white p-5">
				<p class="text-sm text-zinc-600">Completed sessions</p>
				<p class="mt-1 text-2xl font-semibold text-zinc-950">
					{data.dashboard.sessions.filter((session) => session.status === 'completed').length}
				</p>
			</article>
		</section>

		<section class="rounded-2xl border border-zinc-200 bg-white p-6">
			<div class="flex flex-wrap justify-between gap-4">
				<div>
					<h2 class="text-xl font-semibold text-zinc-950">Current Skill Profile</h2>
					<p class="mt-1 text-sm text-zinc-600">
						{date(data.dashboard.latestAssessment?.completedAt ?? null)}
					</p>
				</div>
				{#if data.dashboard.latestAssessment?.skillProfile}<span
						class="h-fit rounded-full bg-zinc-100 px-3 py-1 text-sm capitalize text-zinc-700"
						>{readable(data.dashboard.latestAssessment.skillProfile.diagnosisQuality)} diagnosis</span
					>{/if}
			</div>
			{#if data.dashboard.latestAssessment?.skillProfile}
				<div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{#each data.bandChanges as change (change.area)}
						<div class="rounded-lg bg-zinc-50 p-3">
							<p class="text-sm capitalize text-zinc-600">{readable(change.area)}</p>
							<p class="mt-1 font-semibold capitalize text-zinc-950">{readable(change.current)}</p>
							<p class="mt-1 text-xs capitalize text-zinc-500">
								{change.previous
									? `Previous: ${readable(change.previous)}`
									: 'First diagnosis'}{change.changed ? ' · changed' : ''}
							</p>
						</div>
					{/each}
				</div>
				<div class="mt-5 grid gap-3 sm:grid-cols-2">
					{#each Object.entries(data.dashboard.latestAssessment.skillProfile.areaFeedback) as [area, feedback] (area)}
						<div class="rounded-lg border border-zinc-200 p-3">
							<p class="font-medium capitalize text-zinc-950">
								{readable(area)} · {data.dashboard.latestAssessment.skillProfile.evidenceCounts[
									area as keyof typeof data.dashboard.latestAssessment.skillProfile.evidenceCounts
								]} evidence item(s)
							</p>
							<p class="mt-1 text-sm text-zinc-700">{feedback}</p>
						</div>
					{/each}
				</div>
			{:else}
				<p class="mt-4 text-zinc-600">The learner has not completed a Skill Diagnosis.</p>
			{/if}
		</section>

		<section class="grid gap-6 lg:grid-cols-2">
			<article class="rounded-2xl border border-zinc-200 bg-white p-6">
				<h2 class="text-xl font-semibold text-zinc-950">Per-signal performance</h2>
				{#if data.dashboard.signalPerformance.length}
					<div class="mt-4 space-y-3">
						{#each data.dashboard.signalPerformance as signal (signal.signal)}
							<div class="flex items-center justify-between gap-3 border-b border-zinc-100 pb-3">
								<div>
									<p class="font-medium capitalize text-zinc-950">{readable(signal.signal)}</p>
									<p class="text-sm capitalize text-zinc-600">
										{readable(signal.area)} · {signal.attempts} evidence
									</p>
								</div>
								<p class="font-semibold text-indigo-800">{Math.round(signal.accuracy * 100)}%</p>
							</div>
						{/each}
					</div>
				{:else}<p class="mt-3 text-zinc-600">No scored practice evidence yet.</p>{/if}
			</article>

			<article class="rounded-2xl border border-zinc-200 bg-white p-6">
				<h2 class="text-xl font-semibold text-zinc-950">Recent activity</h2>
				{#if data.dashboard.sessions.length}
					<div class="mt-4 space-y-3">
						{#each data.dashboard.sessions.slice(0, 8) as session (session.sessionId)}
							<div class="rounded-lg border border-zinc-200 p-3">
								<div class="flex justify-between gap-3">
									<p class="font-medium text-zinc-950">
										{date(session.completedAt ?? session.startedAt)}
									</p>
									<span class="text-sm capitalize text-zinc-600">{readable(session.status)}</span>
								</div>
								<p class="mt-1 text-sm text-zinc-600">
									{session.answeredCount}/5 answered · {session.correctCount}/{session.scoredCount} met
									target
								</p>
								<p class="mt-1 text-xs capitalize text-zinc-500">
									{session.targetSignals.map(readable).join(' · ')}
								</p>
							</div>
						{/each}
					</div>
				{:else}<p class="mt-3 text-zinc-600">No study sessions yet.</p>{/if}
			</article>
		</section>

		<section class="space-y-4">
			<h2 class="text-2xl font-semibold text-zinc-950">Assessment audit details</h2>
			<p class="text-sm text-zinc-600">
				Raw responses and model metadata are collapsed by default and remain read-only.
			</p>
			{#each data.audit as attempt (attempt.attemptId)}
				<details class="rounded-2xl border border-zinc-200 bg-white p-5">
					<summary class="min-h-11 cursor-pointer font-medium text-zinc-950"
						>{date(attempt.completedAt ?? attempt.createdAt)} ·
						<span class="capitalize">{readable(attempt.status)}</span></summary
					>
					<div class="mt-4 space-y-4">
						<div class="space-y-2">
							<h3 class="font-semibold text-zinc-950">Responses</h3>
							{#each attempt.responses as response (`${response.itemId}-${response.itemVersion}`)}
								<div class="rounded-lg bg-zinc-50 p-3 text-sm">
									<p class="font-medium capitalize text-zinc-950">
										{readable(response.area)} · {response.itemId} v{response.itemVersion}
									</p>
									<pre
										class="mt-1 whitespace-pre-wrap font-sans text-zinc-700">{typeof response.response ===
										'string'
											? response.response
											: JSON.stringify(response.response, null, 2)}</pre>
								</div>
							{/each}
						</div>
						<div>
							<h3 class="font-semibold text-zinc-950">Diagnosis metadata</h3>
							<pre
								class="mt-2 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">{JSON.stringify(
									attempt.metadata,
									null,
									2
								)}</pre>
						</div>
					</div>
				</details>
			{/each}
		</section>
	{/if}
</main>
