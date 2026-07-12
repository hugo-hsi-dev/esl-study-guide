import { describe, expect, it } from 'vitest';
import { getLearnerGuide } from '$lib/learner-guides';
import type { SkillProfile, StudyPlan } from './assessment-diagnosis';
import {
	buildPracticeReview,
	generatePracticeProblem,
	getPracticeReviewSchedule,
	getReassessmentProgress,
	gradePracticeAnswer,
	inferPlacementTestProfile,
	practiceDifficulties,
	practiceKindForTarget,
	selectNextPracticeTarget,
	submitPracticeResponse,
	toPublicPracticeProblem,
	validatePracticeMetadata,
	validatePracticeProblem,
	validatePracticeResponse,
	type AdaptiveHistoryEntry,
	type PracticeSelection
} from './adaptive-practice';
import type { AssessmentArea, ErrorSignal } from './assessment-items';
import type { Db } from './db';
import { practiceAttempt } from './db/schema';
import type { WorkersAiRuntime } from './workers-ai';

const areas = [
	'listening',
	'reading',
	'grammar_usage',
	'vocabulary',
	'writing',
	'speaking'
] as const satisfies readonly AssessmentArea[];

describe('practice modality routing', () => {
	it('keeps each task in the modality of the assessed target area', () => {
		expect(practiceKindForTarget('reading')).toBe('objective');
		expect(practiceKindForTarget('vocabulary')).toBe('objective');
		expect(practiceKindForTarget('listening')).toBe('listening_choice');
		expect(practiceKindForTarget('writing')).toBe('short_text');
		expect(practiceKindForTarget('speaking')).toBe('speaking');
	});
});

describe('within-session plan coverage', () => {
	it('covers an untouched target before returning to a twice-missed target', () => {
		const history: AdaptiveHistoryEntry[] = [
			{
				practiceId: 'main-idea-1',
				sessionId: 'session-1',
				targetArea: 'reading',
				targetSignal: 'main_idea',
				difficulty: 'foundation',
				adaptiveReason: 'plan_balance',
				contentId: 'main-idea-foundation-1',
				scored: true,
				correct: false
			},
			{
				practiceId: 'main-idea-2',
				sessionId: 'session-1',
				targetArea: 'reading',
				targetSignal: 'main_idea',
				difficulty: 'foundation',
				adaptiveReason: 'miss_repeat',
				contentId: 'main-idea-foundation-2',
				scored: true,
				correct: false
			},
			{
				practiceId: 'verb-form-1',
				sessionId: 'session-1',
				targetArea: 'grammar_usage',
				targetSignal: 'verb_form',
				difficulty: 'foundation',
				adaptiveReason: 'plan_balance',
				contentId: 'verb-form-foundation-1',
				scored: true,
				correct: false
			},
			{
				practiceId: 'verb-form-2',
				sessionId: 'session-1',
				targetArea: 'grammar_usage',
				targetSignal: 'verb_form',
				difficulty: 'foundation',
				adaptiveReason: 'miss_repeat',
				contentId: 'verb-form-foundation-2',
				scored: true,
				correct: false
			}
		];

		expect(selectNextPracticeTarget({ skillProfile: profile, studyPlan, history })).toMatchObject({
			targetArea: 'vocabulary',
			targetSignal: 'collocation'
		});
	});
});

const signals = [
	'main_idea',
	'detail',
	'inference',
	'vocabulary_in_context',
	'verb_form',
	'subject_verb_agreement',
	'article_determiner',
	'plural_countability',
	'preposition',
	'pronoun_choice',
	'sentence_control',
	'collocation',
	'task_completion',
	'clarity',
	'fluency'
] as const satisfies readonly ErrorSignal[];

const profile: SkillProfile = {
	skillBands: {
		listening: 'functional',
		reading: 'functional',
		grammar_usage: 'emerging',
		vocabulary: 'developing',
		writing: 'developing',
		speaking: 'developing'
	},
	evidenceCounts: {
		listening: 3,
		reading: 3,
		grammar_usage: 3,
		vocabulary: 3,
		writing: 1,
		speaking: 1
	},
	areaFeedback: Object.fromEntries(areas.map((area) => [area, 'Keep practicing.'])) as Record<
		AssessmentArea,
		string
	>,
	diagnosisQuality: 'full',
	priorityWeaknesses: [
		{ area: 'grammar_usage', signal: 'verb_form', reason: 'Observed verb-form errors.' },
		{ area: 'vocabulary', signal: 'collocation', reason: 'Observed collocation errors.' },
		{ area: 'reading', signal: 'main_idea', reason: 'Observed main-idea errors.' }
	],
	missedAnswerExamples: [],
	rubricOutputs: {
		writing: { score: null, signals: [], feedback: 'Writing evidence was not scored.' },
		speaking: { score: null, signals: [], feedback: 'Speaking evidence was not scored.' },
		pronunciation: {
			score: null,
			signals: [],
			feedback: 'Pronunciation was not scored.'
		}
	}
};

const studyPlan: StudyPlan = {
	targets: [
		{ area: 'grammar_usage', signal: 'verb_form', priority: 1 },
		{ area: 'vocabulary', signal: 'collocation', priority: 2 },
		{ area: 'reading', signal: 'main_idea', priority: 3 }
	],
	targetSignals: ['verb_form', 'collocation', 'main_idea'],
	reassessAfterPracticeCount: 20
};

const historyEntry = (overrides: Partial<AdaptiveHistoryEntry> = {}): AdaptiveHistoryEntry => ({
	practiceId: crypto.randomUUID(),
	sessionId: 'session-1',
	targetArea: 'grammar_usage',
	targetSignal: 'verb_form',
	difficulty: 'practice',
	adaptiveReason: 'plan_balance',
	contentId: 'verb-form-practice-1',
	scored: true,
	correct: true,
	...overrides
});

