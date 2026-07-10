<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import AppNav from '$lib/AppNav.svelte';
	import {
		completeAssessment,
		getAssessmentState,
		saveAssessmentResponse,
		startAssessment
	} from './data.remote';

	const page = await getAssessmentState();
	let assessment = $state(page.state);
	let currentIndex = $state(
		page.state?.status === 'in_progress'
			? Math.max(
					0,
					page.state.items.findIndex((item) => item.id === page.state?.nextItemId)
				)
			: 0
	);
	let showNewIntake = $state(!page.state);
	let timeZone = $state('UTC');
	let stepHeading: HTMLHeadingElement | undefined = $state();
	let recordingItemId = $state<string | null>(null);
	let recordingSeconds = $state(0);
	let recordingError = $state('');
	let recorder: MediaRecorder | null = null;
	let recordingStream: MediaStream | null = null;
	let recordingStartedAt = 0;
	let recordingTimer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
	});

	const currentItem = $derived(assessment?.items[currentIndex]);
	const savedCount = $derived(assessment?.responses.length ?? 0);
	const responseFor = (itemId: string) =>
		assessment?.responses.find((response) => response.itemId === itemId);

	function readable(value: string) {
		return value.replaceAll('_', ' ');
	}

	async function focusStep() {
		await tick();
		stepHeading?.focus();
	}

	function captureStepHeading(node: HTMLHeadingElement) {
		stepHeading = node;
		return () => {
			if (stepHeading === node) stepHeading = undefined;
		};
	}

	async function startRecording(itemId: string) {
		if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
			recordingError = 'Recording is not available here. Upload audio or provide a transcript.';
			return;
		}
		try {
			recordingError = '';
			const chunks: Blob[] = [];
			recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
			recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
			recordingStartedAt = Date.now();
			recordingSeconds = 1;
			recordingItemId = itemId;
			recordingTimer = setInterval(() => {
				recordingSeconds = Math.max(1, Math.round((Date.now() - recordingStartedAt) / 1000));
			}, 250);
			recorder.ondataavailable = (event) => {
				if (event.data.size) chunks.push(event.data);
			};
			recorder.onstop = () => {
				if (recordingTimer) clearInterval(recordingTimer);
				recordingTimer = null;
				recordingStream?.getTracks().forEach((track) => track.stop());
				recordingStream = null;
				recordingItemId = null;
				const file = new File(chunks, `assessment-${itemId}.webm`, {
					type: recorder?.mimeType || 'audio/webm'
				});
				const input = document.getElementById(`speaking-audio-${itemId}`) as HTMLInputElement;
				if (file.size && input) {
					const transfer = new DataTransfer();
					transfer.items.add(file);
					input.files = transfer.files;
				}
			};
			recorder.start();
		} catch {
			recordingStream?.getTracks().forEach((track) => track.stop());
			recordingStream = null;
			recordingItemId = null;
			recordingError = 'Microphone access was blocked. Upload audio or provide a transcript.';
		}
	}

	function stopRecording() {
		if (recorder?.state === 'recording') recorder.stop();
	}

	onDestroy(() => {
		if (recordingTimer) clearInterval(recordingTimer);
		recordingStream?.getTracks().forEach((track) => track.stop());
	});
</script>

<svelte:head><title>Skill Diagnosis · ESL Study Guide</title></svelte:head>

<AppNav current="assessment" />

