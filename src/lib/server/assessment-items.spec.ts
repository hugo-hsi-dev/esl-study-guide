import { describe, expect, it } from 'vitest';
import {
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
		expect.assertions(4);

		const learnerItemJson = JSON.stringify(getLearnerAssessmentItems());

		expect(learnerItemJson).not.toContain('answerKey');
		expect(learnerItemJson).not.toContain('rubric');
		expect(learnerItemJson).not.toContain('review');
		expect(learnerItemJson).not.toContain('serverOnlyAudioScript');
	});
});
