<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import AppNav from '$lib/AppNav.svelte';
	import { getPracticeSession, startPracticeSession, submitPractice } from './data.remote';

	const page = await getPracticeSession();
	let session = $state(page.state);
	let heading: HTMLHeadingElement | undefined = $state();
	let recording = $state(false);
	let recordingSeconds = $state(0);
	let recordingError = $state('');
	let recorder: MediaRecorder | null = null;
	let stream: MediaStream | null = null;
	let timer: ReturnType<typeof setInterval> | null = null;
	let startedAt = 0;

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

	async function startRecording(practiceId: string) {
		if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
			recordingError = 'Recording is unavailable. Upload audio or type a transcript.';
			return;
		}
		try {
			recordingError = '';
			const chunks: Blob[] = [];
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
			recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
			startedAt = Date.now();
			recordingSeconds = 1;
			recording = true;
			timer = setInterval(() => {
				recordingSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
			}, 250);
			recorder.ondataavailable = (event) => {
				if (event.data.size) chunks.push(event.data);
			};
			recorder.onstop = () => {
				if (timer) clearInterval(timer);
				timer = null;
				stream?.getTracks().forEach((track) => track.stop());
				stream = null;
				recording = false;
				const file = new File(chunks, `practice-${practiceId}.webm`, {
					type: recorder?.mimeType || 'audio/webm'
				});
				const input = document.getElementById(`practice-audio-${practiceId}`) as HTMLInputElement;
				if (file.size && input) {
					const transfer = new DataTransfer();
					transfer.items.add(file);
					input.files = transfer.files;
				}
			};
			recorder.start();
		} catch {
			stream?.getTracks().forEach((track) => track.stop());
			stream = null;
			recording = false;
			recordingError = 'Microphone access was blocked. Upload audio or type a transcript.';
		}
	}

	function stopRecording() {
		if (recorder?.state === 'recording') recorder.stop();
	}

	onDestroy(() => {
		if (timer) clearInterval(timer);
		stream?.getTracks().forEach((track) => track.stop());
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
								{result.sequence}. {readable(result.targetSignal)} · {readable(result.difficulty)}
							</p>
							{#if result.feedback.kind === 'objective'}
								<p class={result.feedback.correct ? 'text-teal-800' : 'text-amber-900'}>
									{result.feedback.message}
								</p>
							{:else}
								<p class="text-zinc-700">{result.feedback.strength}</p>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<h2 class="text-2xl font-semibold text-zinc-950">Ready for today’s session?</h2>
				<p class="mt-2 text-zinc-600">
					Four quick responses and one short writing or speaking task.
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
		<section class="space-y-5">
			<div class="space-y-2">
				<div class="flex justify-between text-sm text-zinc-600">
					<span>Problem {problem.sequence} of {problem.totalProblems}</span>
					<span class="capitalize">{readable(problem.difficulty)}</span>
				</div>
				<div class="h-2 overflow-hidden rounded-full bg-zinc-200">
					<div
						class="h-full rounded-full bg-teal-600"
						style={`width: ${(problem.sequence / 5) * 100}%`}
					></div>
				</div>
			</div>

			<article class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
				<p class="text-sm font-semibold uppercase tracking-wide text-teal-700">
					{readable(problem.targetSignal)} · {readable(problem.targetArea)}
				</p>
				<h2
					class="mt-2 text-2xl font-semibold text-zinc-950"
					tabindex="-1"
					{@attach captureHeading}
				>
					{problem.prompt}
				</h2>

				{#if !responseForm.result}
					<form {...responseForm} class="mt-6 space-y-5">
						<input type="hidden" name="practiceId" value={problem.practiceId} />
						<input type="hidden" name="kind" value={problem.kind} />
						{#if problem.kind === 'choice'}
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
										disabled={recording}>Record</button
									>
									{#if recording}
										<button
											class="min-h-11 rounded-lg border border-red-300 px-4 py-2 font-medium text-red-800"
											type="button"
											onclick={stopRecording}>Stop ({recordingSeconds}s)</button
										>
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
									/>
								</label>
								<label class="block space-y-2">
									<span class="font-medium text-zinc-950">Response length in seconds</span>
									<input
										class="min-h-11 w-36 rounded-lg border border-zinc-300 px-3"
										type="number"
										name="responseSeconds"
										min="1"
										max="180"
										value={recordingSeconds || 20}
										required
									/>
								</label>
								<label class="block space-y-2">
									<span class="font-medium text-zinc-950">Transcript fallback (optional)</span>
									<textarea
										class="w-full rounded-lg border border-zinc-300 px-3 py-3"
										name="transcript"
										rows="4"
										maxlength="2400"
										placeholder="Type what you said if audio is unavailable"></textarea>
								</label>
								{#if recordingError}<p class="text-sm text-red-800">{recordingError}</p>{/if}
							</div>
						{/if}
						<button
							class="min-h-11 rounded-lg bg-teal-700 px-5 py-2 font-semibold text-white disabled:bg-zinc-400"
							disabled={responseForm.pending > 0 || recording}
						>
							{responseForm.pending > 0 ? 'Checking…' : 'Check response'}
						</button>
					</form>
				{:else}
					<div class="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-5" aria-live="polite">
						{#if responseForm.result.result.feedback.kind === 'objective'}
							<p class="font-semibold text-zinc-950">
								{responseForm.result.result.feedback.correct ? 'Correct' : 'Keep building'}
							</p>
							<p class="mt-2 text-zinc-700">{responseForm.result.result.feedback.message}</p>
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