describe('adaptive target selection', () => {
	it('schedules correct targets at expanding 1, 3, 7, and 14 day intervals', () => {
		const now = new Date('2026-07-11T12:00:00.000Z');
		const history = [
			historyEntry({ answeredAt: '2026-07-08T12:00:00.000Z' }),
			historyEntry({
				answeredAt: '2026-07-10T12:00:00.000Z',
				contentId: 'verb-form-practice-2'
			})
		];

		expect(
			getPracticeReviewSchedule(history.slice(0, 1), 'grammar_usage', 'verb_form', now)
		).toMatchObject({ correctStreak: 1, due: true, dueAt: '2026-07-09T12:00:00.000Z' });
		expect(getPracticeReviewSchedule(history, 'grammar_usage', 'verb_form', now)).toMatchObject({
			correctStreak: 2,
			due: false,
			dueAt: '2026-07-13T12:00:00.000Z'
		});
		const expanded = [
			...history,
			historyEntry({
				answeredAt: '2026-07-10T13:00:00.000Z',
				contentId: 'verb-form-practice-3'
			}),
			historyEntry({
				answeredAt: '2026-07-10T14:00:00.000Z',
				contentId: 'verb-form-practice-4'
			})
		];
		expect(
			getPracticeReviewSchedule(expanded.slice(0, 3), 'grammar_usage', 'verb_form', now)
		).toMatchObject({ correctStreak: 3, dueAt: '2026-07-17T13:00:00.000Z' });
		expect(getPracticeReviewSchedule(expanded, 'grammar_usage', 'verb_form', now)).toMatchObject({
			correctStreak: 4,
			dueAt: '2026-07-24T14:00:00.000Z'
		});
	});

	it('puts a due review ahead of an unseen target', () => {
		const now = new Date('2026-07-11T12:00:00.000Z');
		const history = [
			historyEntry({ answeredAt: '2026-07-09T12:00:00.000Z' }),
			historyEntry({
				targetArea: 'vocabulary',
				targetSignal: 'collocation',
				answeredAt: '2026-07-11T11:00:00.000Z'
			})
		];

		expect(
			selectNextPracticeTarget({ skillProfile: profile, studyPlan, history, now })
		).toMatchObject({
			targetArea: 'grammar_usage',
			targetSignal: 'verb_form'
		});
	});

	it('repeats one miss with different content and steps down', () => {
		const missed = historyEntry({ correct: false, difficulty: 'challenge' });

		expect(
			selectNextPracticeTarget({ skillProfile: profile, studyPlan, history: [missed] })
		).toEqual({
			targetArea: 'grammar_usage',
			targetSignal: 'verb_form',
			difficulty: 'practice',
			adaptiveReason: 'miss_repeat',
			repeatOfPracticeId: missed.practiceId,
			excludeContentId: missed.contentId
		});
	});

	it('advances after two consecutive correct answers at one level', () => {
		const history = [historyEntry(), historyEntry({ contentId: 'verb-form-practice-2' })];

		expect(selectNextPracticeTarget({ skillProfile: profile, studyPlan, history })).toMatchObject({
			targetSignal: 'verb_form',
			difficulty: 'challenge',
			adaptiveReason: 'level_advance'
		});
	});

	it('balances the top three targets by attempts before accuracy and priority', () => {
		const history = [
			historyEntry(),
			historyEntry({ targetArea: 'vocabulary', targetSignal: 'collocation', correct: false })
		];
		// Mark the miss as already repeated so the balance rule, rather than repeat rule, applies.
		history[1].adaptiveReason = 'miss_repeat';

		expect(selectNextPracticeTarget({ skillProfile: profile, studyPlan, history })).toMatchObject({
			targetArea: 'reading',
			targetSignal: 'main_idea',
			adaptiveReason: 'plan_balance'
		});
	});

	it('keeps the same signal in reading and listening as separate targets', () => {
		const crossAreaPlan: StudyPlan = {
			targets: [
				{ area: 'reading', signal: 'detail', priority: 1 },
				{ area: 'listening', signal: 'detail', priority: 2 }
			],
			targetSignals: ['detail'],
			reassessAfterPracticeCount: 20
		};
		const history = [
			historyEntry({ targetArea: 'reading', targetSignal: 'detail', correct: true })
		];

		expect(
			selectNextPracticeTarget({ skillProfile: profile, studyPlan: crossAreaPlan, history })
		).toMatchObject({
			targetArea: 'listening',
			targetSignal: 'detail'
		});
	});

	it('advances a target after two correct attempts even when another skill occurred between them', () => {
		const history = [
			historyEntry(),
			historyEntry({ targetArea: 'vocabulary', targetSignal: 'collocation' }),
			historyEntry({ contentId: 'verb-form-practice-2' })
		];

		expect(selectNextPracticeTarget({ skillProfile: profile, studyPlan, history })).toMatchObject({
			targetArea: 'grammar_usage',
			targetSignal: 'verb_form',
			difficulty: 'challenge',
			adaptiveReason: 'level_advance'
		});
	});

	it('does not advance difficulty after memorizing the same item twice', () => {
		const history = [historyEntry(), historyEntry()];

		expect(
			selectNextPracticeTarget({ skillProfile: profile, studyPlan, history })
		).not.toMatchObject({
			adaptiveReason: 'level_advance'
		});
	});

	it('uses unscored productive attempts for session rotation and content exclusion only', () => {
		const productivePlan: StudyPlan = {
			targets: [
				{ area: 'writing', signal: 'sentence_control', priority: 1 },
				{ area: 'speaking', signal: 'clarity', priority: 2 }
			],
			targetSignals: ['sentence_control', 'clarity'],
			reassessAfterPracticeCount: 20
		};
		const writingAttempt = historyEntry({
			targetArea: 'writing',
			targetSignal: 'sentence_control',
			difficulty: 'foundation',
			contentId: 'short_text-sentence_control-foundation-1',
			scored: false,
			correct: null
		});
		const speakingAttempt = historyEntry({
			targetArea: 'speaking',
			targetSignal: 'clarity',
			difficulty: 'foundation',
			contentId: 'speaking-clarity-foundation-1',
			scored: false,
			correct: null
		});

		expect(
			selectNextPracticeTarget({
				skillProfile: profile,
				studyPlan: productivePlan,
				history: [writingAttempt]
			})
		).toMatchObject({ targetArea: 'speaking', targetSignal: 'clarity' });

		expect(
			selectNextPracticeTarget({
				skillProfile: profile,
				studyPlan: productivePlan,
				history: [writingAttempt, speakingAttempt]
			})
		).toMatchObject({
			targetArea: 'writing',
			targetSignal: 'sentence_control',
			difficulty: 'foundation',
			excludeContentId: writingAttempt.contentId,
			adaptiveReason: 'plan_balance'
		});
	});
});

