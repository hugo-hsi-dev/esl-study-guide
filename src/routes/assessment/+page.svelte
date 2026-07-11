<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { getAssessmentPage, submitAssessment, submitPractice } from './data.remote';

	const data = await getAssessmentPage();
	const totalItems = data.items.length;

	let currentIndex = $state(0);
	let answers = $state<Record<string, string>>({});
	let speakingSeconds = $state<Record<string, number>>({});
	let speakingTranscripts = $state<Record<string, string>>({});
	let recordingItemId = $state<string | null>(null);
	let recordingSecondsElapsed = $state(0);
	let recordingErrors = $state<Record<string, string>>({});
	let recordingUrls = $state<Record<string, string>>({});
	let playingAudioId = $state<string | null>(null);
	let audioTimes = $state<Record<string, number>>({});
	let audioDurations = $state<Record<string, number>>({});
	let resultsSection = $state<HTMLElement>();

	let recorder: MediaRecorder | null = null;
	let recordingStream: MediaStream | null = null;
	let recordingStartedAt = 0;
	let recordingTimer: ReturnType<typeof setInterval> | null = null;

	const currentItem = $derived(data.items[currentIndex]);
	const completedCount = $derived(data.items.filter(isItemComplete).length);
	const allComplete = $derived(completedCount === totalItems);
	const currentComplete = $derived(isItemComplete(currentItem));

	function isItemComplete(item: (typeof data.items)[number] | undefined) {
		if (!item) return false;
		if (item.learnerTask.choices) return Boolean(answers[item.id]);
		if (item.area === 'writing') return Boolean(answers[item.id]?.trim());
		if (item.area === 'speaking') return (speakingSeconds[item.id] ?? 0) > 0;
		return false;
	}

	async function showQuestion(index: number) {
		currentIndex = index;
		await tick();
		document.getElementById(`assessment-item-${data.items[index]?.id}`)?.focus();
	}

	async function nextQuestion() {
		if (currentIndex < totalItems - 1 && isItemComplete(currentItem)) {
			await showQuestion(currentIndex + 1);
		}
	}

	async function previousQuestion() {
		if (currentIndex > 0) await showQuestion(currentIndex - 1);
	}

	function formatSeconds(value = 0) {
		const seconds = Math.max(0, Math.floor(value));
		return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
	}

	function audioElement(playerId: string) {
		return document.getElementById(`audio-${playerId}`) as HTMLAudioElement | null;
	}

	function updateAudio(playerId: string) {
		const audio = audioElement(playerId);
		if (!audio) return;
		audioTimes[playerId] = audio.currentTime;
		audioDurations[playerId] = Number.isFinite(audio.duration) ? audio.duration : 0;
	}

	function seekAudio(playerId: string, seconds: number) {
		const audio = audioElement(playerId);
		if (!audio) return;
		audio.currentTime = seconds;
		updateAudio(playerId);
	}

	async function toggleAudio(playerId: string) {
		const audio = audioElement(playerId);
		if (!audio) return;
		if (playingAudioId === playerId) {
			audio.pause();
			playingAudioId = null;
			return;
		}
		const previousAudio = playingAudioId ? audioElement(playingAudioId) : undefined;
		previousAudio?.pause();
		await audio.play();
		playingAudioId = playerId;
	}

	function stopRecording() {
		if (recorder?.state === 'recording') recorder.stop();
	}

	async function startRecording(itemId: string) {
		if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
			recordingErrors[itemId] = 'Microphone recording is not supported in this browser.';
			return;
		}

		if (recorder?.state === 'recording') stopRecording();

		try {
			recordingErrors[itemId] = '';
			const chunks: BlobPart[] = [];
			recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
			recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
			recordingStartedAt = Date.now();
			recordingSecondsElapsed = 0;
			recordingItemId = itemId;
			recordingTimer = setInterval(() => {
				recordingSecondsElapsed = Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000));
			}, 250);

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunks.push(event.data);
			};
			recorder.onstop = () => {
				if (recordingTimer) clearInterval(recordingTimer);
				recordingTimer = null;
				recordingStream?.getTracks().forEach((track) => track.stop());
				recordingStream = null;
				recordingItemId = null;

				const seconds = Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000));
				const blob = new Blob(chunks, { type: recorder?.mimeType || 'audio/webm' });
				if (blob.size === 0) {
					recordingErrors[itemId] = 'No audio was captured. Try again.';
					return;
				}
				const file = new File([blob], `speaking-${itemId}.webm`, { type: blob.type });
				const transfer = new DataTransfer();
				transfer.items.add(file);
				const input = document.getElementById(
					`speaking-audio-${itemId}`
				) as HTMLInputElement | null;
				if (input) input.files = transfer.files;
				speakingSeconds[itemId] = seconds;

				if (recordingUrls[itemId]) URL.revokeObjectURL(recordingUrls[itemId]);
				recordingUrls[itemId] = URL.createObjectURL(file);
			};
			recorder.start();
		} catch {
			recordingStream?.getTracks().forEach((track) => track.stop());
			recordingStream = null;
			recordingItemId = null;
			if (recordingTimer) clearInterval(recordingTimer);
			recordingTimer = null;
			recordingErrors[itemId] = 'Allow microphone access to record your speaking response.';
		}
	}

	onDestroy(() => {
		if (recordingTimer) clearInterval(recordingTimer);
		recordingStream?.getTracks().forEach((track) => track.stop());
		for (const url of Object.values(recordingUrls)) URL.revokeObjectURL(url);
	});

	$effect(() => {
		if (!submitAssessment.result?.saved) return;
		void tick().then(() => resultsSection?.focus());
	});