<main class="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:py-12">
	<header class="space-y-3">
		<p class="text-sm font-semibold uppercase tracking-wide text-teal-700">Skill Diagnosis</p>
		<h1 class="text-3xl font-semibold text-zinc-950 sm:text-4xl">Find the right place to begin</h1>
		<p class="max-w-2xl text-zinc-700">
			Complete 14 short tasks in about 15–20 minutes. Every step is saved, so you can safely leave
			and return.
		</p>
	</header>

	{#if (!assessment || showNewIntake) && assessment?.status !== 'in_progress'}
		<section class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
			<h2 class="text-2xl font-semibold text-zinc-950">Before you start</h2>
			<p class="mt-2 text-zinc-600">This helps us explain the diagnosis in useful language.</p>
			<form
				{...startAssessment.enhance(async (form) => {
					if (await form.submit()) {
						assessment = form.result?.state ?? assessment;
						showNewIntake = false;
						currentIndex = 0;
						await focusStep();
					}
				})}
				class="mt-6 space-y-6"
			>
				<label class="block space-y-2">
					<span class="font-medium text-zinc-950">What do you most want to do in English?</span>
					<textarea
						name="goal"
						rows="3"
						maxlength="500"
						required
						class="min-h-24 w-full rounded-lg border border-zinc-300 px-3 py-3 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
						placeholder="For example: speak with customers and write clearer emails"></textarea>
				</label>

				{#each ['speaking', 'reading', 'writing'] as area (area)}
					<fieldset class="space-y-3">
						<legend class="font-medium text-zinc-950">
							How comfortable are you with {area}?
						</legend>
						<div class="grid grid-cols-5 gap-2">
							{#each [1, 2, 3, 4, 5] as rating (rating)}
								<label class="cursor-pointer text-center">
									<input
										class="peer sr-only"
										type="radio"
										name={`${area}Rating`}
										value={rating}
										required
									/>
									<span
										class="flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 peer-checked:border-teal-700 peer-checked:bg-teal-50 peer-checked:text-teal-800"
										>{rating}</span
									>
								</label>
							{/each}
						</div>
						<p class="flex justify-between text-xs text-zinc-500">
							<span>Not yet</span><span>Very</span>
						</p>
					</fieldset>
				{/each}

				<input type="hidden" name="timeZone" value={timeZone} />
				<button
					class="min-h-11 rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:bg-zinc-400"
					disabled={startAssessment.pending > 0}
				>
					{startAssessment.pending > 0 ? 'Starting…' : 'Start Skill Diagnosis'}
				</button>
			</form>
			<div aria-live="polite">
				{#each startAssessment.fields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
					<p class="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{issue.message}</p>
				{/each}
			</div>
		</section>
	{:else if assessment?.status === 'in_progress' && currentItem}
		<section class="space-y-5">
			<div class="space-y-2" aria-label={`Task ${currentIndex + 1} of ${assessment.items.length}`}>
				<div class="flex items-center justify-between text-sm text-zinc-600">
					<span>Task {currentIndex + 1} of {assessment.items.length}</span>
					<span>{savedCount} saved</span>
				</div>
				<div class="h-2 overflow-hidden rounded-full bg-zinc-200">
					<div
						class="h-full rounded-full bg-teal-600"
						style={`width: ${((currentIndex + 1) / assessment.items.length) * 100}%`}
					></div>
				</div>
			</div>

			{const stepForm = saveAssessmentResponse.for(currentItem.id)}
			{const savedResponse = responseFor(currentItem.id)}
			<article class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
				<p class="text-sm font-semibold uppercase tracking-wide text-teal-700">
					{readable(currentItem.area)}
				</p>
				<h2
					class="mt-2 text-2xl font-semibold text-zinc-950"
					tabindex="-1"
					{@attach captureStepHeading}
				>
					{currentItem.prompt}
				</h2>
				<p class="mt-3 text-zinc-700">{currentItem.learnerTask.instructions}</p>

				{#if currentItem.audioUrl}
					<audio class="mt-5 w-full" controls preload="metadata" src={currentItem.audioUrl}>
						<a href={currentItem.audioUrl}>Open the listening audio</a>
					</audio>
				{/if}

				<form
					{...stepForm.enhance(async (form) => {
						if (await form.submit()) {
							const saved = form.result?.state;
							if (saved) {
								assessment = saved;
								if (currentIndex < saved.items.length - 1) currentIndex += 1;
							}
							await focusStep();
						}
					})}
					class="mt-6 space-y-5"
				>
					<input type="hidden" name="attemptId" value={assessment.attemptId} />
					<input type="hidden" name="itemId" value={currentItem.id} />

					{#if currentItem.learnerTask.choices}
						<fieldset class="space-y-3">
							<legend class="sr-only">Choose one answer</legend>
							{#each currentItem.learnerTask.choices as choice (choice.id)}
								<label
									class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-zinc-300 p-3 hover:bg-zinc-50"
								>
									<input
										type="radio"
										name="answer"
										value={choice.id}
										checked={savedResponse?.kind === 'objective' &&
											savedResponse.answer === choice.id}
										required
										class="h-5 w-5 accent-teal-700"
									/>
									<span>{choice.text}</span>
								</label>
							{/each}
						</fieldset>
					{:else if currentItem.area === 'writing'}
						<label class="block space-y-2">
							<span class="font-medium text-zinc-950">Your response</span>
							<textarea
								name="answer"
								rows="7"
								maxlength="5000"
								required
								class="w-full rounded-lg border border-zinc-300 px-3 py-3 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
								>{savedResponse?.kind === 'writing_text' ? savedResponse.answer : ''}</textarea
							>
						</label>
					{:else}
						<div class="space-y-4">
							<div class="flex flex-wrap gap-3">
								<button
									type="button"
									class="min-h-11 rounded-lg bg-zinc-950 px-4 py-2 font-medium text-white"
									onclick={() => startRecording(currentItem.id)}
									disabled={recordingItemId === currentItem.id}>Record</button
								>
								{#if recordingItemId === currentItem.id}
									<button
										type="button"
										class="min-h-11 rounded-lg border border-red-300 px-4 py-2 font-medium text-red-800"
										onclick={stopRecording}>Stop ({recordingSeconds}s)</button
									>
								{/if}
							</div>
							<label class="block space-y-2">
								<span class="font-medium text-zinc-950">Or upload your recording</span>
								<input
									id={`speaking-audio-${currentItem.id}`}
									class="block min-h-11 w-full rounded-lg border border-zinc-300 p-2"
									type="file"
									name="speakingAudio"
									accept="audio/webm,audio/wav,audio/mpeg,audio/mp4,audio/ogg"
								/>
							</label>
							<label class="block space-y-2">
								<span class="font-medium text-zinc-950">Response length in seconds</span>
								<input
									class="min-h-11 w-36 rounded-lg border border-zinc-300 px-3"
									type="number"
									name="speakingSeconds"
									min="1"
									max="300"
									value={savedResponse?.kind === 'speaking_metadata'
										? savedResponse.metadata.responseSeconds
										: recordingSeconds || 20}
									required
								/>
							</label>
							<label class="block space-y-2">
								<span class="font-medium text-zinc-950">Transcript fallback (optional)</span>
								<textarea
									name="speakingTranscript"
									rows="4"
									maxlength="5000"
									class="w-full rounded-lg border border-zinc-300 px-3 py-3"
									placeholder="Type what you said if recording is unavailable"
									>{savedResponse?.kind === 'speaking_metadata'
										? (savedResponse.metadata.transcript ?? '')
										: ''}</textarea
								>
							</label>
							{#if recordingError}<p class="text-sm text-red-800">{recordingError}</p>{/if}
						</div>
					{/if}

					<div
						class="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-5"
					>
						<button
							type="button"
							class="min-h-11 rounded-lg border border-zinc-300 px-4 py-2 font-medium text-zinc-700 disabled:opacity-40"
							disabled={currentIndex === 0}
							onclick={async () => {
								currentIndex -= 1;
								await focusStep();
							}}>Previous</button
						>
						<button
							class="min-h-11 rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white disabled:bg-zinc-400"
							disabled={stepForm.pending > 0 || recordingItemId !== null}
						>
							{stepForm.pending > 0
								? 'Saving…'
								: currentIndex === assessment.items.length - 1
									? 'Save final response'
									: 'Save and continue'}
						</button>
					</div>
				</form>

				<div aria-live="polite">
					{#each stepForm.fields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
						<p class="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{issue.message}</p>
					{/each}
				</div>
			</article>

			{#if savedCount === assessment.items.length}
				<form
					{...completeAssessment.enhance(async (form) => {
						if (await form.submit()) {
							assessment = form.result?.state ?? assessment;
							window.scrollTo({ top: 0, behavior: 'smooth' });
						}
					})}
					class="rounded-xl border border-teal-200 bg-teal-50 p-5"
				>
					<input type="hidden" name="attemptId" value={assessment.attemptId} />
					<p class="font-medium text-teal-950">All 14 responses are saved.</p>
					<button
						class="mt-3 min-h-11 rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white disabled:bg-zinc-400"
						disabled={completeAssessment.pending > 0}
					>
						{completeAssessment.pending > 0 ? 'Building your profile…' : 'Complete diagnosis'}
					</button>
				</form>
			{/if}
		</section>
	{:else if assessment?.status === 'completed' && assessment.skillProfile && assessment.studyPlan}
		<section class="space-y-7">
			<div class="rounded-2xl border border-teal-200 bg-teal-50 p-6">
				<p class="text-sm font-semibold uppercase tracking-wide text-teal-800">
					Diagnosis complete
				</p>
				<h2 class="mt-2 text-2xl font-semibold text-zinc-950">Your Skill Profile is ready</h2>
				<p class="mt-2 text-zinc-700">
					Quality: {assessment.skillProfile.diagnosisQuality === 'full'
						? 'Full diagnosis'
						: 'Limited diagnosis'}
				</p>
				{#if assessment.skillProfile.diagnosisQuality === 'limited'}
					<p class="mt-2 text-sm text-amber-900">
						Writing or speaking feedback was unavailable. Your objective answers were still scored,
						and unavailable areas are marked as insufficient evidence.
					</p>
				{/if}
			</div>

			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each Object.entries(assessment.skillProfile.skillBands) as [area, band] (area)}
					<div class="rounded-xl border border-zinc-200 bg-white p-4">
						<p class="text-sm font-medium capitalize text-zinc-600">{readable(area)}</p>
						<p class="mt-1 text-lg font-semibold capitalize text-zinc-950">{readable(band)}</p>
						<p class="mt-1 text-sm text-zinc-600">
							{assessment.skillProfile.evidenceCounts[
								area as keyof typeof assessment.skillProfile.evidenceCounts
							]} evidence item(s)
						</p>
					</div>
				{/each}
			</div>

			<div class="rounded-2xl border border-zinc-200 bg-white p-6">
				<h2 class="text-xl font-semibold text-zinc-950">Practice priorities</h2>
				{#if assessment.studyPlan.targets.length}
					<ol class="mt-4 space-y-3">
						{#each assessment.studyPlan.targets as target (target.signal)}
							<li class="flex gap-3 text-zinc-700">
								<span class="font-semibold text-teal-700">{target.priority}.</span>
								<span class="capitalize">{readable(target.signal)} · {readable(target.area)}</span>
							</li>
						{/each}
					</ol>
				{:else}
					<p class="mt-3 text-zinc-600">No high-priority error signal was found.</p>
				{/if}
			</div>

			<div class="flex flex-wrap gap-3">
				<a
					class="inline-flex min-h-11 items-center rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white"
					href="/practice">Start today’s practice</a
				>
				<button
					type="button"
					class="min-h-11 rounded-lg border border-zinc-300 px-5 py-2 font-medium text-zinc-700"
					onclick={() => (showNewIntake = true)}>Start a new diagnosis</button
				>
			</div>
		</section>
	{/if}
</main>
