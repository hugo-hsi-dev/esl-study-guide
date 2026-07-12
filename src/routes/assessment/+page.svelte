<script lang="ts">
	import { onDestroy, onMount, tick } from 'svelte';
	import AppNav from '$lib/AppNav.svelte';
	import { readAudioDurationSeconds } from '$lib/audio-duration';
	import {
		completeAssessment,
		getAssessmentState,
		saveAssessmentResponse,
		startAssessment
	} from './data.remote';
	import { assessmentChoiceControlId, assessmentItemDomKey } from './form-identity';

	const page = await getAssessmentState();
	const initialWritingResponse = page.state?.responses.find(
		(response) => response.kind === 'writing_text'
	);
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
	let resultsHeading: HTMLHeadingElement | undefined = $state();
	let recordingState = $state<'idle' | 'starting' | 'recording'>('idle');
	let recordingItemId = $state<string | null>(null);
	let recordingSeconds = $state(0);
	let audioDurationPending = $state(false);
	let recordingError = $state('');
	let listeningAudioError = $state('');
	let listeningAudioElement: HTMLAudioElement | null = $state(null);
	let acknowledgingListeningItemId = $state<string | null>(null);
	let listeningAcknowledgements = $state<Record<string, string>>({});
	let writingDraft = $state(
		initialWritingResponse?.kind === 'writing_text' ? initialWritingResponse.answer : ''
	);
	let recorder: MediaRecorder | null = null;
	let recordingStream: MediaStream | null = null;
	let recordingTimer: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
		if (
			new URL(window.location.href).searchParams.get('new') === '1' &&
			assessment?.status === 'completed'
		) {
			showNewIntake = true;
		}
	});

	const currentItem = $derived(assessment?.items[currentIndex]);
	const savedCount = $derived(assessment?.responses.length ?? 0);
	const savedResponse = $derived(currentItem ? responseFor(currentItem.id) : undefined);
	const writingWordCount = $derived(
		writingDraft.trim() ? writingDraft.trim().split(/\s+/u).length : 0
	);
	const writingWordMinimum = $derived(
		currentItem?.taskType === 'writeplacer_esl_readiness_essay' ? 300 : 120
	);
	const writingWordMaximum = $derived(
		currentItem?.taskType === 'writeplacer_esl_readiness_essay' ? 600 : 180
	);
	function responseFor(itemId: string) {
		return assessment?.responses.find((response) => response.itemId === itemId);
	}

	function readable(value: string) {
		return value.replaceAll('_', ' ');
	}

	function wasAssessed(area: string, assessedAreas?: readonly string[]) {
		return !assessedAreas || assessedAreas.includes(area);
	}

	function placementTestLabel(kind: string) {
		return (
			{
				accuplacer_esl: 'ACCUPLACER ESL',
				cambridge_cept: 'Cambridge English Placement Test (CEPT)',
				school_specific: 'School-specific placement test',
				not_sure: 'Test not confirmed yet'
			}[kind] ?? readable(kind)
		);
	}

	function formatTestDate(value?: string) {
		return value
			? new Intl.DateTimeFormat('en', {
					month: 'long',
					day: 'numeric',
					year: 'numeric',
					timeZone: 'UTC'
				}).format(new Date(`${value}T00:00:00Z`))
			: 'Not provided';
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

	async function acknowledgeListeningPlayback(itemId: string, attemptId: string) {
		if (acknowledgingListeningItemId === itemId) return;
		acknowledgingListeningItemId = itemId;
		listeningAudioError = '';
		try {
			const response = await fetch(`/assessment/audio/${encodeURIComponent(itemId)}/ack`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ attemptId })
			});
			if (!response.ok) throw new Error('Playback acknowledgement failed.');
			const payload = (await response.json()) as { token?: unknown };
			if (typeof payload.token !== 'string') throw new Error('Playback acknowledgement failed.');
			listeningAcknowledgements[itemId] = payload.token;
		} catch {
			listeningAudioError =
				'We could not confirm playback. Check your connection, then play the audio again.';
		} finally {
			if (acknowledgingListeningItemId === itemId) acknowledgingListeningItemId = null;
		}
	}

	async function playListeningAudio() {
		listeningAudioError = '';
		try {
			await listeningAudioElement?.play();
		} catch {
			listeningAudioError =
				'Audio could not start. Use the player controls or check your browser’s audio settings.';
		}
	}

	function clearRecording() {
		if (recordingTimer) clearInterval(recordingTimer);
		recordingTimer = null;
		recordingStream?.getTracks().forEach((track) => track.stop());
		recordingStream = null;
		recorder = null;
		recordingItemId = null;
		recordingState = 'idle';
	}

	async function startRecording(itemId: string) {
		if (recordingState !== 'idle') return;
		if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
			recordingError =
				'Recording is not available here. Upload audio for speaking evidence, or type an unscored practice transcript.';
			return;
		}
		recordingState = 'starting';
		recordingItemId = itemId;
		let activeStream: MediaStream | null = null;
		try {
			recordingError = '';
			const chunks: Blob[] = [];
			const acquiredStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			activeStream = acquiredStream;
			if (recordingState !== 'starting' || recordingItemId !== itemId) {
				acquiredStream.getTracks().forEach((track) => track.stop());
				return;
			}
			recordingStream = acquiredStream;
			const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
			const activeRecorder = new MediaRecorder(acquiredStream, mimeType ? { mimeType } : undefined);
			recorder = activeRecorder;
			const startedAt = Date.now();
			recordingSeconds = 1;
			recordingTimer = setInterval(() => {
				recordingSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
			}, 250);
			activeRecorder.ondataavailable = (event) => {
				if (event.data.size) chunks.push(event.data);
			};
			activeRecorder.onstop = () => {
				if (recorder !== activeRecorder) {
					acquiredStream.getTracks().forEach((track) => track.stop());
					return;
				}
				if (recordingTimer) clearInterval(recordingTimer);
				recordingTimer = null;
				acquiredStream.getTracks().forEach((track) => track.stop());
				recordingStream = null;
				recorder = null;
				recordingItemId = null;
				recordingState = 'idle';
				const file = new File(chunks, `assessment-${itemId}.webm`, {
					type: activeRecorder.mimeType || 'audio/webm'
				});
				const input = document.getElementById(`speaking-audio-${itemId}`) as HTMLInputElement;
				if (file.size && input) {
					const transfer = new DataTransfer();
					transfer.items.add(file);
					input.files = transfer.files;
				}
			};
			activeRecorder.start();
			recordingState = 'recording';
		} catch {
			activeStream?.getTracks().forEach((track) => track.stop());
			clearRecording();
			recordingError =
				'Microphone access was blocked. Upload audio for speaking evidence, or type an unscored practice transcript.';
		}
	}

	function stopRecording() {
		if (recorder?.state === 'recording') recorder.stop();
	}

	async function captureUploadedAudioDuration(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		recordingSeconds = 0;
		recordingError = '';
		if (!file) return;
		audioDurationPending = true;
		try {
			recordingSeconds = await readAudioDurationSeconds(file, 300);
		} catch {
			input.value = '';
			recordingError = 'We could not read that recording’s duration. Choose another audio file.';
		} finally {
			audioDurationPending = false;
		}
	}

	onDestroy(() => {
		if (recorder && recorder.state !== 'inactive') {
			recorder.onstop = null;
			recorder.stop();
		}
		clearRecording();
	});
