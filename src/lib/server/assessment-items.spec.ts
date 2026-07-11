import { describe, expect, it } from 'vitest';
import {
	getLearnerAssessmentItems,
	seedAssessmentItems,
	validateSeedAssessmentItems,
	type AssessmentItem
} from './assessment-items';

describe('seedAssessmentItems', () => {
	it('has reviewed items for each diagnostic area', () => {
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
					item.errorSignalTags.includes(item.primaryScoredSignal)
			)
		).toBe(true);
		expect(() =>
			validateSeedAssessmentItems([
				...seedAssessmentItems,
				{ ...seedAssessmentItems[0], version: 2, prompt: 'A reviewed future item version.' }
			])
		).not.toThrow();
	});

	it('keeps answer and review data out of learner-facing items', () => {
		expect.assertions(7);

		const learnerItemJson = JSON.stringify(getLearnerAssessmentItems());

		expect(learnerItemJson).not.toContain('answerKey');
		expect(learnerItemJson).not.toContain('rubric');
		expect(learnerItemJson).not.toContain('review');
		expect(learnerItemJson).not.toContain('serverOnlyAudioScript');
		expect(learnerItemJson).not.toContain('serverOnlyAudioMetadata');
		expect(learnerItemJson).not.toContain('primaryScoredSignal');
		expect(learnerItemJson).not.toContain('errorSignalTags');
	});
});
