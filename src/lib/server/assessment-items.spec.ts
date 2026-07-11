import { describe, expect, it } from 'vitest';
import {
	getAssessmentResponseSignals,
	getLearnerAssessmentItems,
	seedAssessmentItems,
	validateSeedAssessmentItems,
	type AssessmentItem
} from './assessment-items';

describe('seedAssessmentItems', () => {
	it('has reviewed versioned items for each diagnostic area', () => {
		expect.assertions(4);

		expect(() => validateSeedAssessmentItems(seedAssessmentItems)).not.toThrow();
		expect(seedAssessmentItems).toHaveLength(14);
		const objectiveItems: readonly AssessmentItem[] = seedAssessmentItems.filter(
			(item) => 'answerKey' in item
		);
		expect(
			objectiveItems.every(
				(item) =>
					item.primaryScoredSignal !== undefined &&
					item.errorSignalTags.includes(item.primaryScoredSignal) &&
					item.responseSignals !== undefined
			)
		).toBe(true);
		expect(() =>
			validateSeedAssessmentItems([
				...seedAssessmentItems,
				{ ...seedAssessmentItems[0], version: 2, prompt: 'A reviewed future item version.' }
			])
		).not.toThrow();
	});

	it('keeps answer, diagnosis, and review data out of learner-facing items', () => {
		expect.assertions(8);

		const learnerItemJson = JSON.stringify(getLearnerAssessmentItems());

		expect(learnerItemJson).not.toContain('answerKey');
		expect(learnerItemJson).not.toContain('rubric');
		expect(learnerItemJson).not.toContain('review');
		expect(learnerItemJson).not.toContain('serverOnlyAudioScript');
		expect(learnerItemJson).not.toContain('serverOnlyAudioMetadata');
		expect(learnerItemJson).not.toContain('primaryScoredSignal');
		expect(learnerItemJson).not.toContain('errorSignalTags');
		expect(learnerItemJson).not.toContain('responseSignals');
	});

	it('maps each incorrect response to the construct it actually tests', () => {
		expect.assertions(2);

		expect(getAssessmentResponseSignals('grammar-simple-present-goes', 1, 'a')).toEqual([
			'subject_verb_agreement'
		]);
		expect(getAssessmentResponseSignals('grammar-simple-present-goes', 1, 'c')).toEqual([
			'verb_form'
		]);
	});
});
