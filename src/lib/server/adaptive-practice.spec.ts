import { describe, expect, it } from 'vitest';
import { generatePracticeProblem, savePracticeAttempt } from './adaptive-practice';
import { saveAssessmentAttempt } from './assessment-attempts';
import { getLearnerAssessmentItems } from './assessment-items';
import type { Db } from './db';

describe('savePracticeAttempt', () => {
	it('persists one adaptive practice attempt after assessment diagnosis', async () => {
		expect.assertions(10);

		const assessmentRows: unknown[] = [];
		const practiceRows: unknown[] = [];
		const db = {
			select: () => ({
				from: () => ({
					where: () => ({
						orderBy: () => ({
							limit: async () => assessmentRows
						})
					})
				})
			}),
			insert: () => ({
				values: async (row: unknown) => {
					if (row && typeof row === 'object' && 'practiceProblemJson' in row) {
						practiceRows.push(row);
					} else {
						assessmentRows.push(row);
					}
				}
			})
		} as unknown as Db;

		const formData = new FormData();
		for (const item of getLearnerAssessmentItems()) {
			if (item.area === 'writing') {
				formData.set(
					`answer:${item.id}`,
					'I fixed a bill. I called support. They helped me. The bill is correct now.'
				);
			} else if (item.area === 'speaking') {
				formData.set(`speakingSeconds:${item.id}`, '42');
			} else if (item.area === 'grammar_usage') {
				formData.set(`answer:${item.id}`, 'a');
			} else {
				formData.set(`answer:${item.id}`, item.area === 'vocabulary' ? 'c' : 'b');
			}
		}

		await saveAssessmentAttempt(db, 'learner-1', formData);
		const result = await savePracticeAttempt(db, 'learner-1', 'b');
		const row = practiceRows[0] as {
			learnerUserId: string;
			assessmentAttemptId: string;
			practiceProblemJson: {
				targetArea: string;
				targetSignal: string;
				sourceResponseItemId?: string;
			};
			answer: string;
			feedbackJson: { correct: boolean; message: string };
			metadataJson: { model: string; schemaVersion: number };
		};

		expect(assessmentRows).toHaveLength(1);
		expect(practiceRows).toHaveLength(1);
		expect(result?.problem.targetArea).toBe('grammar_usage');
		expect(result?.problem.sourceResponseItemId).toBe('grammar-simple-present-goes');
		expect(row.learnerUserId).toBe('learner-1');
		expect(row.assessmentAttemptId).toBe((assessmentRows[0] as { id: string }).id);
		expect(row.practiceProblemJson.targetSignal).toBe('verb_form');
		expect(row.answer).toBe('b');
		expect(row.feedbackJson.message).toContain('Correct');
		expect(row.metadataJson).toMatchObject({ model: 'deterministic-practice', schemaVersion: 1 });
	});

	it('generates a validated problem from the top target signal', () => {
		expect.assertions(2);

		const problem = generatePracticeProblem({
			skillProfile: {
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
					pronunciation: { score: null, signals: [], feedback: 'No audio.' }
				}
			},
			studyPlan: { today: [], thisWeek: [], targetSignals: ['verb_form'] },
			recentResponses: []
		});

		expect(problem.targetSignal).toBe('verb_form');
		expect(problem.choices.some((choice) => choice.id === problem.answerKey)).toBe(true);
	});
});