</script>

{#snippet audioPlayer(src: string, playerId: string, label: string)}
	<div class="space-y-3 rounded border border-zinc-200 bg-white p-4">
		<audio
			id={`audio-${playerId}`}
			{src}
			preload="metadata"
			onended={() => {
				playingAudioId = null;
				updateAudio(playerId);
			}}
			onloadedmetadata={() => updateAudio(playerId)}
			ontimeupdate={() => updateAudio(playerId)}
		>
			<a href={src}>{label}</a>
		</audio>
		<div class="flex items-center gap-3">
			<button
				type="button"
				class="min-w-20 rounded bg-zinc-950 px-3 py-2 text-sm font-medium text-white"
				aria-label={playingAudioId === playerId ? `Pause ${label}` : `Play ${label}`}
				onclick={() => toggleAudio(playerId)}
			>
				{playingAudioId === playerId ? 'Pause' : 'Play'}
			</button>
			<input
				class="w-full accent-teal-700"
				type="range"
				min="0"
				max={audioDurations[playerId] || 0}
				step="0.1"
				value={audioTimes[playerId] || 0}
				aria-label={`${label} position`}
				oninput={(event) => seekAudio(playerId, event.currentTarget.valueAsNumber)}
			/>
			<span class="w-24 whitespace-nowrap text-right text-sm tabular-nums text-zinc-600">
				{formatSeconds(audioTimes[playerId])} / {formatSeconds(audioDurations[playerId])}
			</span>
		</div>
	</div>
{/snippet}

<svelte:head><title>ESL Assessment</title></svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-4 py-8">
	<header class="space-y-3">
		<p class="text-sm font-medium text-teal-700">Learner</p>
		<h1 class="text-4xl font-semibold text-zinc-950">Find what to practice first</h1>
		<p class="max-w-xl text-lg text-zinc-700">
			This first check takes about 10 minutes. You will complete one short task in each area and get
			a starting practice target—not a grade or a full language-level result.
		</p>
		<p class="text-sm text-zinc-600">Signed in as {data.learnerName}</p>
	</header>

	{#if submitAssessment.result?.saved}
		<section class="space-y-2 border-l-4 border-teal-600 bg-teal-50 px-5 py-4" aria-live="polite">
			<h2 class="text-xl font-semibold text-zinc-950">First check saved</h2>
			<p class="text-zinc-700">
				Your answers are saved. The notes below show what one short task can tell us and where to
				practice next.
			</p>
		</section>

		<section
			class="space-y-5 border-t border-zinc-200 pt-6"
			tabindex="-1"
			bind:this={resultsSection}
		>
			<h2 class="text-2xl font-semibold text-zinc-950">Your first study snapshot</h2>
			<p class="max-w-2xl text-zinc-700">
				One task per area can point us toward useful practice, but it cannot reliably assign a skill
				level. We will need a few more examples before making stronger claims.
			</p>
			<div class="grid gap-3 sm:grid-cols-2">
				{#each Object.entries(submitAssessment.result.skillProfile.evidence) as [area, evidence] (area)}
					<div class="rounded border border-zinc-200 p-3">
						<p class="text-sm font-medium uppercase text-teal-700">{area.replace('_', '/')}</p>
						<p class="mt-1 text-sm font-medium text-zinc-950">
							{evidence.taskCount === 1 ? 'One short task' : 'No task saved'}
						</p>
						<p class="mt-1 text-sm text-zinc-700">{evidence.summary}</p>
					</div>
				{/each}
			</div>

			<div class="grid gap-3 sm:grid-cols-2">
				<div class="rounded border border-zinc-200 p-3 text-sm text-zinc-700">
					<p class="font-medium text-zinc-950">Writing sample</p>
					<p>{submitAssessment.result.skillProfile.rubricOutputs.writing.feedback}</p>
				</div>
				<div class="rounded border border-zinc-200 p-3 text-sm text-zinc-700">
					<p class="font-medium text-zinc-950">Speaking response note</p>
					<p>{submitAssessment.result.skillProfile.rubricOutputs.speaking.feedback}</p>
				</div>
			</div>

			{#if submitAssessment.result.skillProfile.priorityWeaknesses.length}
				<div class="space-y-2">
					<h3 class="text-xl font-semibold text-zinc-950">A helpful place to start</h3>
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
							<p>You chose: {example.learnerAnswer}</p>
							<p>Best answer: {example.expectedAnswer}</p>
							<p>{example.explanation}</p>
						</div>
					{/each}
				</div>
			{/if}

			<div class="space-y-2">
				<h3 class="text-xl font-semibold text-zinc-950">Today</h3>
				<ul class="list-disc space-y-1 pl-5 text-zinc-700">
					{#each submitAssessment.result.studyPlan.today as task (task)}
						<li>{task}</li>
					{/each}
				</ul>
			</div>

			<div class="space-y-2">
				<h3 class="text-xl font-semibold text-zinc-950">This week</h3>
				<ul class="list-disc space-y-1 pl-5 text-zinc-700">
					{#each submitAssessment.result.studyPlan.thisWeek as task (task)}
						<li>{task}</li>
					{/each}
				</ul>
			</div>
		</section>
	{/if}

	{const practice = $derived(
		submitPractice.result?.nextPractice ?? submitAssessment.result?.practice ?? data.practice
	)}
	{#if practice?.problem}
		<section class="space-y-4 border-t border-zinc-200 pt-6">
			<div class="space-y-2">
				<p class="text-sm font-medium uppercase text-teal-700">
					Focus: {practice.problem.targetArea.replace('_', '/')} -
					{practice.problem.targetSignal.replaceAll('_', ' ')}
				</p>
				<h2 class="text-2xl font-semibold text-zinc-950">
					{submitPractice.result?.nextPractice ? 'Next practice problem' : 'Practice problem'}
				</h2>
				<p class="text-zinc-700">{practice.problem.prompt}</p>
			</div>

			{#if submitPractice.result?.feedback}
				<p
					class="rounded border px-3 py-2 text-sm"
					role="status"
					class:border-teal-200={submitPractice.result.feedback.correct}
					class:bg-teal-50={submitPractice.result.feedback.correct}
					class:text-teal-800={submitPractice.result.feedback.correct}
					class:border-red-200={!submitPractice.result.feedback.correct}
					class:bg-red-50={!submitPractice.result.feedback.correct}
					class:text-red-700={!submitPractice.result.feedback.correct}
				>
					Last answer: {submitPractice.result.feedback.message}
				</p>
			{/if}

			{#key practice.problem.id}
				<form {...submitPractice} class="space-y-4">
					<input type="hidden" name="problemJson" value={JSON.stringify(practice.problem)} />
					<input type="hidden" name="metadataJson" value={JSON.stringify(practice.metadata)} />
					<div class="space-y-3">
						{#each practice.problem.choices as choice (choice.id)}
							<label class="flex gap-3 rounded border border-zinc-300 p-3">
								<input type="radio" name="answer" value={choice.id} required />
								<span>{choice.text}</span>
							</label>
						{/each}
					</div>
					<button
						class="rounded bg-zinc-950 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
						disabled={submitPractice.pending > 0}
					>
						{submitPractice.pending > 0 ? 'Checking...' : 'Check answer'}
					</button>
				</form>
			{/key}
		</section>
	{/if}

	{#each submitAssessment.fields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
		<p class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
			{issue.message}
		</p>
	{/each}

	{#each submitPractice.fields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
		<p class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
			{issue.message}
		</p>
	{/each}

	<form {...submitAssessment} class="space-y-8" enctype="multipart/form-data">
		<div class="space-y-2" aria-label="Assessment progress">
			<div class="flex items-center justify-between text-sm font-medium text-zinc-700">
				<span>Question {currentIndex + 1} of {totalItems}</span>
				<span>{completedCount} complete</span>
			</div>
			<progress
				class="h-2 w-full overflow-hidden rounded accent-teal-700"
				value={currentIndex + 1}
				max={totalItems}
			>
				Question {currentIndex + 1} of {totalItems}
			</progress>
		</div>

		{#each data.items as item, index (item.id)}
			<section
				id={`assessment-item-${item.id}`}
				tabindex="-1"
				class={['space-y-5 border-t border-zinc-200 pt-6', index !== currentIndex && 'hidden']}
			>
				<input type="hidden" name={`responses[${index}].itemId`} value={item.id} />
				<div class="space-y-2">
					<p class="text-sm font-medium uppercase text-teal-700">{item.area.replace('_', '/')}</p>
					<h2 class="text-2xl font-semibold text-zinc-950">{item.prompt}</h2>
					<p class="text-zinc-700">{item.learnerTask.instructions}</p>
				</div>

				{#if item.audioUrl}
					{@render audioPlayer(item.audioUrl, `listening:${item.id}`, 'Listening audio')}
				{/if}

				{#if item.learnerTask.choices}
					<div class="space-y-3">
						{#each item.learnerTask.choices as choice (choice.id)}
							<label
								class={[
									'flex cursor-pointer gap-3 rounded border bg-white p-3',
									answers[item.id] === choice.id
										? 'border-teal-600 ring-2 ring-teal-100'
										: 'border-zinc-300'
								]}
							>
								<input
									type="radio"
									name={`responses[${index}].answer`}
									value={choice.id}
									checked={answers[item.id] === choice.id}
									onchange={(event) => {
										answers[item.id] = event.currentTarget.value;
									}}
								/>
								<span>{choice.text}</span>
							</label>
						{/each}
					</div>
				{:else if item.area === 'writing'}
					<textarea
						class="min-h-40 w-full rounded border border-zinc-300 px-3 py-2"
						aria-label="Writing response"
						name={`responses[${index}].answer`}
						value={answers[item.id] ?? ''}
						oninput={(event) => {
							answers[item.id] = event.currentTarget.value;
						}}></textarea>
				{:else if item.area === 'speaking'}
					<input
						type="hidden"
						name={`n:responses[${index}].speakingSeconds`}
						value={speakingSeconds[item.id] ?? ''}
					/>
					<label class="flex flex-col gap-1 text-sm font-medium text-zinc-800">
						Optional transcript to help review language
						<textarea
							class="min-h-24 w-full rounded border border-zinc-300 px-3 py-2"
							name={`responses[${index}].speakingTranscript`}
							value={speakingTranscripts[item.id] ?? ''}
							oninput={(event) => {
								speakingTranscripts[item.id] = event.currentTarget.value;
							}}></textarea>
					</label>
					<input
						id={`speaking-audio-${item.id}`}
						class="sr-only"
						type="file"
						name={`responses[${index}].speakingAudio`}
						accept="audio/*"
						tabindex="-1"
					/>
					<div class="space-y-3 rounded border border-zinc-200 bg-white p-4">
						<div class="flex flex-wrap items-center gap-3">
							<button
								type="button"
								class={[
									'rounded px-4 py-2 font-medium text-white',
									recordingItemId === item.id ? 'bg-red-700' : 'bg-zinc-950'
								]}
								onclick={() =>
									recordingItemId === item.id ? stopRecording() : startRecording(item.id)}
							>
								{#if recordingItemId === item.id}
									Stop recording
								{:else if speakingSeconds[item.id]}
									Record again
								{:else}
									Record answer
								{/if}
							</button>
							<span class="text-sm tabular-nums text-zinc-700">
								{recordingItemId === item.id
									? formatSeconds(recordingSecondsElapsed)
									: speakingSeconds[item.id]
										? `${formatSeconds(speakingSeconds[item.id])} recorded`
										: 'No recording yet'}
							</span>
						</div>
						{#if recordingUrls[item.id]}
							{@render audioPlayer(
								recordingUrls[item.id],
								`recording:${item.id}`,
								'Recorded answer'
							)}
						{/if}
						{#if recordingErrors[item.id]}
							<p
								class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
								role="alert"
							>
								{recordingErrors[item.id]}
							</p>
						{/if}
					</div>
					<p class="text-sm text-zinc-600">
						Aim for about 20-30 seconds so there is enough language to review. Your audio is not
						stored; when a transcript is available, it can help us review language. Pronunciation is
						not scored.
					</p>
				{/if}
			</section>
		{/each}

		<div class="flex items-center justify-between border-t border-zinc-200 pt-5">
			<button
				type="button"
				class="rounded border border-zinc-300 px-4 py-2 font-medium text-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-400"
				disabled={currentIndex === 0}
				onclick={() => void previousQuestion()}
			>
				Back
			</button>
			{#if currentIndex < totalItems - 1}
				<button
					type="button"
					class="rounded bg-zinc-950 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
					disabled={!currentComplete || recordingItemId !== null}
					onclick={() => void nextQuestion()}
				>
					Next
				</button>
			{:else}
				<button
					class="rounded bg-zinc-950 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:bg-zinc-400"
					disabled={submitAssessment.pending > 0 || !allComplete || recordingItemId !== null}
				>
					{submitAssessment.pending > 0 ? 'Submitting...' : 'Submit assessment'}
				</button>
			{/if}
		</div>
	</form>
</main>
