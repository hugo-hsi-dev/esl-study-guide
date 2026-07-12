<script lang="ts">
	import AppNav from '$lib/AppNav.svelte';
	import { getTestGuide } from './data.remote';

	const data = await getTestGuide();
</script>

<svelte:head><title>Test Guide · ESL Study Guide</title></svelte:head>

<AppNav current="guide" />

<main class="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:py-12">
	<header class="space-y-3">
		<p class="text-sm font-semibold uppercase tracking-wide text-teal-700">Test guide</p>
		<h1 class="text-3xl font-semibold text-zinc-950 sm:text-4xl">
			Know what your placement test expects
		</h1>
		<p class="max-w-3xl text-zinc-700">
			{data.learnerName}, use this guide to identify your test, recognize its task formats, and ask
			your school the right questions before test day.
		</p>
	</header>

	<aside
		class="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6"
		aria-labelledby="placement-limit-heading"
	>
		<h2 id="placement-limit-heading" class="text-xl font-semibold text-amber-950">
			Your school makes the placement decision
		</h2>
		<p class="mt-2 max-w-3xl text-amber-950">
			This app gives study guidance and shows practice evidence. It does not issue an official
			ACCUPLACER, Cambridge, CEFR, or school placement score, and practice accuracy is not a pass
			result. Ask your school which sections and placement rules apply to you.
		</p>
	</aside>

	<section class="space-y-4" aria-labelledby="profiles-heading">
		<div class="space-y-2">
			<h2 id="profiles-heading" class="text-2xl font-semibold text-zinc-950">
				Compare the built-in profiles
			</h2>
			<p class="max-w-3xl text-zinc-600">
				Choose the named profile only when your school confirms it. Otherwise, use the
				school-specific or unknown profile.
			</p>
		</div>

		<div class="grid gap-5 lg:grid-cols-3">
			<article
				class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
				aria-labelledby="accuplacer-heading"
			>
				<p class="text-sm font-semibold uppercase tracking-wide text-teal-700">College Board</p>
				<h3 id="accuplacer-heading" class="mt-2 text-xl font-semibold text-zinc-950">
					ACCUPLACER ESL
				</h3>
				<dl class="mt-5 space-y-4">
					<div>
						<dt class="font-semibold text-zinc-950">Sections</dt>
						<dd class="mt-1 text-zinc-700">
							Sentence Meaning, Language Use, Reading Skills, and Listening.
						</dd>
					</div>
					<div>
						<dt class="font-semibold text-zinc-950">Task format</dt>
						<dd class="mt-1 text-zinc-700">
							Four multiple-choice tests with 20 questions per test. Some schools also use the
							optional WritePlacer ESL essay, approximately 300–600 words.
						</dd>
					</div>
					<div>
						<dt class="font-semibold text-zinc-950">Confirm with your school</dt>
						<dd class="mt-1 text-zinc-700">
							Which tests are required, whether WritePlacer is included, and the course placement
							rules your school uses.
						</dd>
					</div>
				</dl>
			</article>

			<article
				class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
				aria-labelledby="cept-heading"
			>
				<p class="text-sm font-semibold uppercase tracking-wide text-teal-700">Cambridge English</p>
				<h3 id="cept-heading" class="mt-2 text-xl font-semibold text-zinc-950">Cambridge CEPT</h3>
				<dl class="mt-5 space-y-4">
					<div>
						<dt class="font-semibold text-zinc-950">Sections</dt>
						<dd class="mt-1 text-zinc-700">
							Two official components: Reading and Listening. Language knowledge is tested through
							question types within Reading; it is not a separate CEPT component.
						</dd>
					</div>
					<div>
						<dt class="font-semibold text-zinc-950">Task format</dt>
						<dd class="mt-1 text-zinc-700">
							The computer-adaptive Reading component includes read-and-select, gapped sentences,
							multiple-choice and open gap-fill, and extended reading. Listening includes
							listen-and-select and extended listening. Extended reading and listening tasks use
							linked question series based on one shared passage or recording. A typical test takes
							about 30 minutes; the question count varies.
						</dd>
					</div>
					<div>
						<dt class="font-semibold text-zinc-950">How this guide practices it</dt>
						<dd class="mt-1 text-zinc-700">
							The CEPT readiness baseline samples linked extended reading and listening series.
							Daily practice names a single-question CEPT format only when the item actually matches
							it; other exercises are labeled as targeted skill drills. A single question is never
							labeled as an extended series.
						</dd>
					</div>
					<div>
						<dt class="font-semibold text-zinc-950">Confirm with your school</dt>
						<dd class="mt-1 text-zinc-700">
							That CEPT is the current test and how its result maps to your course options.
						</dd>
					</div>
				</dl>
			</article>

			<article
				class="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"
				aria-labelledby="school-profile-heading"
			>
				<p class="text-sm font-semibold uppercase tracking-wide text-teal-700">
					Start here if unsure
				</p>
				<h3 id="school-profile-heading" class="mt-2 text-xl font-semibold text-zinc-950">
					School-specific or unknown
				</h3>
				<dl class="mt-5 space-y-4">
					<div>
						<dt class="font-semibold text-zinc-950">Sections</dt>
						<dd class="mt-1 text-zinc-700">
							Use a general ESL readiness baseline until your school confirms its current sections.
						</dd>
					</div>
					<div>
						<dt class="font-semibold text-zinc-950">Task format</dt>
						<dd class="mt-1 text-zinc-700">
							May include grammar and language use, reading, listening, writing, or speaking in a
							school-defined combination.
						</dd>
					</div>
					<div>
						<dt class="font-semibold text-zinc-950">What to collect</dt>
						<dd class="mt-1 text-zinc-700">
							Institution name, target course or outcome, test date, known sections, and the
							school’s placement and retest rules.
						</dd>
					</div>
				</dl>
			</article>
		</div>
	</section>

	<section
		id="before-test-day"
		class="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-7"
		aria-labelledby="checklist-heading"
	>
		<h2 id="checklist-heading" class="text-2xl font-semibold text-zinc-950">
			Practical pre-test checklist
		</h2>
		<ol class="mt-5 grid gap-4 sm:grid-cols-2">
			<li class="rounded-xl bg-zinc-50 p-4">
				<p class="font-semibold text-zinc-950">1. Confirm the exact test</p>
				<p class="mt-1 text-zinc-700">
					Ask your school or testing center for the current test name and required sections.
				</p>
			</li>
			<li class="rounded-xl bg-zinc-50 p-4">
				<p class="font-semibold text-zinc-950">2. Learn the placement rule</p>
				<p class="mt-1 text-zinc-700">
					Write down the target course and ask how the school uses test results for placement.
				</p>
			</li>
			<li class="rounded-xl bg-zinc-50 p-4">
				<p class="font-semibold text-zinc-950">3. Check test-day details</p>
				<p class="mt-1 text-zinc-700">
					Confirm the date, location or device, identification, headphones, time limits, and
					approved accommodations.
				</p>
			</li>
			<li class="rounded-xl bg-zinc-50 p-4">
				<p class="font-semibold text-zinc-950">4. Practice the task formats</p>
				<p class="mt-1 text-zinc-700">
					Use official samples to understand directions and interactions, then practice with
					original questions instead of memorizing answers.
				</p>
			</li>
			<li class="rounded-xl bg-zinc-50 p-4 sm:col-span-2">
				<p class="font-semibold text-zinc-950">5. Ask about retesting</p>
				<p class="mt-1 text-zinc-700">
					Know whether you can retest, how long you must wait, and which result the school will use.
				</p>
			</li>
		</ol>
	</section>

	<section class="space-y-4" aria-labelledby="official-resources-heading">
		<div>
			<h2 id="official-resources-heading" class="text-2xl font-semibold text-zinc-950">
				Official test resources
			</h2>
			<p class="mt-2 max-w-3xl text-zinc-600">
				Use these provider resources for current question types and sample materials. Your school
				remains the source for its placement rules.
			</p>
		</div>
		<div class="grid gap-4 lg:grid-cols-2">
			<article class="rounded-2xl border border-zinc-200 bg-white p-5">
				<h3 class="font-semibold text-zinc-950">College Board</h3>
				<ul class="mt-3 space-y-3">
					<li>
						<a
							class="font-medium text-teal-800 underline decoration-teal-300 underline-offset-4 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
							href="https://accuplacer.collegeboard.org/accuplacer/pdf/accuplacer-esl-tests-sample-questions.pdf"
							>ACCUPLACER ESL sample questions and section descriptions</a
						>
					</li>
					<li>
						<a
							class="font-medium text-teal-800 underline decoration-teal-300 underline-offset-4 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
							href="https://accuplacer.collegeboard.org/accuplacer/pdf/guide-to-next-generation-standard-setting.pdf"
							>ACCUPLACER standard-setting guide</a
						>
					</li>
					<li>
						<a
							class="font-medium text-teal-800 underline decoration-teal-300 underline-offset-4 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
							href="https://accuplacer.collegeboard.org/accuplacer/pdf/accuplacer-writeplacer-esl-sample-essays.pdf"
							>WritePlacer ESL guide and scoring samples</a
						>
					</li>
				</ul>
			</article>

			<article class="rounded-2xl border border-zinc-200 bg-white p-5">
				<h3 class="font-semibold text-zinc-950">Cambridge English</h3>
				<ul class="mt-3 space-y-3">
					<li>
						<a
							class="font-medium text-teal-800 underline decoration-teal-300 underline-offset-4 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
							href="https://support.cambridgeenglish.org/hc/en-gb/articles/360000241043-Cambridge-English-Placement-Test-CEPT-Types-of-CEPT-Questions"
							>Cambridge CEPT question types</a
						>
					</li>
					<li>
						<a
							class="font-medium text-teal-800 underline decoration-teal-300 underline-offset-4 focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
							href="https://support.cambridgeenglish.org/hc/en-gb/articles/210044206-Cambridge-English-Placement-Test-CEPT-FAQs"
							>Cambridge CEPT frequently asked questions</a
						>
					</li>
				</ul>
			</article>
		</div>
	</section>
</main>
