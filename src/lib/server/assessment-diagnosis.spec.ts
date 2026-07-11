import { describe, expect, it } from 'vitest';
import { diagnoseAssessmentAttempt } from './assessment-diagnosis';
import { getLearnerAssessmentItems } from './assessment-items';

describe('diagnoseAssessmentAttempt', () => {
	it('reports one-task evidence and only the signal supported by the selected distractor', async () => {
		expect.assertions(10);

		const items = getLearnerAssessmentItems();
		const itemFor = (area: (typeof items)[number]['area']) =>
			items.find((item) => item.area === area)!;
		const grammar = itemFor('grammar_usage');

		const result = await diagnoseAssessmentAttempt({
			selectedItems: items.map(({ id, version, area }) => ({ id, version, area })),
			responses: [
				{
					area: 'listening',
					itemId: itemFor('listening').id,
					itemVersion: 1,
					kind: 'objective',
					answer: 'b'
				},
				{
					area: 'reading',
					itemId: itemFor('reading').id,
					itemVersion: 1,
					kind: 'objective',
					answer: 'b'
				},
				{
					area: 'grammar_usage',
					itemId: grammar.id,
					itemVersion: grammar.version,
					kind: 'objective',
					answer: 'c'
				},
				{
					area: 'vocabulary',
					itemId: itemFor('vocabulary').id,
					itemVersion: 1,
					kind: 'objective',
					answer: 'c'
				},
				{
					area: 'writing',
					itemId: itemFor('writing').id,
					itemVersion: 1,
					kind: 'writing_text',
					answer: 'I fixed the problem.'
				},
				{
					area: 'speaking',
					itemId: itemFor('speaking').id,
					itemVersion: 1,
					kind: 'speaking_metadata',
					metadata: { representedBy: 'temporary_metadata', responseSeconds: 1 }
				}
			]
		});

		expect(result.skillProfile.evidence.grammar_usage).toMatchObject({
			taskCount: 1,
			status: 'needs_practice'
		});
		expect(result.skillProfile.priorityWeaknesses).toHaveLength(1);
		expect(result.skillProfile.priorityWeaknesses[0]).toMatchObject({
			area: 'grammar_usage',
			signal: 'verb_form'
		});
		expect(result.skillProfile.missedAnswerExamples[0]?.learnerAnswer).toBe('going');
		expect(result.skillProfile.missedAnswerExamples[0]?.expectedAnswer).toBe('goes');
		expect(result.skillProfile.missedAnswerExamples[0]?.errorSignals).toEqual(['verb_form']);
		expect(result.skillProfile.rubricOutputs.writing.score).toBeNull();
		expect(result.skillProfile.rubricOutputs.speaking.score).toBeNull();
		expect(result.skillProfile.evidence.speaking.summary).toContain('Audio is not stored');
		expect(result.skillProfile.rubricOutputs.pronunciation.score).toBeNull();
	});
});