</script>

<svelte:head><title>Quick Readiness Baseline · ESL Study Guide</title></svelte:head>

<AppNav current="assessment" />

<main class="assessment-page mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:py-12">
	<header class="space-y-3">
		<p class="text-sm font-semibold uppercase tracking-wide text-teal-700">
			Quick readiness baseline
		</p>
		<h1 class="text-3xl font-semibold text-zinc-950 sm:text-4xl">Find a useful place to begin</h1>
		<p class="max-w-2xl text-zinc-700">
			Your selected form contains 1–21 tasks, depending on the sections you confirm. This app’s full
			named-profile baseline has 20 original tasks across the active areas and usually takes about
			25–35 minutes; an optional 300–600-word essay takes longer. Every step is saved, so you can
			safely leave and return.
		</p>
		<p class="max-w-2xl rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
			This quick baseline creates a starting practice profile, not a grade or full language-level
			result. It is not an official placement score and cannot predict whether you will pass a test
			or enter a particular course.
		</p>
	</header>

	{#if (!assessment || showNewIntake) && assessment?.status !== 'in_progress'}
		<section class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
			<h2 class="text-2xl font-semibold text-zinc-950">Before you start</h2>
			<p class="mt-2 text-zinc-600">
				Tell us what you are preparing for so the baseline can organize useful study guidance. This
				context does not create an official score or pass prediction.
			</p>
			<form
				{...startAssessment.enhance(async (form) => {
					if (await form.submit()) {
						assessment = form.result?.state ?? assessment;
						writingDraft = '';
						showNewIntake = false;
						currentIndex = 0;
						await focusStep();
					}
				})}
				class="mt-6 space-y-6"
			>
				<fieldset class="space-y-4 rounded-xl border border-zinc-200 p-4">
					<legend class="px-1 font-semibold text-zinc-950">Your placement-test goal</legend>
					<label class="block space-y-2">
						<span class="font-medium text-zinc-950">Which test are you preparing for?</span>
						<select
							name="placementTestKind"
							required
							class="min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2"
						>
							<option value="not_sure" selected>I'm not sure yet</option>
							<option value="accuplacer_esl">ACCUPLACER ESL</option>
							<option value="cambridge_cept">Cambridge English Placement Test (CEPT)</option>
							<option value="school_specific">A school-specific placement test</option>
						</select>
					</label>
					<label class="block space-y-2">
						<span class="font-medium text-zinc-950">School or institution (if known)</span>
						<input
							name="institution"
							maxlength="200"
							class="min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2"
							placeholder="For example: City Community College"
						/>
					</label>
					<label class="block space-y-2">
						<span class="font-medium text-zinc-950">
							Target course, level, or outcome (if known)
						</span>
						<input
							name="targetOutcome"
							maxlength="300"
							class="min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2"
							placeholder="For example: place into ESL Level 3"
						/>
					</label>
					<label class="block space-y-2">
						<span class="font-medium text-zinc-950">Known test sections (if known)</span>
						<input
							name="knownSections"
							maxlength="500"
							class="min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2"
							placeholder="For example: listening, reading, language use, essay"
						/>
						<p class="text-sm text-zinc-600">
							Copy the section names from your school’s current test information when possible.
						</p>
					</label>
					<label class="block space-y-2">
						<span class="font-medium text-zinc-950">Test date (optional)</span>
						<input
							type="date"
							name="testDate"
							class="min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2"
						/>
					</label>
				</fieldset>

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

				<p class="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
					The comfort ratings below are for reflection only. They do not change your evidence bands;
					your saved task responses determine the practice priorities.
				</p>

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
										class="flex min-h-11 items-center justify-center rounded-lg border border-zinc-300 peer-checked:border-teal-700 peer-checked:bg-teal-50 peer-checked:text-teal-800 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-teal-700"
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
				<progress
					class="h-2 w-full overflow-hidden rounded-full accent-teal-700"
					value={currentIndex + 1}
					max={assessment.items.length}
					aria-label={`Assessment progress: task ${currentIndex + 1} of ${assessment.items.length}`}
					aria-valuetext={`Task ${currentIndex + 1} of ${assessment.items.length}; ${savedCount} responses saved`}
				></progress>
				<p class="text-sm text-zinc-600">
					<strong class="font-semibold text-zinc-800">Active baseline:</strong>
					{placementTestLabel(assessment.intake.placementTest.kind)} · reviewed form {assessment.formId ??
						'A'}
				</p>
			</div>

			{#key assessmentItemDomKey(currentItem)}
				{const stepForm = saveAssessmentResponse.for(currentItem.id)}
				{const itemDomKey = assessmentItemDomKey(currentItem)}
				{const activeAttemptId = assessment.attemptId}
				<article
					class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8"
					data-assessment-item={itemDomKey}
				>
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
						<button
							type="button"
							class="mt-5 min-h-11 rounded-lg bg-zinc-950 px-4 py-2 font-medium text-white"
							onclick={playListeningAudio}>Play full recording</button
						>
						<audio
							bind:this={listeningAudioElement}
							class="mt-3 w-full"
							controls
							preload="metadata"
							src={currentItem.audioUrl}
							onended={() => acknowledgeListeningPlayback(currentItem.id, activeAttemptId)}
							onerror={() =>
								(listeningAudioError =
									'Listening audio is unavailable. This task cannot be saved as listening evidence yet.')}
						>
							<a href={currentItem.audioUrl}>Open the listening audio</a>
						</audio>
						<div class="mt-2 text-sm" aria-live="polite">
							{#if listeningAcknowledgements[currentItem.id]}
								<p class="text-teal-800">
									Playback confirmed. This answer can count as listening evidence.
								</p>
							{:else if acknowledgingListeningItemId === currentItem.id}
								<p class="text-zinc-600">Confirming playback…</p>
							{:else if listeningAudioError}
								<p class="text-amber-900">{listeningAudioError}</p>
							{:else}
								<p class="text-zinc-600">Listen to the full recording before saving your answer.</p>
							{/if}
						</div>
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
						enctype="multipart/form-data"
						class="mt-6 space-y-5"
					>
						<input type="hidden" name="attemptId" value={assessment.attemptId} />
						<input type="hidden" name="itemId" value={currentItem.id} />
						{#if currentItem.audioUrl}
							<input
								type="hidden"
								name="listeningAcknowledgement"
								value={listeningAcknowledgements[currentItem.id] ?? ''}
							/>
						{/if}

						{#if currentItem.learnerTask.choices}
							<fieldset class="space-y-3">
								<legend class="sr-only">Choose one answer</legend>
								{#each currentItem.learnerTask.choices as choice (`${itemDomKey}:${choice.id}`)}
									{const choiceControlId = assessmentChoiceControlId(currentItem, choice.id)}
									<label
										for={choiceControlId}
										class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-zinc-300 p-3 hover:bg-zinc-50"
									>
										<input
											id={choiceControlId}
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
						{:else if currentItem.answerMode === 'short_text'}
							<label class="block space-y-2">
								<span class="font-medium text-zinc-950">Missing word</span>
								<input
									type="text"
									name="answer"
									maxlength="80"
									autocomplete="off"
									value={savedResponse?.kind === 'objective' ? savedResponse.answer : ''}
									required
									class="min-h-11 w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
								/>
							</label>
						{:else if currentItem.area === 'writing'}
							<label class="block space-y-2">
								<span class="font-medium text-zinc-950">Your response</span>
								<textarea
									name="answer"
									rows="7"
									maxlength="5000"
									required
									bind:value={writingDraft}
									aria-describedby="writing-word-count"
									class="w-full rounded-lg border border-zinc-300 px-3 py-3 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100"
								></textarea>
								<p
									id="writing-word-count"
									class={[
										'text-sm',
										writingWordCount >= writingWordMinimum && writingWordCount <= writingWordMaximum
											? 'text-teal-800'
											: 'text-zinc-600'
									]}
								>
									{writingWordCount} words · aim for {writingWordMinimum}–{writingWordMaximum}
								</p>
							</label>
						{:else}
							<div class="space-y-4">
								<div class="flex flex-wrap gap-3">
									<button
										type="button"
										class="min-h-11 rounded-lg bg-zinc-950 px-4 py-2 font-medium text-white"
										onclick={() => startRecording(currentItem.id)}
										disabled={recordingState !== 'idle'}
										>{recordingState === 'starting' ? 'Starting…' : 'Record answer'}</button
									>
									{#if recordingState === 'recording' && recordingItemId === currentItem.id}
										<button
											type="button"
											class="min-h-11 rounded-lg border border-red-300 px-4 py-2 font-medium text-red-800"
											onclick={stopRecording}>Stop ({recordingSeconds}s)</button
										>
									{/if}
								</div>
								<div class="text-sm text-zinc-600" aria-live="polite" aria-atomic="true">
									{#if recordingState === 'starting' && recordingItemId === currentItem.id}
										<p>Requesting microphone access.</p>
									{:else if recordingState === 'recording' && recordingItemId === currentItem.id}
										<p>Recording in progress.</p>
									{:else if recordingSeconds > 0}
										<p>Recording stopped and attached.</p>
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
										onchange={captureUploadedAudioDuration}
										disabled={recordingState !== 'idle'}
									/>
								</label>
								<input
									type="hidden"
									name="speakingSeconds"
									value={recordingSeconds ||
										(savedResponse?.kind === 'speaking_metadata'
											? savedResponse.metadata.responseSeconds
											: 1)}
								/>
								<p class="text-sm text-zinc-600" aria-live="polite">
									{audioDurationPending
										? 'Reading the recording duration…'
										: recordingSeconds > 0
											? `Recording duration: ${recordingSeconds} seconds (measured automatically).`
											: 'The recording duration is measured automatically.'}
								</p>
								<label class="block space-y-2">
									<span class="font-medium text-zinc-950">
										Typed practice transcript (optional, not scored as speaking)
									</span>
									<textarea
										name="speakingTranscript"
										rows="4"
										maxlength="5000"
										class="w-full rounded-lg border border-zinc-300 px-3 py-3"
										placeholder="Use this to save the words you wanted to say"
										disabled={recordingState !== 'idle'}
										>{savedResponse?.kind === 'speaking_metadata'
											? (savedResponse.metadata.transcript ?? '')
											: ''}</textarea
									>
								</label>
								<p class="text-sm text-zinc-600">
									Only uploaded or recorded audio can provide speaking evidence. Typed text is saved
									for practice but will leave the speaking area as insufficient evidence.
								</p>
								{#if recordingError}<p class="text-sm text-red-800" role="alert">
										{recordingError}
									</p>{/if}
								<p class="text-sm text-zinc-600">
									Aim for about 20–30 seconds so there is enough language to review. Audio is
									transcribed only to create feedback and is not stored. Pronunciation, fluency,
									intelligibility, and delivery are not scored.
								</p>
							</div>
						{/if}

						<div
							class="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-5"
						>
							<button
								type="button"
								class="min-h-11 rounded-lg border border-zinc-300 px-4 py-2 font-medium text-zinc-700 disabled:opacity-40"
								disabled={currentIndex === 0 || recordingState !== 'idle'}
								onclick={async () => {
									currentIndex -= 1;
									await focusStep();
								}}>Previous</button
							>
							<button
								class="min-h-11 rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white disabled:bg-zinc-400"
								disabled={stepForm.pending > 0 ||
									recordingState !== 'idle' ||
									audioDurationPending ||
									Boolean(currentItem.audioUrl && !listeningAcknowledgements[currentItem.id])}
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
			{/key}

			{#if savedCount === assessment.items.length}
				<form
					{...completeAssessment.enhance(async (form) => {
						if (await form.submit()) {
							assessment = form.result?.state ?? assessment;
							window.scrollTo({ top: 0, behavior: 'smooth' });
							await tick();
							resultsHeading?.focus();
						}
					})}
					class="rounded-xl border border-teal-200 bg-teal-50 p-5"
				>
					<input type="hidden" name="attemptId" value={assessment.attemptId} />
					<p class="font-medium text-teal-950">
						All {assessment.items.length} responses are saved.
					</p>
					<button
						class="mt-3 min-h-11 rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white disabled:bg-zinc-400"
						disabled={completeAssessment.pending > 0 || recordingState !== 'idle'}
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
					Quick readiness baseline complete
				</p>
				<h2
					class="mt-2 text-2xl font-semibold text-zinc-950"
					tabindex="-1"
					bind:this={resultsHeading}
				>
					Your Skill Profile is ready
				</h2>
				<p class="mt-2 font-medium text-zinc-800">
					Evidence coverage: {assessment.skillProfile.diagnosisQuality === 'full'
						? `Complete across ${assessment.skillProfile.assessedAreas?.length ?? 6} internal skill area(s) within your selected section(s)`
						: `Partial across ${assessment.skillProfile.assessedAreas?.length ?? 6} internal skill area(s) within your selected section(s)`}
				</p>
				<p class="mt-2 text-sm text-zinc-700">
					Evidence coverage only describes which responses could be reviewed. This is a starting
					practice profile, not a grade or full language-level result. These internal practice bands
					are not official placement scores, CEFR levels, or predictions that you will pass.
				</p>
				{#if assessment.skillProfile.diagnosisQuality === 'limited'}
					<p class="mt-2 text-sm text-amber-900">
						One or more selected responses could not be reviewed. Available objective answers were
						still scored, and unavailable selected areas are marked as insufficient evidence.
					</p>
				{/if}
			</div>

			<div class="rounded-2xl border border-zinc-200 bg-white p-6">
				<p class="text-sm font-semibold uppercase tracking-wide text-teal-800">Your study target</p>
				<h2 class="mt-2 text-2xl font-semibold text-zinc-950">
					{placementTestLabel(assessment.intake.placementTest.kind)}
				</h2>
				<p class="mt-2 text-sm text-zinc-600">
					This profile shapes practice only. Confirm the current sections and placement rules with
					your school.
				</p>
				<dl class="mt-5 grid gap-4 text-sm sm:grid-cols-2">
					<div>
						<dt class="font-medium text-zinc-600">School or institution</dt>
						<dd class="mt-1 text-zinc-950">
							{assessment.intake.placementTest.institution || 'Not provided'}
						</dd>
					</div>
					<div>
						<dt class="font-medium text-zinc-600">Target course, level, or outcome</dt>
						<dd class="mt-1 text-zinc-950">
							{assessment.intake.placementTest.targetOutcome || 'Not provided'}
						</dd>
					</div>
					<div>
						<dt class="font-medium text-zinc-600">Test date</dt>
						<dd class="mt-1 text-zinc-950">
							{formatTestDate(assessment.intake.placementTest.testDate)}
						</dd>
					</div>
					<div>
						<dt class="font-medium text-zinc-600">Known sections</dt>
						<dd class="mt-1 text-zinc-950">
							{assessment.intake.placementTest.knownSections || 'Not provided'}
						</dd>
					</div>
				</dl>
			</div>

			{#if wasAssessed('speaking', assessment.skillProfile.assessedAreas)}
				<p class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
					<strong>Speaking feedback limit:</strong> Speaking feedback reviews transcript-level language
					only. Pronunciation, fluency, intelligibility, and delivery are not scored.
				</p>
			{/if}

			<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
				{#each Object.entries(assessment.skillProfile.skillBands) as [area, band] (area)}
					{#if wasAssessed(area, assessment.skillProfile.assessedAreas)}
						<div class="rounded-xl border border-zinc-200 bg-white p-4">
							<p class="text-sm font-medium capitalize text-zinc-600">{readable(area)}</p>
							<p class="mt-1 text-lg font-semibold capitalize text-zinc-950">
								Internal practice band: {readable(band)}
							</p>
							<p class="mt-1 text-sm text-zinc-600">
								{assessment.skillProfile.evidenceCounts[
									area as keyof typeof assessment.skillProfile.evidenceCounts
								]} evidence item(s)
							</p>
							<p class="mt-2 text-sm text-zinc-700">
								{assessment.skillProfile.areaFeedback[
									area as keyof typeof assessment.skillProfile.areaFeedback
								]}
							</p>
						</div>
					{/if}
				{/each}
			</div>

			<div class="rounded-2xl border border-zinc-200 bg-white p-6">
				<h2 class="text-xl font-semibold text-zinc-950">
					Practice priorities from these responses
				</h2>
				{#if assessment.studyPlan.targets.length}
					<ol class="mt-4 space-y-3">
						{#each assessment.studyPlan.targets as target (`${target.area}:${target.signal}`)}
							<li class="flex gap-3 text-zinc-700">
								<span class="font-semibold text-teal-700">{target.priority}.</span>
								<span>
									<span class="capitalize">{readable(target.signal)} · {readable(target.area)}</span
									>
									{#if target.reason}<span class="mt-1 block text-sm text-zinc-600">
											{target.reason}
										</span>{/if}
								</span>
							</li>
						{/each}
					</ol>
				{:else}
					<p class="mt-3 text-zinc-600">No high-priority error signal was found.</p>
				{/if}
			</div>

			<div class="rounded-2xl border border-zinc-200 bg-white p-6">
				<h2 class="text-xl font-semibold text-zinc-950">Review your corrections</h2>
				<p class="mt-2 text-sm text-zinc-600">
					Use these explanations to understand the evidence behind your next practice priorities.
				</p>
				{#if assessment.skillProfile.missedAnswerExamples.length}
					<div class="mt-4 space-y-4">
						{#each assessment.skillProfile.missedAnswerExamples as example (`${example.itemId}:${example.itemVersion ?? 'legacy'}:${example.learnerAnswer}`)}
							<article class="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
								<p class="text-sm font-semibold uppercase tracking-wide text-teal-800">
									{readable(example.area)}
								</p>
								{#if example.stimulus || example.learnerQuestion}
									<dl class="mt-3 space-y-3 text-sm text-zinc-700">
										{#if example.stimulus}
											<div>
												<dt class="font-medium text-zinc-600">Stimulus</dt>
												<dd class="mt-1 text-zinc-950">{example.stimulus}</dd>
											</div>
										{/if}
										{#if example.learnerQuestion}
											<div>
												<dt class="font-medium text-zinc-600">Question</dt>
												<dd class="mt-1 text-zinc-950">{example.learnerQuestion}</dd>
											</div>
										{/if}
									</dl>
								{/if}
								{#if example.audioUrl && example.audioTranscript}
									<div class="mt-4 rounded-lg border border-zinc-200 bg-white p-3">
										<p class="font-medium text-zinc-950">Replay the listening correction</p>
										<audio class="mt-2 w-full" controls preload="metadata" src={example.audioUrl}>
											<a href={example.audioUrl}>Open the listening audio</a>
										</audio>
										<details class="mt-2">
											<summary class="min-h-11 cursor-pointer py-2 font-medium text-teal-800">
												Read the transcript after replaying
											</summary>
											<p class="text-zinc-700">{example.audioTranscript}</p>
										</details>
									</div>
								{/if}
								<dl class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
									<div>
										<dt class="font-medium text-zinc-600">Your answer</dt>
										<dd class="mt-1 text-zinc-950">{example.learnerAnswer}</dd>
									</div>
									<div>
										<dt class="font-medium text-zinc-600">Expected answer</dt>
										<dd class="mt-1 font-medium text-zinc-950">{example.expectedAnswer}</dd>
									</div>
								</dl>
								<p class="mt-3 text-zinc-700">{example.explanation}</p>
								<p class="mt-2 text-sm text-zinc-600">
									Practice focus: {example.errorSignals.map(readable).join(' · ')}
								</p>
							</article>
						{/each}
					</div>
				{:else}
					<p class="mt-4 text-zinc-600">
						No objective corrections were needed in this short baseline. Continue with mixed
						practice to check the same skills in new examples.
					</p>
				{/if}
			</div>

			<div class="rounded-2xl border border-zinc-200 bg-white p-5 text-sm text-zinc-700">
				<h2 class="text-lg font-semibold text-zinc-950">When to use another baseline</h2>
				{#if assessment.reassessment?.recommended && assessment.reassessment.sameTargetAvailable}
					<p class="mt-2">
						<a class="font-medium text-teal-800 underline" href="/progress">Progress</a> now recommends
						a same-target reassessment because you have enough distributed practice evidence. Use the
						undisclosed alternate form to check whether the skill transfers.
					</p>
				{:else if assessment.reassessment?.sameTargetAvailable}
					<p class="mt-2">
						Keep practicing this target until
						<a class="font-medium text-teal-800 underline" href="/progress">Progress</a>
						recommends a same-target reassessment; waiting makes the comparison more useful.
					</p>
				{:else}
					<p class="mt-2">
						No reviewed form made entirely of undisclosed tasks remains for this same target.
					</p>
				{/if}
				{#if assessment.reassessment?.anyBaselineAvailable}
					<p class="mt-2">
						A changed test profile or section subset can start only when every task it would use is
						still undisclosed.
					</p>
				{:else}
					<p class="mt-2">
						Every reviewed baseline option contains a task you have already seen, so another
						baseline is unavailable. Keep practicing while new reviewed forms are prepared.
					</p>
				{/if}
			</div>

			<div class="flex flex-wrap gap-3">
				<a
					class="inline-flex min-h-11 items-center rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white"
					href="/practice">Start today’s practice</a
				>
				{#if assessment.reassessment?.anyBaselineAvailable}
					<button
						type="button"
						class="min-h-11 rounded-lg border border-zinc-300 px-5 py-2 font-medium text-zinc-700"
						onclick={() => {
							writingDraft = '';
							showNewIntake = true;
						}}
						>{assessment.reassessment.recommended && assessment.reassessment.sameTargetAvailable
							? 'Set up recommended reassessment'
							: 'Change profile or sections'}</button
					>
				{/if}
			</div>
		</section>
	{/if}
</main>

<style>
	.assessment-page :is(a, button, input, select, textarea, audio):focus-visible {
		outline: 3px solid #0f766e;
		outline-offset: 3px;
	}
</style>
