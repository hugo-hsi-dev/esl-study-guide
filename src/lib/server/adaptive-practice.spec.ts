import { describe, expect, it } from 'vitest';
import type { SkillProfile, StudyPlan } from './assessment-diagnosis';
import {
	generatePracticeProblem,
	getReassessmentProgress,
	gradePracticeAnswer,
	practiceDifficulties,
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

const signals = [
	'main_idea',
	'detail',
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
		const history = [historyEntry(), historyEntry()];

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

	it('accepts an AI candidate only after a separate passing review', async () => {
		const outputs = [
			{
				response: JSON.stringify({
					kind: 'choice',
					prompt: 'Choose the best sentence.',
					choices: [
						{ id: 'a', text: 'He work here.' },
						{ id: 'b', text: 'He works here.' }
					],
					answerKey: 'b',
					explanation: 'Use works with he.'
				})
			},
			{
				response: JSON.stringify({
					targetAligned: true,
					answerAgrees: true,
					safeForAdultBeginner: true
				})
			}
		];
		const runtime: WorkersAiRuntime = {
			provider: 'workers-ai',
			ai: { run: async () => outputs.shift() },
			textModelId: '@cf/test/model',
			transcriptionModelId: '@cf/test/asr'
		};
		const generated = await generatePracticeProblem({
			skillProfile: profile,
			studyPlan,
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

	it('treats a tampered objective answer as wrong and enforces response bounds', async () => {
		expect.assertions(3);
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

		expect(feedback.kind).toBe('objective');
		expect(feedback.kind === 'objective' && feedback.correct).toBe(false);
		expect(() =>
			validatePracticeResponse({ kind: 'short_text', text: 'x'.repeat(2001) })
		).toThrow();
	});
});

describe('reassessment progress', () => {
	it('recommends reassessment after 20 scored responses and ignores unscored feedback', () => {
		const history = Array.from({ length: 20 }, () => historyEntry());
		history.push(historyEntry({ scored: false, correct: null }));

		expect(getReassessmentProgress(history)).toEqual({
			scoredCount: 20,
			threshold: 20,
			remaining: 0,
			recommended: true
		});
	});
});
