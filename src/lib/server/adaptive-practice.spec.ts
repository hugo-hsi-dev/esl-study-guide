import { describe, expect, it } from 'vitest';
import {
	generatePracticeProblem,
	getLatestPracticeProblem,
	savePracticeAttempt,
	type PracticeFeedback,
	type PracticeProblem
} from './adaptive-practice';
import { saveAssessmentAttempt } from './assessment-attempts';
import { getLearnerAssessmentItems, type ErrorSignal } from './assessment-items';
import type { SkillProfile, StudyPlan } from './assessment-diagnosis';
import type { Db } from './db';
import { assessmentAttempt } from './db/schema';

const skillProfile: SkillProfile = {
	evidence: {
		listening: { taskCount: 1, status: 'answered_correctly', summary: 'One answer is saved.' },
		reading: { taskCount: 1, status: 'answered_correctly', summary: 'One answer is saved.' },
		grammar_usage: { taskCount: 1, status: 'needs_practice', summary: 'One answer is saved.' },
		vocabulary: { taskCount: 1, status: 'answered_correctly', summary: 'One answer is saved.' },
		writing: { taskCount: 1, status: 'sample_saved', summary: 'One sample is saved.' },
		speaking: { taskCount: 1, status: 'sample_saved', summary: 'One sample is saved.' }
	},
	priorityWeaknesses: [],
	missedAnswerExamples: [],
	rubricOutputs: {
		writing: { score: null, signals: [], feedback: 'One sample is saved.' },
		speaking: { score: null, signals: [], feedback: 'One sample is saved.' },
		pronunciation: {
			score: null,
			signals: [],
			feedback: 'Pronunciation scoring is deferred.'
		}
	}
};

const studyPlan: StudyPlan = { today: [], thisWeek: [], targetSignals: ['verb_form'] };

const errorSignals = [
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

const practiceHistoryEntry = (practiceProblemJson: PracticeProblem, correct: boolean) => ({
	practiceProblemJson,
	feedbackJson: {
		correct,
		message: correct ? 'Correct.' : 'Not yet.'
	} satisfies PracticeFeedback
});

describe('adaptive practice', () => {
	it('uses persisted assessment history and returns a fresh next practice payload', async () => {
		expect.assertions(15);

		const assessmentRows: unknown[] = [];
		const practiceRows: unknown[] = [];
		const db = {
			select: () => ({
				from: (table: unknown) => ({
					where: () => ({
						orderBy: () =>
							table === assessmentAttempt ? { limit: async () => assessmentRows } : practiceRows
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
				formData.set(`answer:${item.id}`, 'c');
			} else {
				formData.set(`answer:${item.id}`, item.area === 'vocabulary' ? 'c' : 'b');
			}
		}

		await saveAssessmentAttempt(db, 'learner-1', formData);
		const result = await savePracticeAttempt(db, 'learner-1', 'a');
		const persisted = await getLatestPracticeProblem(db, 'learner-1');
		const row = practiceRows[0] as {
			learnerUserId: string;
			assessmentAttemptId: string;
			practiceProblemJson: { targetSignal: string };
			answer: string;
			feedbackJson: { correct: boolean; message: string };
			metadataJson: { model: string; schemaVersion: number };
		};

		expect(assessmentRows).toHaveLength(1);
		expect(practiceRows).toHaveLength(1);
		expect(result?.problem.targetArea).toBe('grammar_usage');
		expect(result?.problem.sourceResponseItemId).toBe('grammar-simple-present-goes');
		expect(result?.problem.id).toBe('practice-verb_form-1');
		expect(row.learnerUserId).toBe('learner-1');
		expect(row.assessmentAttemptId).toBe((assessmentRows[0] as { id: string }).id);
		expect(row.practiceProblemJson.targetSignal).toBe('verb_form');
		expect(row.answer).toBe('a');
		expect(row.feedbackJson.message).toContain('Correct');
		expect(row.metadataJson).toMatchObject({ model: 'deterministic-practice', schemaVersion: 1 });
		expect(result?.nextPractice.assessmentAttemptId).toBe(result?.assessmentAttemptId);
		expect(result?.nextPractice.problem.id).toBe('practice-verb_form-3');
		expect(result?.nextPractice.problem.id).not.toBe(result?.problem.id);
		expect(persisted?.problem.id).toBe(result?.nextPractice.problem.id);
	});

	it('changes variants from practice history and gives a different supportive example after an incorrect answer', async () => {
		expect.assertions(8);

		const first = await generatePracticeProblem({ skillProfile, studyPlan, recentResponses: [] });
		const afterCorrect = await generatePracticeProblem({
			skillProfile,
			studyPlan,
			recentResponses: [],
			practiceHistory: [practiceHistoryEntry(first.problem, true)]
		});
		const afterIncorrect = await generatePracticeProblem({
			skillProfile,
			studyPlan,
			recentResponses: [],
			practiceHistory: [practiceHistoryEntry(first.problem, false)]
		});
		const afterTwoIncorrect = await generatePracticeProblem({
			skillProfile,
			studyPlan,
			recentResponses: [],
			practiceHistory: [
				practiceHistoryEntry(first.problem, false),
				practiceHistoryEntry(afterIncorrect.problem, false)
			]
		});

		expect(first.problem.id).toBe('practice-verb_form-1');
		expect(first.problem.choices.some((choice) => choice.id === first.problem.answerKey)).toBe(
			true
		);
		expect(afterCorrect.problem.id).toBe('practice-verb_form-3');
		expect(afterCorrect.problem.id).not.toBe(first.problem.id);
		expect(afterIncorrect.problem.id).toBe('practice-verb_form-2');
		expect(afterIncorrect.problem.id).not.toBe(first.problem.id);
		expect(afterIncorrect.problem.prompt).toContain('Tip:');
		expect(afterTwoIncorrect.problem.id).toBe('practice-verb_form-3');
	});

	it('keeps three distinct, answerable curated variants for every ESL signal', async () => {
		expect.assertions(errorSignals.length * 6);

		for (const signal of errorSignals) {
			const first = await generatePracticeProblem({
				skillProfile,
				studyPlan: { ...studyPlan, targetSignals: [signal] },
				recentResponses: []
			});
			const supportive = await generatePracticeProblem({
				skillProfile,
				studyPlan: { ...studyPlan, targetSignals: [signal] },
				recentResponses: [],
				practiceHistory: [practiceHistoryEntry(first.problem, false)]
			});
			const supportiveFollowUp = await generatePracticeProblem({
				skillProfile,
				studyPlan: { ...studyPlan, targetSignals: [signal] },
				recentResponses: [],
				practiceHistory: [
					practiceHistoryEntry(first.problem, false),
					practiceHistoryEntry(supportive.problem, false)
				]
			});

			expect(first.problem.targetSignal).toBe(signal);
			expect(supportive.problem.targetSignal).toBe(signal);
			expect(supportiveFollowUp.problem.targetSignal).toBe(signal);
			expect(
				new Set([first.problem.id, supportive.problem.id, supportiveFollowUp.problem.id]).size
			).toBe(3);
			expect(
				new Set([
					first.problem.prompt,
					supportive.problem.prompt,
					supportiveFollowUp.problem.prompt
				]).size
			).toBe(3);
			expect(
				supportiveFollowUp.problem.choices.some(
					(choice) => choice.id === supportiveFollowUp.problem.answerKey
				)
			).toBe(true);
		}
	});
});
