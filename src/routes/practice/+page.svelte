<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import AppNav from '$lib/AppNav.svelte';
	import { readAudioDurationSeconds } from '$lib/audio-duration';
	import { getLearnerGuide } from '$lib/learner-guides';
	import { getPracticeSession, startPracticeSession, submitPractice } from './data.remote';

	const page = await getPracticeSession();
	let session = $state(page.state);
	let heading: HTMLHeadingElement | undefined = $state();
	let recording = $state(false);
	let recordingStarting = $state(false);
	let recordingSeconds = $state(0);
	let audioDurationPending = $state(false);
	let recordingError = $state('');
	let listeningAudioError = $state('');
	let listeningAudioElement: HTMLAudioElement | null = $state(null);
	let acknowledgingListeningPracticeId = $state<string | null>(null);
	let acknowledgedListeningPracticeIds = $state<Record<string, boolean>>({});
	let recorder: MediaRecorder | null = null;
	let cleanupRecording: (() => void) | null = null;
	let destroyed = false;
	const recordingBusy = $derived(recording || recordingStarting);

	const readable = (value: string) => value.replaceAll('_', ' ');

	async function focusHeading() {
		await tick();
		heading?.focus();
	}

	function captureHeading(node: HTMLHeadingElement) {
		heading = node;
		return () => {
			if (heading === node) heading = undefined;
		};
	}

	async function acknowledgeListeningPlayback(practiceId: string, audioUrl: string) {
		if (
			acknowledgedListeningPracticeIds[practiceId] ||
			acknowledgingListeningPracticeId === practiceId
		)
			return;
		acknowledgingListeningPracticeId = practiceId;
		listeningAudioError = '';
		try {
			const response = await fetch(audioUrl, { method: 'POST' });
			if (!response.ok) throw new Error('Playback acknowledgement failed.');
			acknowledgedListeningPracticeIds[practiceId] = true;
		} catch {
			listeningAudioError =
				'We could not confirm playback. Check your connection, then play the audio again.';
		} finally {
			if (acknowledgingListeningPracticeId === practiceId) {
				acknowledgingListeningPracticeId = null;
			}
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

	async function startRecording(practiceId: string) {
		if (recording || recordingStarting || destroyed) return;
		if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
			recordingError = 'Recording is unavailable. Upload audio or type a transcript.';
			return;
		}
		recordingStarting = true;
		let localStream: MediaStream | null = null;
		try {
			recordingError = '';
			const chunks: Blob[] = [];
			localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
			if (destroyed || !recordingStarting) {
				localStream.getTracks().forEach((track) => track.stop());
				return;
			}
			const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
			const localRecorder = new MediaRecorder(localStream, mimeType ? { mimeType } : undefined);
			const localStartedAt = Date.now();
			const localTimer = setInterval(() => {
				recordingSeconds = Math.max(1, Math.round((Date.now() - localStartedAt) / 1000));
			}, 250);
			let cleaned = false;
			const cleanup = () => {
				if (cleaned) return;
				cleaned = true;
				clearInterval(localTimer);
				localStream?.getTracks().forEach((track) => track.stop());
				if (recorder === localRecorder) recorder = null;
				if (cleanupRecording === cleanup) cleanupRecording = null;
				recording = false;
				recordingStarting = false;
			};
			recorder = localRecorder;
			cleanupRecording = cleanup;
			recordingSeconds = 1;
			recording = true;
			recordingStarting = false;
			localRecorder.ondataavailable = (event) => {
				if (event.data.size) chunks.push(event.data);
			};
			localRecorder.onstop = () => {
				cleanup();
				const file = new File(chunks, `practice-${practiceId}.webm`, {
					type: localRecorder.mimeType || 'audio/webm'
				});
				const input = document.getElementById(
					`practice-audio-${practiceId}`
				) as HTMLInputElement | null;
				if (file.size && input) {
					const transfer = new DataTransfer();
					transfer.items.add(file);
					input.files = transfer.files;
				}
			};
			localRecorder.start();
		} catch {
			cleanupRecording?.();
			localStream?.getTracks().forEach((track) => track.stop());
			recording = false;
			recordingStarting = false;
			if (!destroyed) {
				recordingError = 'Microphone access was blocked. Upload audio or type a transcript.';
			}
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
			recordingSeconds = await readAudioDurationSeconds(file, 180);
		} catch {
			input.value = '';
			recordingError = 'We could not read that recording’s duration. Choose another audio file.';
		} finally {
			audioDurationPending = false;
		}
	}

	onDestroy(() => {
		destroyed = true;
		recordingStarting = false;
		if (recorder?.state === 'recording') recorder.stop();
		cleanupRecording?.();
	});
</script>

<svelte:head><title>Daily Practice · ESL Study Guide</title></svelte:head>

<AppNav current="practice" />

<main class="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:py-12">
	<header class="space-y-3">
		<p class="text-sm font-semibold uppercase tracking-wide text-teal-700">Daily practice</p>
		<h1 class="text-3xl font-semibold text-zinc-950 sm:text-4xl">Five focused problems</h1>
		<p class="max-w-2xl text-zinc-700">
			A roughly 10-minute session that adapts to your current priorities. Each problem is saved
			before you see it.
		</p>
		{#if session}
			<p class="max-w-3xl rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
				<strong class="text-zinc-950">Active test profile:</strong>
				{session.placementProfile.label} ·
				{session.placementProfile.sections.join(' · ')}
			</p>
		{/if}
	</header>

	{#if !session}
		<section class="rounded-2xl border border-zinc-200 bg-white p-6">
			<h2 class="text-xl font-semibold text-zinc-950">Complete your Skill Diagnosis first</h2>
			<p class="mt-2 text-zinc-600">Your diagnosis selects the skills and starting level.</p>
			<a
				class="mt-5 inline-flex min-h-11 items-center rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white"
				href="/assessment">Go to Skill Diagnosis</a
			>
		</section>
	{:else if !session.sessionId || (session.completed && !session.problem)}
		<section class="rounded-2xl border border-zinc-200 bg-white p-6">
			{#if session.completed}
				<p class="text-sm font-semibold uppercase tracking-wide text-teal-700">Session complete</p>
				<h2 class="mt-2 text-2xl font-semibold text-zinc-950">Nice work — all five are done</h2>
				<div class="mt-5 space-y-3">
					{#each session.results as result (result.practiceId)}
						<div class="rounded-lg border border-zinc-200 p-3 text-sm">
							<p class="font-medium capitalize text-zinc-950">
								{result.sequence}. {readable(result.targetArea)} · {readable(result.targetSignal)} · {readable(
									result.difficulty
								)}
							</p>
							{#if result.audioUrl && result.audioTranscript}
								<div class="mt-3 rounded-lg bg-zinc-50 p-3">
									<p class="font-medium text-zinc-950">Replay the listening evidence</p>
									<audio class="mt-2 w-full" controls preload="metadata" src={result.audioUrl}>
										<a href={result.audioUrl}>Open the listening audio</a>
									</audio>
									<details class="mt-2">
										<summary class="min-h-11 cursor-pointer py-2 font-medium text-teal-800"
											>Read the transcript after listening</summary
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
			{:else}
				<h2 class="text-2xl font-semibold text-zinc-950">Ready for today’s session?</h2>
				<p class="mt-2 text-zinc-600">
					Five focused responses drawn only from your assessed profile areas and current priorities.
				</p>
			{/if}
			<form
				{...startPracticeSession.enhance(async (form) => {
					if (await form.submit()) {
						session = form.result?.state ?? session;
						await focusHeading();
					}
				})}
				class="mt-6"
			>
				<input type="hidden" name="intent" value="start-practice" />
				<button
					class="min-h-11 rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white disabled:bg-zinc-400"
					disabled={startPracticeSession.pending > 0}
				>
					{startPracticeSession.pending > 0
						? 'Preparing…'
						: session.completed
							? 'Start another session'
							: 'Start five problems'}
				</button>
			</form>
			<div aria-live="polite">
				{#each startPracticeSession.fields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
					<p class="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{issue.message}</p>
				{/each}
			</div>
		</section>
	{:else if session.problem}
		{const problem = session.problem}
		{const responseForm = submitPractice.for(problem.practiceId)}
		{const guide = getLearnerGuide(problem.targetSignal)}
		<section class="space-y-5">
			<div class="space-y-2">
				<div class="flex justify-between text-sm text-zinc-600">
					<span>Problem {problem.sequence} of {problem.totalProblems}</span>
					<span class="capitalize">{readable(problem.difficulty)}</span>
				</div>
				<div
					class="h-2 overflow-hidden rounded-full bg-zinc-200"
					role="progressbar"
					aria-label="Daily practice progress"
					aria-valuemin="1"
					aria-valuemax={problem.totalProblems}
					aria-valuenow={problem.sequence}
					aria-valuetext={`Problem ${problem.sequence} of ${problem.totalProblems}`}
				>
					<div
						class="h-full rounded-full bg-teal-600"
						style={`width: ${(problem.sequence / problem.totalProblems) * 100}%`}
					></div>
				</div>
			</div>

			<article class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
				<p class="text-sm font-semibold uppercase tracking-wide text-teal-700">
					{readable(problem.targetSignal)} · {readable(problem.targetArea)}
				</p>
				{#if problem.kind === 'listening_choice'}
					<p class="mt-1 text-sm capitalize text-zinc-600">
						Test-style task: {readable(problem.placementTaskType)}
					</p>
				{:else if (problem.kind === 'choice' || problem.kind === 'fill') && problem.placementTaskType}
					<p class="mt-1 text-sm capitalize text-zinc-600">
						{problem.placementTaskType === 'targeted_skill_drill'
							? 'Targeted skill drill'
							: `Test-style task: ${readable(problem.placementTaskType)}`}
					</p>
				{/if}
				<h2
					class="mt-2 text-2xl font-semibold text-zinc-950"
					tabindex="-1"
					{@attach captureHeading}
				>
					{problem.prompt}
				</h2>

				<aside class="mt-5 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-zinc-800">
					<p class="font-semibold text-sky-950">Quick lesson: {guide.label}</p>
					<p class="mt-2"><strong>Rule:</strong> {guide.rule}</p>
					<p class="mt-2"><strong>Worked example:</strong> {guide.workedExample}</p>
					<p class="mt-2"><strong>Hint for this problem:</strong> {guide.hint}</p>
					<details class="mt-3">
						<summary class="min-h-11 cursor-pointer py-2 font-medium text-sky-900"
							>中文提示（可选）</summary
						>
						<p>{guide.chineseClarification}</p>
					</details>
				</aside>

				{#if !responseForm.result}
					<form {...responseForm} class="mt-6 space-y-5" enctype="multipart/form-data">
						<input type="hidden" name="practiceId" value={problem.practiceId} />
						<input type="hidden" name="kind" value={problem.kind} />
						{#if problem.kind === 'choice' || problem.kind === 'listening_choice'}
							{#if problem.kind === 'listening_choice'}
								<div class="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
									<p class="mb-3 font-medium text-zinc-950">
										Play the audio before choosing your answer.
									</p>
									<button
										type="button"
										class="mb-3 min-h-11 rounded-lg bg-zinc-950 px-4 py-2 font-medium text-white"
										onclick={playListeningAudio}>Play full recording</button
									>
									<audio
										bind:this={listeningAudioElement}
										class="w-full"
										controls
										preload="metadata"
										src={problem.audioUrl}
										onended={() =>
											acknowledgeListeningPlayback(problem.practiceId, problem.audioUrl)}
										oncanplay={() => (listeningAudioError = '')}
										onerror={() =>
											(listeningAudioError =
												'Audio is unavailable. Try again later; this listening response cannot be submitted yet.')}
									>
										<a href={problem.audioUrl}>Open the listening audio</a>
									</audio>
									{#if listeningAudioError}
										<p class="mt-3 text-sm text-amber-900" role="status">
											{listeningAudioError}
										</p>
									{:else if acknowledgedListeningPracticeIds[problem.practiceId]}
										<p class="mt-3 text-sm text-teal-800" role="status">
											Playback confirmed. This answer can count as listening evidence.
										</p>
									{:else if acknowledgingListeningPracticeId === problem.practiceId}
										<p class="mt-3 text-sm text-zinc-600" role="status">Confirming playback…</p>
									{:else}
										<p class="mt-3 text-sm text-zinc-600" role="status">
											Listen to the full recording to unlock the answer.
										</p>
									{/if}
								</div>
							{/if}
							<fieldset class="space-y-3">
								<legend class="sr-only">Choose one answer</legend>
								{#each problem.choices as choice (choice.id)}
									<label
										class="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-zinc-300 p-3 hover:bg-zinc-50"
									>
										<input
											class="h-5 w-5 accent-teal-700"
											type="radio"
											name="answer"
											value={choice.id}
											required
										/>
										<span>{choice.text}</span>
									</label>
								{/each}
							</fieldset>
						{:else if problem.kind === 'fill'}
							<label class="block space-y-2">
								<span class="font-medium text-zinc-950">Your answer</span>
								<input
									class="min-h-11 w-full rounded-lg border border-zinc-300 px-3"
									name="answer"
									maxlength="160"
									required
									autocomplete="off"
								/>
							</label>
						{:else if problem.kind === 'short_text'}
							<label class="block space-y-2">
								<span class="font-medium text-zinc-950">Your response</span>
								<textarea
									class="w-full rounded-lg border border-zinc-300 px-3 py-3"
									name="text"
									rows="6"
									maxlength="2000"
									required></textarea>
							</label>
						{:else}
							<div class="space-y-4">
								<div class="flex flex-wrap gap-3">
									<button
										class="min-h-11 rounded-lg bg-zinc-950 px-4 py-2 font-medium text-white"
										type="button"
										onclick={() => startRecording(problem.practiceId)}
										disabled={recordingBusy}
										>{recordingStarting ? 'Requesting microphone…' : 'Record'}</button
									>
									{#if recording}
										<button
											class="min-h-11 rounded-lg border border-red-300 px-4 py-2 font-medium text-red-800"
											type="button"
											onclick={stopRecording}>Stop ({recordingSeconds}s)</button
										>
									{/if}
								</div>
								<div class="text-sm text-zinc-600" aria-live="polite" aria-atomic="true">
									{#if recordingStarting}
										<p>Requesting microphone access.</p>
									{:else if recording}
										<p>Recording in progress.</p>
									{:else if recordingSeconds > 0}
										<p>Recording stopped and attached.</p>
									{/if}
								</div>
								<label class="block space-y-2">
									<span class="font-medium text-zinc-950">Or upload audio</span>
									<input
										id={`practice-audio-${problem.practiceId}`}
										class="block min-h-11 w-full rounded-lg border border-zinc-300 p-2"
										type="file"
										name="audio"
										accept="audio/webm,audio/wav,audio/mpeg,audio/mp4,audio/ogg"
										onchange={captureUploadedAudioDuration}
									/>
								</label>
								<input type="hidden" name="responseSeconds" value={recordingSeconds || 1} />
								<p class="text-sm text-zinc-600" aria-live="polite">
									{audioDurationPending
										? 'Reading the recording duration…'
										: recordingSeconds > 0
											? `Recording duration: ${recordingSeconds} seconds (measured automatically).`
											: 'The recording duration is measured automatically.'}
								</p>
								<label class="block space-y-2">
									<span class="font-medium text-zinc-950">Typed practice script (optional)</span>
									<textarea
										class="w-full rounded-lg border border-zinc-300 px-3 py-3"
										name="transcript"
										rows="4"
										maxlength="2400"
										aria-describedby={`practice-transcript-note-${problem.practiceId}`}
										placeholder="Type what you planned to say if audio is unavailable"></textarea>
									<p
										id={`practice-transcript-note-${problem.practiceId}`}
										class="text-sm text-zinc-600"
									>
										A typed script can be saved for practice, but only a transcript made from your
										audio can count as speaking evidence.
									</p>
								</label>
								{#if recordingError}<p class="text-sm text-red-800" role="alert">
										{recordingError}
									</p>{/if}
							</div>
						{/if}
						<button
							class="min-h-11 rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white disabled:bg-zinc-400"
							disabled={responseForm.pending > 0 ||
								recordingBusy ||
								audioDurationPending ||
								(problem.kind === 'listening_choice' &&
									!acknowledgedListeningPracticeIds[problem.practiceId])}
						>
							{responseForm.pending > 0 ? 'Checking…' : 'Check response'}
						</button>
					</form>
				{:else}
					<div class="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-5" aria-live="polite">
						{#if responseForm.result.result.feedback.kind === 'objective'}
							<p class="font-semibold text-zinc-950">
								{!responseForm.result.result.feedback.scored
									? 'Response saved — not scored'
									: responseForm.result.result.feedback.correct
										? 'Correct'
										: 'Keep building'}
							</p>
							<p class="mt-2 text-zinc-700">{responseForm.result.result.feedback.message}</p>
							{#if problem.kind === 'listening_choice' && responseForm.result.result.feedback.audioTranscript}
								<div class="mt-4 rounded-lg border border-teal-200 bg-white p-3">
									<p class="font-semibold text-zinc-950">Replay and repair</p>
									<audio class="mt-2 w-full" controls preload="metadata" src={problem.audioUrl}>
										<a href={problem.audioUrl}>Open the listening audio</a>
									</audio>
									<details class="mt-2">
										<summary class="min-h-11 cursor-pointer py-2 font-medium text-teal-800"
											>Read the transcript after replaying</summary
										>
										<p class="text-zinc-700">
											{responseForm.result.result.feedback.audioTranscript}
										</p>
									</details>
								</div>
							{/if}
							<dl class="mt-3 space-y-3 text-zinc-700">
								<div>
									<dt class="font-semibold text-zinc-950">Prompt</dt>
									<dd>{responseForm.result.result.feedback.prompt ?? problem.prompt}</dd>
								</div>
								<div>
									<dt class="font-semibold text-zinc-950">Your answer</dt>
									<dd>{responseForm.result.result.feedback.learnerAnswer ?? 'Answer saved'}</dd>
								</div>
								<div>
									<dt class="font-semibold text-zinc-950">Correct answer</dt>
									<dd>{responseForm.result.result.feedback.expectedAnswer ?? 'Unavailable'}</dd>
								</div>
								<div>
									<dt class="font-semibold text-zinc-950">Why</dt>
									<dd>{responseForm.result.result.feedback.explanation}</dd>
								</div>
								<div>
									<dt class="font-semibold text-zinc-950">Try next</dt>
									<dd>{responseForm.result.result.feedback.nextStep ?? guide.practiceNext}</dd>
								</div>
							</dl>
						{:else}
							<p class="font-semibold text-zinc-950">
								{responseForm.result.result.feedback.scored ? 'Feedback' : 'Response saved'}
							</p>
							<p class="mt-2 text-zinc-700">{responseForm.result.result.feedback.strength}</p>
							<p class="mt-2 text-zinc-700">
								<strong>Correction:</strong>
								{responseForm.result.result.feedback.correction}
							</p>
							<p class="mt-2 text-zinc-700">
								<strong>Next tip:</strong>
								{responseForm.result.result.feedback.nextTip}
							</p>
						{/if}
						<a
							class="mt-4 inline-flex min-h-11 items-center rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white"
							href="/practice"
							data-sveltekit-reload>{problem.sequence === 5 ? 'View session recap' : 'Continue'}</a
						>
					</div>
				{/if}

				<div aria-live="polite">
					{#each responseForm.fields.allIssues() ?? [] as issue, index (`${issue.message}-${index}`)}
						<p class="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{issue.message}</p>
					{/each}
				</div>
			</article>
		</section>
	{/if}
</main>