describe('practice problem boundaries', () => {
	const speakingProblem = {
		id: 'speaking-claim-test',
		targetArea: 'speaking' as const,
		targetSignal: 'fluency' as const,
		prompt: 'Describe your day in one or two sentences.',
		difficulty: 'practice' as const,
		adaptiveReason: 'plan_balance' as const,
		kind: 'speaking' as const,
		rubric: { targetDescription: 'Use a complete sentence.', minimumSeconds: 1 }
	};
	const speakingMetadata = {
		schemaVersion: 2 as const,
		provider: 'local' as const,
		modelId: 'test-model',
		promptVersion: 'test-v1',
		generatedAt: '2026-07-10T00:00:00.000Z'
	};
	const practiceDb = (practiceId: string, updates: Record<string, unknown>[], claim = true) => {
		const practiceRow = {
			id: practiceId,
			learnerUserId: 'learner-1',
			assessmentAttemptId: 'assessment-1',
			status: 'presented' as 'presented' | 'answered',
			sessionId: 'session-1',
			sequence: 5,
			practiceProblemJson: speakingProblem,
			answer: null,
			feedbackJson: null,
			metadataJson: speakingMetadata,
			createdAt: new Date(),
			answeredAt: null
		};
		const assessmentRow = {
			id: 'assessment-1',
			status: 'completed' as const,
			skillProfileJson: {},
			studyPlanJson: {}
		};
		return {
			select: () => ({
				from: (table: unknown) => ({
					where: () => ({
						limit: async () => (table === practiceAttempt ? [practiceRow] : [assessmentRow]),
						orderBy: () => ({ limit: async () => [assessmentRow] })
					})
				})
			}),
			update: () => ({
				set: (values: unknown) => {
					const update = values as Record<string, unknown>;
					updates.push(update);
					if (!('status' in update)) Object.assign(practiceRow, update);
					return {
						where: () => ({
							returning: async () => {
								if (update.status !== 'answered') return [{ id: practiceId }];
								if (!claim || practiceRow.status !== 'presented') return [];
								Object.assign(practiceRow, update);
								return [{ id: practiceId }];
							}
						})
					};
				}
			})
		} as unknown as Db;
	};

	it('does not resolve speaking audio for a foreign practice ID', async () => {
		expect.assertions(2);
		const db = {
			select: () => ({
				from: () => ({
					where: () => ({ limit: async () => [] })
				})
			})
		} as unknown as Db;
		let resolveCalls = 0;

		await expect(
			submitPracticeResponse(
				db,
				'learner-1',
				{
					practiceId: crypto.randomUUID(),
					response: { kind: 'speaking', responseSeconds: 20 }
				},
				{
					resolveSpeakingResponse: async (response) => {
						resolveCalls += 1;
						return response;
					}
				}
			)
		).rejects.toThrow('Practice problem was not found.');
		expect(resolveCalls).toBe(0);
	});

	it('does not transcribe when another request has already claimed the practice attempt', async () => {
		expect.assertions(2);
		const practiceId = crypto.randomUUID();
		const updates: Record<string, unknown>[] = [];
		let resolveCalls = 0;

		await expect(
			submitPracticeResponse(
				practiceDb(practiceId, updates, false),
				'learner-1',
				{ practiceId, response: { kind: 'speaking', responseSeconds: 20 } },
				{
					resolveSpeakingResponse: async (response) => {
						resolveCalls += 1;
						return response;
					}
				}
			)
		).rejects.toThrow('Practice problem has already been answered.');
		expect(resolveCalls).toBe(0);
	});

	it('allows only the claimed request to transcribe speaking audio', async () => {
		expect.assertions(4);
		const practiceId = crypto.randomUUID();
		const updates: Record<string, unknown>[] = [];
		const db = practiceDb(practiceId, updates);
		let resolveCalls = 0;
		let notifyStarted: (() => void) | undefined;
		const started = new Promise<void>((resolve) => {
			notifyStarted = resolve;
		});
		let finishTranscription:
			| ((response: { kind: 'speaking'; responseSeconds: number; transcript: string }) => void)
			| undefined;
		const transcription = new Promise<{
			kind: 'speaking';
			responseSeconds: number;
			transcript: string;
		}>((resolve) => {
			finishTranscription = resolve;
		});
		const first = submitPracticeResponse(
			db,
			'learner-1',
			{ practiceId, response: { kind: 'speaking', responseSeconds: 20 } },
			{
				resolveSpeakingResponse: async () => {
					resolveCalls += 1;
					notifyStarted?.();
					return transcription;
				}
			}
		);

		await started;
		await expect(
			submitPracticeResponse(
				db,
				'learner-1',
				{ practiceId, response: { kind: 'speaking', responseSeconds: 20 } },
				{ resolveSpeakingResponse: async (response) => response }
			)
		).rejects.toThrow('Practice problem has already been answered.');
		finishTranscription?.({
			kind: 'speaking',
			responseSeconds: 20,
			transcript: 'I practiced English today.'
		});
		await expect(first).resolves.toMatchObject({
			feedback: { kind: 'productive', scored: false }
		});
		expect(resolveCalls).toBe(1);
		expect(updates[0]).toMatchObject({
			status: 'answered',
			metadataJson: { fallbackReason: 'processing_interrupted' }
		});
	});

	it('keeps an unscored terminal response when transcription fails', async () => {
		expect.assertions(5);
		const practiceId = crypto.randomUUID();
		const updates: Record<string, unknown>[] = [];

		await expect(
			submitPracticeResponse(
				practiceDb(practiceId, updates),
				'learner-1',
				{ practiceId, response: { kind: 'speaking', responseSeconds: 20 } },
				{ resolveSpeakingResponse: async () => Promise.reject(new Error('ASR unavailable')) }
			)
		).resolves.toMatchObject({
			feedback: { kind: 'productive', scored: false, meetsTarget: null }
		});
		expect(updates).toHaveLength(2);
		expect(updates[0]).toMatchObject({
			status: 'answered',
			feedbackJson: { kind: 'productive', scored: false },
			metadataJson: { fallbackReason: 'processing_interrupted' }
		});
		expect(updates[1]).toMatchObject({
			feedbackJson: { kind: 'productive', scored: false, meetsTarget: null },
			metadataJson: { fallbackReason: 'transcription_failed' }
		});
		expect(updates[1]?.answer).toBeUndefined();
	});

	it('saves a typed speaking script without treating it as speaking evidence', async () => {
		const practiceId = crypto.randomUUID();
		const updates: Record<string, unknown>[] = [];
		let aiCalls = 0;
		const runtime: WorkersAiRuntime = {
			provider: 'workers-ai',
			ai: {
				run: async () => {
					aiCalls += 1;
					return { response: '{}' };
				}
			},
			textModelId: '@cf/test/model',
			transcriptionModelId: '@cf/test/asr'
		};

		await expect(
			submitPracticeResponse(
				practiceDb(practiceId, updates),
				'learner-1',
				{
					practiceId,
					response: {
						kind: 'speaking',
						responseSeconds: 20,
						transcript: 'I practiced English today.',
						transcriptSource: 'submitted'
					}
				},
				{ runtime }
			)
		).resolves.toMatchObject({
			feedback: {
				kind: 'productive',
				scored: false,
				correction: expect.stringContaining('typed practice scripts')
			}
		});
		expect(aiCalls).toBe(0);
		expect(updates.at(-1)).toMatchObject({
			metadataJson: { fallbackReason: 'speaking_transcript_not_audio_derived' }
		});
	});

	it('allows an audio-derived speaking transcript to receive bounded rubric feedback', async () => {
		const practiceId = crypto.randomUUID();
		const updates: Record<string, unknown>[] = [];
		const runtime: WorkersAiRuntime = {
			provider: 'workers-ai',
			ai: {
				run: async () => ({
					response: JSON.stringify({
						meetsTarget: true,
						strength: 'The response gives a complete, understandable idea.',
						correction: 'Keep the verb tense consistent.',
						nextTip: 'Add one supporting detail next time.'
					})
				})
			},
			textModelId: '@cf/test/model',
			transcriptionModelId: '@cf/test/asr'
		};

		await expect(
			submitPracticeResponse(
				practiceDb(practiceId, updates),
				'learner-1',
				{ practiceId, response: { kind: 'speaking', responseSeconds: 20 } },
				{
					runtime,
					resolveSpeakingResponse: async (response) => ({
						...response,
						transcript: 'I practiced English today because I have a placement test.',
						transcriptSource: 'workers_ai_asr'
					})
				}
			)
		).resolves.toMatchObject({
			feedback: { kind: 'productive', scored: true, meetsTarget: true }
		});
	});

	it('keeps every fallback signal and difficulty valid', async () => {
		expect.assertions(signals.length * practiceDifficulties.length);

		for (const targetSignal of signals) {
			for (const difficulty of practiceDifficulties) {
				const selection: PracticeSelection = {
					targetArea: 'grammar_usage',
					targetSignal,
					difficulty,
					adaptiveReason: 'plan_balance'
				};
				const generated = await generatePracticeProblem({
					skillProfile: profile,
					studyPlan,
					selection,
					runtime: null
				});
				expect(validatePracticeProblem(generated.problem).targetSignal).toBe(targetSignal);
			}
		}
	});

	it('offers two distinct deterministic objective tasks for every signal at every level', async () => {
		const placementProfile = inferPlacementTestProfile('', {
			kind: 'accuplacer_esl',
			institution: '',
			targetOutcome: ''
		});

		for (const targetSignal of signals) {
			for (const difficulty of practiceDifficulties) {
				const baseSelection: PracticeSelection = {
					targetArea: 'grammar_usage',
					targetSignal,
					difficulty,
					adaptiveReason: 'plan_balance'
				};
				const first = await generatePracticeProblem({
					skillProfile: profile,
					studyPlan,
					placementProfile,
					selection: baseSelection,
					runtime: null
				});
				const second = await generatePracticeProblem({
					skillProfile: profile,
					studyPlan,
					placementProfile,
					selection: { ...baseSelection, excludeContentId: first.problem.id },
					runtime: null
				});
				const backToFirst = await generatePracticeProblem({
					skillProfile: profile,
					studyPlan,
					placementProfile,
					selection: { ...baseSelection, excludeContentId: second.problem.id },
					runtime: null
				});

				expect(first.problem.id, `${targetSignal}/${difficulty} first id`).not.toBe(
					second.problem.id
				);
				expect(
					`${first.problem.prompt}|${first.problem.kind === 'choice' ? first.problem.choices.map((choice) => choice.text).join('|') : ''}`,
					`${targetSignal}/${difficulty} content`
				).not.toBe(
					`${second.problem.prompt}|${second.problem.kind === 'choice' ? second.problem.choices.map((choice) => choice.text).join('|') : ''}`
				);
				expect(backToFirst.problem.id, `${targetSignal}/${difficulty} reverse exclusion`).toBe(
					first.problem.id
				);
				for (const problem of [first.problem, second.problem]) {
					expect(problem.kind, `${targetSignal}/${difficulty} kind`).toBe('choice');
					if (problem.kind !== 'choice') throw new Error('Expected ACCUPLACER choice problem.');
					expect(problem.choices, `${targetSignal}/${difficulty} choices`).toHaveLength(4);
					expect(new Set(problem.choices.map((choice) => choice.text)).size).toBe(4);
					if (difficulty === 'challenge') {
						const evidenceText = `${problem.prompt} ${problem.choices
							.map((choice) => choice.text)
							.join(' ')}`;
						expect(
							evidenceText.trim().split(/\s+/u).length,
							`${targetSignal}/${problem.id} challenge evidence`
						).toBeGreaterThan(30);
					}
				}
			}
		}
	});

	it('offers two distinct deterministic listening tasks for main idea and detail at every level', async () => {
		const placementProfile = inferPlacementTestProfile('', {
			kind: 'accuplacer_esl',
			institution: '',
			targetOutcome: ''
		});

		for (const targetSignal of ['main_idea', 'detail'] as const) {
			for (const difficulty of practiceDifficulties) {
				const baseSelection: PracticeSelection = {
					targetArea: 'listening',
					targetSignal,
					difficulty,
					adaptiveReason: 'plan_balance'
				};
				const first = await generatePracticeProblem({
					skillProfile: profile,
					studyPlan,
					placementProfile,
					selection: baseSelection,
					runtime: null
				});
				const second = await generatePracticeProblem({
					skillProfile: profile,
					studyPlan,
					placementProfile,
					selection: { ...baseSelection, excludeContentId: first.problem.id },
					runtime: null
				});
				const backToFirst = await generatePracticeProblem({
					skillProfile: profile,
					studyPlan,
					placementProfile,
					selection: { ...baseSelection, excludeContentId: second.problem.id },
					runtime: null
				});

				expect(first.problem.kind).toBe('listening_choice');
				expect(second.problem.kind).toBe('listening_choice');
				if (
					first.problem.kind !== 'listening_choice' ||
					second.problem.kind !== 'listening_choice'
				) {
					throw new Error('Expected two listening problems.');
				}
				expect(first.problem.id, `${targetSignal}/${difficulty} first id`).not.toBe(
					second.problem.id
				);
				expect(first.problem.audioScript, `${targetSignal}/${difficulty} audio`).not.toBe(
					second.problem.audioScript
				);
				expect(first.problem.prompt, `${targetSignal}/${difficulty} prompt`).not.toBe(
					second.problem.prompt
				);
				expect(backToFirst.problem.id, `${targetSignal}/${difficulty} reverse exclusion`).toBe(
					first.problem.id
				);
				expect(first.problem.choices).toHaveLength(4);
				expect(second.problem.choices).toHaveLength(4);
			}
		}
	});

	it('offers two distinct deterministic writing and speaking prompts for every signal at every level', async () => {
		for (const [targetArea, kind] of [
			['writing', 'short_text'],
			['speaking', 'speaking']
		] as const) {
			for (const targetSignal of signals) {
				for (const difficulty of practiceDifficulties) {
					const baseSelection: PracticeSelection = {
						targetArea,
						targetSignal,
						difficulty,
						adaptiveReason: 'plan_balance'
					};
					const first = await generatePracticeProblem({
						skillProfile: profile,
						studyPlan,
						selection: baseSelection,
						runtime: null
					});
					const second = await generatePracticeProblem({
						skillProfile: profile,
						studyPlan,
						selection: { ...baseSelection, excludeContentId: first.problem.id },
						runtime: null
					});
					const backToFirst = await generatePracticeProblem({
						skillProfile: profile,
						studyPlan,
						selection: { ...baseSelection, excludeContentId: second.problem.id },
						runtime: null
					});

					expect(first.problem.kind, `${kind}/${targetSignal}/${difficulty}`).toBe(kind);
					expect(second.problem.kind, `${kind}/${targetSignal}/${difficulty}`).toBe(kind);
					expect(first.problem.id).not.toBe(second.problem.id);
					expect(first.problem.prompt).not.toBe(second.problem.prompt);
					expect(backToFirst.problem.id).toBe(first.problem.id);
				}
			}
		}
	});

	it('enforces productive response formats for writing and speaking targets', async () => {
		const writing = await generatePracticeProblem({
			skillProfile: profile,
			studyPlan,
			selection: {
				targetArea: 'writing',
				targetSignal: 'sentence_control',
				difficulty: 'practice',
				adaptiveReason: 'plan_balance'
			},
			kind: 'objective',
			runtime: null
		});
		const speaking = await generatePracticeProblem({
			skillProfile: profile,
			studyPlan,
			selection: {
				targetArea: 'speaking',
				targetSignal: 'clarity',
				difficulty: 'practice',
				adaptiveReason: 'plan_balance'
			},
			kind: 'objective',
			runtime: null
		});

		expect(writing.problem.kind).toBe('short_text');
		expect(speaking.problem.kind).toBe('speaking');
	});

	it('uses multiple-choice rather than open fill for ACCUPLACER ESL', async () => {
		const generated = await generatePracticeProblem({
			skillProfile: profile,
			studyPlan,
			placementProfile: inferPlacementTestProfile('Prepare for ACCUPLACER ESL.'),
			selection: {
				targetArea: 'grammar_usage',
				targetSignal: 'preposition',
				difficulty: 'foundation',
				adaptiveReason: 'plan_balance'
			},
			runtime: null
		});

		expect(generated.problem.kind).toBe('choice');
		expect(generated.problem.kind === 'choice' && generated.problem.choices).toHaveLength(4);
	});

	it('keeps every ACCUPLACER fallback signal and difficulty to four credible choices', async () => {
		const accuplacerProfile = inferPlacementTestProfile('', {
			kind: 'accuplacer_esl',
			institution: '',
			targetOutcome: ''
		});
		const correctPositions = new Set<number>();

		for (const targetSignal of signals) {
			for (const difficulty of practiceDifficulties) {
				const exclusions =
					difficulty === 'foundation' ? [undefined, `${targetSignal}-foundation-1`] : [undefined];
				for (const excludeContentId of exclusions) {
					const { problem } = await generatePracticeProblem({
						skillProfile: profile,
						studyPlan,
						placementProfile: accuplacerProfile,
						selection: {
							targetArea: 'grammar_usage',
							targetSignal,
							difficulty,
							adaptiveReason: 'plan_balance',
							excludeContentId
						},
						runtime: null
					});

					expect(problem.kind, `${targetSignal}/${difficulty}`).toBe('choice');
					if (problem.kind !== 'choice') throw new Error('Expected ACCUPLACER choice problem.');
					expect(problem.choices, `${targetSignal}/${difficulty}`).toHaveLength(4);
					expect(new Set(problem.choices.map((choice) => choice.text)).size).toBe(4);
					expect(problem.choices.some((choice) => choice.id === problem.answerKey)).toBe(true);
					expect(problem.choices.map((choice) => choice.text).join(' ')).not.toMatch(
						/\b(?:all|none) of (?:the|these)\b/i
					);
					correctPositions.add(
						problem.choices.findIndex((choice) => choice.id === problem.answerKey)
					);
				}
			}
		}

		expect(correctPositions).toEqual(new Set([0, 1, 2, 3]));
	});

	it('claims a CEPT task family only when explicit authored content has its semantic structure', async () => {
		const ceptProfile = inferPlacementTestProfile('', {
			kind: 'cambridge_cept',
			institution: '',
			targetOutcome: ''
		});

		for (const targetSignal of signals) {
			for (const difficulty of practiceDifficulties) {
				for (const excludeContentId of [undefined, `${targetSignal}-${difficulty}-1`]) {
					const { problem } = await generatePracticeProblem({
						skillProfile: profile,
						studyPlan,
						placementProfile: ceptProfile,
						selection: {
							targetArea: 'grammar_usage',
							targetSignal,
							difficulty,
							adaptiveReason: 'plan_balance',
							excludeContentId
						},
						runtime: null
					});

					if (problem.kind === 'fill') {
						expect(['open_gap_fill', 'targeted_skill_drill']).toContain(problem.placementTaskType);
						if (problem.placementTaskType === 'open_gap_fill') {
							expect(problem.prompt).toMatch(/_{2,}|\[(?:blank|gap)\]/iu);
							expect(problem.prompt).not.toMatch(/\([^)]{1,40}\)/u);
						}
						continue;
					}
					expect(problem.kind, `${targetSignal}/${difficulty}`).toBe('choice');
					if (problem.kind !== 'choice') throw new Error('Expected a CEPT objective problem.');
					const expectedChoiceCount = problem.placementTaskType === 'read_and_select' ? 3 : 4;
					expect(problem.choices, `${targetSignal}/${difficulty}`).toHaveLength(
						expectedChoiceCount
					);
					expect(new Set(problem.choices.map((choice) => choice.text)).size).toBe(
						expectedChoiceCount
					);
					if (problem.placementTaskType === 'read_and_select') {
						expect(problem.prompt).toMatch(/(?:notice|memo|label|letter)/iu);
						expect(problem.prompt).toMatch(/most closely matches the meaning/iu);
					}
					if (
						problem.placementTaskType === 'gapped_sentence' ||
						problem.placementTaskType === 'multiple_choice_gap_fill'
					) {
						expect(problem.prompt).toMatch(/_{2,}|\[(?:blank|gap)\]/iu);
					}
					if (problem.placementTaskType === 'multiple_choice_gap_fill') {
						expect(problem.prompt.match(/[.!?]/gu)?.length ?? 0).toBeGreaterThanOrEqual(2);
					}
					expect(problem.choices.some((choice) => choice.id === problem.answerKey)).toBe(true);
				}
			}
		}
	});

	it('keeps signal- or interaction-matched generic exercises labeled as targeted drills', async () => {
		const placementProfile = inferPlacementTestProfile('', {
			kind: 'cambridge_cept',
			institution: '',
			targetOutcome: ''
		});
		const generate = (
			targetArea: AssessmentArea,
			targetSignal: ErrorSignal,
			difficulty: (typeof practiceDifficulties)[number] = 'foundation',
			excludeContentId?: string
		) =>
			generatePracticeProblem({
				skillProfile: profile,
				studyPlan,
				placementProfile,
				selection: {
					targetArea,
					targetSignal,
					difficulty,
					adaptiveReason: 'plan_balance',
					excludeContentId
				},
				runtime: null
			});

		const exactRead = (await generate('reading', 'main_idea')).problem;
		expect(exactRead).toMatchObject({ kind: 'choice', placementTaskType: 'read_and_select' });
		if (exactRead.kind !== 'choice') throw new Error('Expected authored read-and-select.');
		expect(exactRead.choices).toHaveLength(3);

		const genericRead = (await generate('reading', 'main_idea', 'foundation', exactRead.id))
			.problem;
		expect(genericRead).toMatchObject({
			kind: 'choice',
			placementTaskType: 'targeted_skill_drill'
		});
		if (genericRead.kind !== 'choice') throw new Error('Expected a generic reading drill.');
		expect(genericRead.choices).toHaveLength(4);

		const exactGap = (await generate('grammar_usage', 'verb_form')).problem;
		expect(exactGap).toMatchObject({ kind: 'choice', placementTaskType: 'gapped_sentence' });
		const genericFill = (await generate('grammar_usage', 'verb_form', 'foundation', exactGap.id))
			.problem;
		expect(genericFill).toMatchObject({ kind: 'fill', placementTaskType: 'targeted_skill_drill' });

		const exactOpen = (await generate('grammar_usage', 'preposition')).problem;
		expect(exactOpen).toMatchObject({ kind: 'fill', placementTaskType: 'open_gap_fill' });

		const exactMultipleGap = (await generate('vocabulary', 'collocation', 'practice')).problem;
		expect(exactMultipleGap).toMatchObject({
			kind: 'choice',
			placementTaskType: 'multiple_choice_gap_fill'
		});
	});

	it('uses prompt-specific ACCUPLACER alternatives for every fill seed', async () => {
		const expectedCorrectAnswers = {
			verb_form: {
				foundation: ['works', 'cooked'],
				practice: ['sent'],
				challenge: ['completed']
			},
			subject_verb_agreement: {
				foundation: ['drinks', 'live'],
				practice: ['shows'],
				challenge: ['depends']
			},
			article_determiner: {
				foundation: ['an', 'the'],
				practice: ['the'],
				challenge: ['an']
			},
			plural_countability: {
				foundation: ['bags', 'tomatoes']
			},
			preposition: {
				foundation: ['on', 'on'],
				practice: ['at'],
				challenge: ['in']
			}
		} as const;
		const accuplacerProfile = inferPlacementTestProfile('', {
			kind: 'accuplacer_esl',
			institution: '',
			targetOutcome: ''
		});

		for (const [targetSignal, byDifficulty] of Object.entries(expectedCorrectAnswers)) {
			for (const [difficulty, expectedAnswers] of Object.entries(byDifficulty)) {
				for (const [index, expectedAnswer] of expectedAnswers.entries()) {
					const { problem } = await generatePracticeProblem({
						skillProfile: profile,
						studyPlan,
						placementProfile: accuplacerProfile,
						selection: {
							targetArea: 'grammar_usage',
							targetSignal: targetSignal as ErrorSignal,
							difficulty: difficulty as (typeof practiceDifficulties)[number],
							adaptiveReason: 'plan_balance',
							...(index === 1 ? { excludeContentId: `${targetSignal}-${difficulty}-1` } : {})
						},
						runtime: null
					});
					if (problem.kind !== 'choice') throw new Error('Expected ACCUPLACER choice problem.');
					expect(problem.choices.find((choice) => choice.id === problem.answerKey)?.text).toBe(
						expectedAnswer
					);
				}
			}
		}
	});

	it('keeps challenge fallback evidence above foundation-level sentence decoding', async () => {
		const challengeTargets = [
			['reading', 'main_idea'],
			['reading', 'detail'],
			['vocabulary', 'vocabulary_in_context'],
			['grammar_usage', 'verb_form'],
			['grammar_usage', 'subject_verb_agreement'],
			['grammar_usage', 'sentence_control'],
			['vocabulary', 'collocation']
		] as const satisfies readonly (readonly [AssessmentArea, ErrorSignal])[];

		for (const [targetArea, targetSignal] of challengeTargets) {
			const { problem } = await generatePracticeProblem({
				skillProfile: profile,
				studyPlan,
				selection: {
					targetArea,
					targetSignal,
					difficulty: 'challenge',
					adaptiveReason: 'plan_balance'
				},
				runtime: null
			});
			const evidenceText =
				problem.kind === 'choice'
					? `${problem.prompt} ${problem.choices.map((choice) => choice.text).join(' ')}`
					: problem.prompt;
			expect(evidenceText.trim().split(/\s+/u).length, targetSignal).toBeGreaterThan(30);
		}
	});

	it('requires developed connected responses at challenge difficulty', async () => {
		const [writing, speaking] = await Promise.all([
			generatePracticeProblem({
				skillProfile: profile,
				studyPlan,
				selection: {
					targetArea: 'writing',
					targetSignal: 'sentence_control',
					difficulty: 'challenge',
					adaptiveReason: 'plan_balance'
				},
				runtime: null
			}),
			generatePracticeProblem({
				skillProfile: profile,
				studyPlan,
				selection: {
					targetArea: 'speaking',
					targetSignal: 'fluency',
					difficulty: 'challenge',
					adaptiveReason: 'plan_balance'
				},
				runtime: null
			})
		]);

		expect(writing.problem).toMatchObject({
			kind: 'short_text',
			prompt: expect.stringContaining('Write 90–120 words.'),
			rubric: { minimumWords: 90 }
		});
		expect(speaking.problem).toMatchObject({
			kind: 'speaking',
			prompt: expect.stringContaining('Speak for 60–90 seconds.'),
			rubric: { minimumSeconds: 60 }
		});
	});

	it('exposes only learner-safe fields', async () => {
		const { problem } = await generatePracticeProblem({
			skillProfile: profile,
			studyPlan,
			selection: {
				targetArea: 'grammar_usage',
				targetSignal: 'verb_form',
				difficulty: 'foundation',
				adaptiveReason: 'plan_balance'
			},
			runtime: null
		});
		const publicProblem = toPublicPracticeProblem(
			crypto.randomUUID(),
			crypto.randomUUID(),
			1,
			problem
		);

		expect(publicProblem).not.toHaveProperty('answerKey');
		expect(publicProblem).not.toHaveProperty('acceptableAnswers');
		expect(publicProblem).not.toHaveProperty('explanation');
		expect(publicProblem).not.toHaveProperty('rubric');
		expect(publicProblem).not.toHaveProperty('id');
	});

	it('uses authenticated audio for listening and never exposes the server-only script', async () => {
		const { problem } = await generatePracticeProblem({
			skillProfile: profile,
			studyPlan,
			selection: {
				targetArea: 'listening',
				targetSignal: 'detail',
				difficulty: 'foundation',
				adaptiveReason: 'plan_balance'
			},
			runtime: null
		});
		const practiceId = crypto.randomUUID();
		const publicProblem = toPublicPracticeProblem(practiceId, crypto.randomUUID(), 1, problem);

		expect(problem.kind).toBe('listening_choice');
		expect(problem.kind === 'listening_choice' && problem.audioScript).toBeTruthy();
		expect(publicProblem).toMatchObject({
			kind: 'listening_choice',
			audioUrl: `/practice/audio/${practiceId}`
		});
		expect(publicProblem).not.toHaveProperty('audioScript');
		expect(publicProblem).not.toHaveProperty('answerKey');

		if (problem.kind !== 'listening_choice') throw new Error('Expected listening practice.');
		expect(gradePracticeAnswer(problem, problem.answerKey)).toMatchObject({ scored: false });
		expect(
			gradePracticeAnswer(problem, problem.answerKey, { listeningAudioDelivered: true })
		).toMatchObject({ scored: true, correct: true });
	});

	it.each([
		['accuplacer_esl', 4, 'connected_discourse'],
		['cambridge_cept', 3, 'listen_and_select']
	] as const)(
		'uses profile-aligned listening format for %s',
		async (profileId, choiceCount, placementTaskType) => {
			const placementProfile = inferPlacementTestProfile('', {
				kind: profileId,
				institution: '',
				targetOutcome: ''
			});
			const { problem } = await generatePracticeProblem({
				skillProfile: profile,
				studyPlan,
				placementProfile,
				selection: {
					targetArea: 'listening',
					targetSignal: 'main_idea',
					difficulty: 'challenge',
					adaptiveReason: 'plan_balance'
				},
				runtime: null
			});

			expect(problem.kind).toBe('listening_choice');
			if (problem.kind !== 'listening_choice') throw new Error('Expected listening practice.');
			expect(problem.choices).toHaveLength(choiceCount);
			expect(problem.placementProfileId).toBe(profileId);
			expect(problem.placementTaskType).toBe(placementTaskType);
			if (profileId === 'cambridge_cept') {
				expect(problem.placementTaskType).not.toBe('extended_listening');
			}
			expect(problem.audioScript.split(/\s+/u).length).toBeGreaterThan(30);
		}
	);

	it('never scores a text-only problem as listening evidence', () => {
		const legacyTextProblem = validatePracticeProblem({
			id: 'legacy-text-listening',
			targetArea: 'listening',
			targetSignal: 'detail',
			prompt: 'The appointment is at two. What time is it?',
			difficulty: 'foundation',
			adaptiveReason: 'plan_balance',
			kind: 'choice',
			choices: [
				{ id: 'a', text: 'Two' },
				{ id: 'b', text: 'Three' }
			],
			answerKey: 'a',
			explanation: 'The text says two.'
		});

		expect(
			gradePracticeAnswer(legacyTextProblem, 'a', { listeningAudioDelivered: true })
		).toMatchObject({ scored: false, correct: true });
	});

	it('uses a concrete, distinct productive fallback task for every target signal', async () => {
		const prompts = await Promise.all(
			signals.map(async (targetSignal) => {
				const generated = await generatePracticeProblem({
					skillProfile: profile,
					studyPlan,
					selection: {
						targetArea: 'writing',
						targetSignal,
						difficulty: 'foundation',
						adaptiveReason: 'plan_balance'
					},
					kind: 'short_text',
					runtime: null
				});
				return generated.problem.prompt;
			})
		);

		expect(new Set(prompts).size).toBe(signals.length);
		expect(prompts.every((prompt) => !prompt.includes('a daily-life situation'))).toBe(true);
	});

	it('provides a rule, worked example, Chinese clarification, and hint for every signal', () => {
		for (const signal of signals) {
			const guide = getLearnerGuide(signal);
			expect(guide.rule.length).toBeGreaterThan(20);
			expect(guide.workedExample).toContain('Example:');
			expect(guide.chineseClarification).toMatch(/[\u3400-\u9fff]/u);
			expect(guide.hint.length).toBeGreaterThan(20);
			expect(guide.practiceNext.length).toBeGreaterThan(20);
		}
	});

	it('preserves a school-specific placement profile for generation context', () => {
		expect(
			inferPlacementTestProfile('Prepare for my college placement test.', {
				kind: 'school_specific',
				institution: 'City Community College',
				targetOutcome: 'Place into ESL Level 3',
				testDate: '2026-09-01'
			})
		).toMatchObject({
			id: 'school_specific',
			institution: 'City Community College',
			targetOutcome: 'Place into ESL Level 3',
			testDate: '2026-09-01'
		});
	});

	it('honors explicit intake profile even when goal keywords name another test', () => {
		expect(
			inferPlacementTestProfile('Prepare for ACCUPLACER ESL.', {
				kind: 'cambridge_cept',
				institution: 'Language Center',
				targetOutcome: '',
				knownSections: 'grammar, speaking'
			})
		).toMatchObject({
			id: 'cambridge_cept',
			institution: 'Language Center',
			sections: ['reading']
		});
		expect(inferPlacementTestProfile('Prepare for Cambridge CEPT.')).toMatchObject({
			id: 'cambridge_cept',
			sections: ['reading', 'listening'],
			taskGuidance: expect.stringContaining('language-knowledge item families')
		});
	});

	it('uses only the confirmed canonical sections for a named profile', () => {
		expect(
			inferPlacementTestProfile('', {
				kind: 'accuplacer_esl',
				institution: 'Riverside Community College',
				targetOutcome: 'Highest ready college ESL course',
				knownSections: 'Sentence Meaning, Language Use, Reading Skills'
			}).sections
		).toEqual(['sentence meaning', 'language use', 'reading skills']);
	});

	it('passes learner and placement context through generation and separate review', async () => {
		const outputs = [
			{
				response: JSON.stringify({
					kind: 'choice',
					prompt: 'Choose the best sentence.',
					choices: [
						{ id: 'a', text: 'He work here.' },
						{ id: 'b', text: 'He works here.' },
						{ id: 'c', text: 'He working here.' },
						{ id: 'd', text: 'He worked here every day.' }
					],
					answerKey: 'b',
					explanation: 'Use works with he.'
				})
			},
			{
				response: JSON.stringify({
					targetAligned: true,
					answerAgrees: true,
					levelAppropriate: true,
					examAligned: true,
					learnerRelevant: true
				})
			}
		];
		const calls: Record<string, unknown>[] = [];
		const runtime: WorkersAiRuntime = {
			provider: 'workers-ai',
			ai: {
				run: async (_model, inputs) => {
					calls.push(inputs);
					return outputs.shift();
				}
			},
			textModelId: '@cf/test/model',
			transcriptionModelId: '@cf/test/asr'
		};
		const generated = await generatePracticeProblem({
			skillProfile: profile,
			studyPlan,
			learnerGoal: 'Prepare for ACCUPLACER and write clearer college answers.',
			placementProfile: inferPlacementTestProfile('Prepare for ACCUPLACER.'),
			selection: {
				targetArea: 'grammar_usage',
				targetSignal: 'verb_form',
				difficulty: 'practice',
				adaptiveReason: 'plan_balance'
			},
			runtime
		});

		expect(generated.metadata).toMatchObject({
			provider: 'workers-ai',
			modelId: '@cf/test/model',
			promptVersion: 'adaptive-practice-v2',
			schemaVersion: 2
		});
		expect(generated.metadata).not.toHaveProperty('fallbackReason');
		expect(JSON.stringify(calls[0])).toContain('Prepare for ACCUPLACER');
		expect(JSON.stringify(calls[0])).toContain('accuplacer_esl');
		expect(JSON.stringify(calls[1])).toContain('accuplacer_esl');
		expect(JSON.stringify(calls[0])).toContain('internal grammar usage band is emerging');
		expect(JSON.stringify(calls[0])).toContain('make this practice task');
		expect(JSON.stringify(calls)).not.toMatch(/adult[- ]beginner/i);
	});

	it('uses stable AI content ids and falls back when excluded content is regenerated', async () => {
		const candidate = {
			kind: 'choice',
			prompt: 'Choose the correct verb: She ____ every morning.',
			choices: [
				{ id: 'a', text: 'walk' },
				{ id: 'b', text: 'walks' },
				{ id: 'c', text: 'walking' },
				{ id: 'd', text: 'walked yesterday' }
			],
			answerKey: 'b',
			explanation: 'A singular third-person subject takes walks.'
		};
		const review = {
			targetAligned: true,
			answerAgrees: true,
			levelAppropriate: true,
			examAligned: true,
			learnerRelevant: true
		};
		const outputs = [candidate, review, candidate, review];
		const runtime: WorkersAiRuntime = {
			provider: 'workers-ai',
			ai: { run: async () => ({ response: JSON.stringify(outputs.shift()) }) },
			textModelId: '@cf/test/model',
			transcriptionModelId: '@cf/test/asr'
		};
		const selection: PracticeSelection = {
			targetArea: 'grammar_usage',
			targetSignal: 'verb_form',
			difficulty: 'practice',
			adaptiveReason: 'plan_balance'
		};
		const first = await generatePracticeProblem({
			skillProfile: profile,
			studyPlan,
			placementProfile: inferPlacementTestProfile('Prepare for ACCUPLACER ESL.'),
			selection,
			runtime
		});
		const second = await generatePracticeProblem({
			skillProfile: profile,
			studyPlan,
			placementProfile: inferPlacementTestProfile('Prepare for ACCUPLACER ESL.'),
			selection: { ...selection, excludeContentId: first.problem.id },
			runtime
		});

		expect(first.problem.id).toMatch(/^ai-verb_form-practice-/);
		expect(first.metadata.provider).toBe('workers-ai');
		expect(second.problem.id).not.toBe(first.problem.id);
		expect(second.metadata).toMatchObject({
			provider: 'local',
			fallbackReason: 'duplicate_content_rejected'
		});
	});

	it('keeps generated CEPT objectives neutral and rejects a three-choice generated drill', async () => {
		const approvedReview = {
			targetAligned: true,
			answerAgrees: true,
			levelAppropriate: true,
			examAligned: true,
			learnerRelevant: true
		};
		const fourChoiceGap = {
			kind: 'choice',
			prompt: 'She ____ the report before the meeting began.',
			choices: [
				{ id: 'a', text: 'finishes' },
				{ id: 'b', text: 'has finished' },
				{ id: 'c', text: 'had finished' },
				{ id: 'd', text: 'finishing' }
			],
			answerKey: 'c',
			explanation: 'Past perfect marks the earlier past action.'
		};
		const acceptedOutputs = [fourChoiceGap, approvedReview];
		const acceptedRuntime: WorkersAiRuntime = {
			provider: 'workers-ai',
			ai: { run: async () => ({ response: JSON.stringify(acceptedOutputs.shift()) }) },
			textModelId: '@cf/test/model',
			transcriptionModelId: '@cf/test/asr'
		};
		const placementProfile = inferPlacementTestProfile('Prepare for Cambridge CEPT.');
		const accepted = await generatePracticeProblem({
			skillProfile: profile,
			studyPlan,
			placementProfile,
			selection: {
				targetArea: 'grammar_usage',
				targetSignal: 'verb_form',
				difficulty: 'practice',
				adaptiveReason: 'plan_balance'
			},
			runtime: acceptedRuntime
		});

		expect(accepted.metadata.provider).toBe('workers-ai');
		expect(accepted.problem).toMatchObject({
			kind: 'choice',
			placementTaskType: 'targeted_skill_drill',
			choices: expect.arrayContaining([expect.objectContaining({ id: 'd' })])
		});

		const threeChoiceRead = {
			kind: 'choice',
			prompt: 'A short generated reading drill.',
			choices: [
				{ id: 'a', text: 'First' },
				{ id: 'b', text: 'Second' },
				{ id: 'c', text: 'Third' }
			],
			answerKey: 'a',
			explanation: 'The first choice is keyed.'
		};
		const wrongCountRuntime: WorkersAiRuntime = {
			provider: 'workers-ai',
			ai: { run: async () => ({ response: JSON.stringify(threeChoiceRead) }) },
			textModelId: '@cf/test/model',
			transcriptionModelId: '@cf/test/asr'
		};
		const rejected = await generatePracticeProblem({
			skillProfile: profile,
			studyPlan,
			placementProfile,
			selection: {
				targetArea: 'reading',
				targetSignal: 'main_idea',
				difficulty: 'practice',
				adaptiveReason: 'plan_balance'
			},
			runtime: wrongCountRuntime
		});

		expect(rejected.metadata).toMatchObject({
			provider: 'local',
			fallbackReason: 'profile_format_rejected'
		});
		expect(rejected.problem).toMatchObject({
			kind: 'choice',
			placementTaskType: 'targeted_skill_drill'
		});
		if (rejected.problem.kind !== 'choice') throw new Error('Expected a CEPT choice fallback.');
		expect(rejected.problem.choices).toHaveLength(4);
	});

	it('normalizes legacy private JSON without reviving fake model versions', () => {
		const metadata = validatePracticeMetadata({
			schemaVersion: 1,
			provider: 'local',
			model: 'deterministic-practice',
			modelVersion: '2026-07-08'
		});

		expect(metadata).toMatchObject({
			modelId: 'deterministic-practice',
			promptVersion: 'legacy-v1',
			fallbackReason: 'legacy_metadata'
		});
		expect(metadata).not.toHaveProperty('modelVersion');
	});

	it('returns complete corrective review details without exposing them before submission', async () => {
		const { problem } = await generatePracticeProblem({
			skillProfile: profile,
			studyPlan,
			selection: {
				targetArea: 'grammar_usage',
				targetSignal: 'verb_form',
				difficulty: 'foundation',
				adaptiveReason: 'plan_balance'
			},
			runtime: null
		});
		const feedback = gradePracticeAnswer(problem, 'tampered-answer-id');
		const review = buildPracticeReview(
			problem,
			JSON.stringify({ kind: problem.kind, answer: 'tampered-answer-id' }),
			feedback
		);

		expect(feedback.kind).toBe('objective');
		expect(feedback.kind === 'objective' && feedback.correct).toBe(false);
		expect(feedback).toMatchObject({
			prompt: problem.prompt,
			learnerAnswer: 'tampered-answer-id',
			explanation: expect.any(String),
			expectedAnswer: expect.any(String),
			nextStep: expect.stringContaining('Retry')
		});
		expect(review).toMatchObject({
			prompt: problem.prompt,
			learnerAnswer: 'tampered-answer-id',
			expectedAnswer: expect.any(String),
			explanation: expect.any(String),
			nextStep: expect.any(String)
		});
		expect(() =>
			validatePracticeResponse({ kind: 'short_text', text: 'x'.repeat(2001) })
		).toThrow();
	});
});

