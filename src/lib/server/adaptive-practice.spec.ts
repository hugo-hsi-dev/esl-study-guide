import { describe, expect, it } from 'vitest';
import { generatePracticeProblem, savePracticeAttempt } from './adaptive-practice';
import type { SkillProfile, StudyPlan } from './assessment-diagnosis';
import type { Db } from './db';

describe('savePracticeAttempt', () => {
	it('persists a targeted practice attempt with feedback metadata', async () => {
		expect.assertions(7);

		const skillProfile: SkillProfile = {
			skillBands: {
				listening: 'functional',
				reading: 'functional',
				grammar_usage: 'emerging',
				vocabulary: 'functional',
				writing: 'developing',
				speaking: 'developing'
			},
			priorityWeaknesses: [
				{ area: 'grammar_usage', signal: 'verb_form', reason: 'Observed verb forms.' }
			],
			missedAnswerExamples: [],
			rubricOutputs: {
				writing: { score: 1, signals: [], feedback: 'ok' },
				speaking: { score: 1, signals: [], feedback: 'ok' },
				pronunciation: {
					score: null,
					signals: [],
					feedback: 'Pronunciation scoring is deferred.'
				}
			}
		};
		const studyPlan: StudyPlan = {
			today: ['Practice verb forms.'],
			thisWeek: ['Review verb forms.'],
			targetSignals: ['verb_form']
		};
		const rows: unknown[] = [];
		const db = {
			select: () => ({
				from: () => ({
					where: () => ({
						orderBy: () => ({
							limit: async () => [
								{ id: 'attempt-1', skillProfileJson: skillProfile, studyPlanJson: studyPlan }
							]
						})
					})
				})
			}),
			insert: () => ({
				values: async (row: unknown) => rows.push(row)
			})
		} as unknown as Db;

		const result = await savePracticeAttempt(db, 'learner-1', 'b');
		const row = rows[0] as {
			learnerUserId: string;
			assessmentAttemptId: string;
			practiceProblemJson: { targetSignal: string };
			answer: string;
			feedbackJson: { correct: boolean; message: string };
			metadataJson: { model: string; schemaVersion: number };
		};

		expect(result?.feedback.correct).toBe(true);
		expect(row.learnerUserId).toBe('learner-1');
		expect(row.assessmentAttemptId).toBe('attempt-1');
		expect(row.practiceProblemJson.targetSignal).toBe('verb_form');
		expect(row.answer).toBe('b');
		expect(row.feedbackJson.message).toContain('Correct');
		expect(row.metadataJson).toMatchObject({ model: 'deterministic-practice', schemaVersion: 1 });
	});

	it('generates a validated problem from the top target signal', async () => {
		expect.assertions(2);

		const { problem } = await generatePracticeProblem(
			{
				skillBands: {
					listening: 'functional',
					reading: 'functional',
					grammar_usage: 'emerging',
					vocabulary: 'functional',
					writing: 'developing',
					speaking: 'developing'
				},
				priorityWeaknesses: [],
				missedAnswerExamples: [],
				rubricOutputs: {
					writing: { score: 1, signals: [], feedback: 'ok' },
					speaking: { score: 1, signals: [], feedback: 'ok' },
					pronunciation: {
						score: null,
						signals: [],
						feedback: 'Pronunciation scoring is deferred.'
					}
				}
			},
			{ today: [], thisWeek: [], targetSignals: ['verb_form'] }
		);

		expect(problem.targetSignal).toBe('verb_form');
		expect(problem.choices.some((choice) => choice.id === problem.answerKey)).toBe(true);
	});
});
