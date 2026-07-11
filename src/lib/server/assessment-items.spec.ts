import { describe, expect, it } from 'vitest';
import {
	getAssessmentResponseSignals,
	getLearnerAssessmentItems,
	seedAssessmentItems,
	validateSeedAssessmentItems
} from './assessment-items';

describe('seedAssessmentItems', () => {
	it('has reviewed items for each diagnostic area', () => {
		expect.assertions(1);

		expect(() => validateSeedAssessmentItems(seedAssessmentItems)).not.toThrow();
	});

	it('keeps answer and review data out of learner-facing items', () => {
		expect.assertions(6);

		const learnerItemJson = JSON.stringify(getLearnerAssessmentItems());

		expect(learnerItemJson).not.toContain('answerKey');
		expect(learnerItemJson).not.toContain('rubric');
		expect(learnerItemJson).not.toContain('review');
		expect(learnerItemJson).not.toContain('serverOnlyAudioScript');
		expect(learnerItemJson).not.toContain('serverOnlyAudioMetadata');
		expect(learnerItemJson).not.toContain('responseSignals');
	});

	it('maps each incorrect response to the construct it actually tests', () => {
		expect.assertions(2);

		expect(getAssessmentResponseSignals('grammar-simple-present-goes', 'a')).toEqual([
			'subject_verb_agreement'
		]);
		expect(getAssessmentResponseSignals('grammar-simple-present-goes', 'c')).toEqual(['verb_form']);
	});
});