describe('reassessment progress', () => {
	it('does not treat repeated responses to one item as independent reassessment evidence', () => {
		const history = Array.from({ length: 20 }, (_, index) =>
			historyEntry({ sessionId: `session-${Math.floor(index / 5) + 1}` })
		);

		expect(
			getReassessmentProgress(history, 20, {
				targets: studyPlan.targets,
				completedSessions: 4,
				minimumResponsesPerTarget: 3
			})
		).toMatchObject({
			scoredCount: 2,
			coveredTargets: 0,
			requiredTargets: 3,
			distributedEvidenceReady: false,
			recommended: false
		});
	});

	it('recommends reassessment only after evidence is distributed across targets and sessions', () => {
		const targets = studyPlan.targets;
		const history = Array.from({ length: 21 }, (_, index) => {
			const target = targets[index % targets.length];
			return historyEntry({
				sessionId: `session-${Math.floor(index / 5) + 1}`,
				targetArea: target.area,
				targetSignal: target.signal,
				contentId: `${target.signal}-independent-${index}`
			});
		});
		history.push(historyEntry({ scored: false, correct: null }));

		expect(
			getReassessmentProgress(history, 20, {
				targets,
				completedSessions: 5,
				minimumResponsesPerTarget: 3
			})
		).toMatchObject({
			scoredCount: 21,
			coveredTargets: 3,
			requiredTargets: 3,
			completedSessions: 5,
			distributedEvidenceReady: true,
			sessionEvidenceReady: true,
			recommended: true
		});
	});

	it('uses the finite reviewed-bank capacity for a one-target reassessment gate', () => {
		const target = { area: 'grammar_usage', signal: 'verb_form' } as const;
		const contentIds = [
			'verb_form-foundation-1',
			'verb_form-foundation-2',
			'verb_form-practice-1',
			'verb_form-practice-2',
			'verb_form-challenge-1',
			'verb_form-challenge-2',
			'verb_form-challenge-1',
			'verb_form-challenge-2'
		];
		const history = contentIds.map((contentId, index) =>
			historyEntry({
				sessionId: `session-${Math.floor(index / 5) + 1}`,
				contentId,
				difficulty: index < 2 ? 'foundation' : index < 4 ? 'practice' : 'challenge'
			})
		);

		expect(
			getReassessmentProgress(history, 20, { targets: [target], completedSessions: 2 })
		).toMatchObject({
			threshold: 8,
			scoredCount: 8,
			remaining: 0,
			requiredSessions: 2,
			coveredTargets: 1,
			recommended: true
		});
		expect(
			getReassessmentProgress(history.slice(0, -1), 20, {
				targets: [target],
				completedSessions: 2
			})
		).toMatchObject({ threshold: 8, scoredCount: 7, remaining: 1, recommended: false });
	});

	it('scales the finite reviewed-bank gate across two targets', () => {
		const targets = [
			{ area: 'grammar_usage', signal: 'verb_form' },
			{ area: 'vocabulary', signal: 'collocation' }
		] as const;
		const levels = [
			'foundation-1',
			'foundation-2',
			'practice-1',
			'practice-2',
			'challenge-1',
			'challenge-2',
			'challenge-1',
			'challenge-2'
		];
		const history = targets.flatMap((target, targetIndex) =>
			Array.from({ length: 8 }, (_, index) =>
				historyEntry({
					sessionId: `session-${Math.floor((targetIndex * 8 + index) / 5) + 1}`,
					targetArea: target.area,
					targetSignal: target.signal,
					contentId: `${target.signal}-${levels[index]}`
				})
			)
		);

		expect(getReassessmentProgress(history, 20, { targets, completedSessions: 4 })).toMatchObject({
			threshold: 16,
			scoredCount: 16,
			coveredTargets: 2,
			requiredTargets: 2,
			requiredSessions: 4,
			recommended: true
		});
	});
});
