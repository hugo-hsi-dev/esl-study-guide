import { describe, expect, it } from 'vitest';
import {
	assessmentFormIds,
	getAssessmentItemsForProfile,
	getLearnerAssessmentItemVersion,
	getAssessmentResponseSignals,
	getLearnerAssessmentItems,
	seedAssessmentItems,
	validateSeedAssessmentItems,
	type AssessmentItem
} from './assessment-items';

const expectedCeptChoiceCounts = {
	cept_read_and_select: 3,
	short_audio_comprehension: 3,
	short_passage_comprehension: 3,
	vocabulary_in_passage: 3,
	word_in_context: 3,
	fill_in_the_blank: 4,
	natural_word_pair: 4,
	cept_extended_listening_detail: 3,
	cept_extended_listening: 3,
	cept_extended_reading_detail: 4,
	cept_extended_reading: 4,
	cept_extended_reading_vocabulary: 4,
	cept_gapped_sentence: 4,
	cept_multiple_choice_gap_fill: 4
} as const satisfies Readonly<Record<string, 3 | 4>>;

describe('seedAssessmentItems', () => {
	it('has reviewed versioned items for each diagnostic area', () => {
		expect.assertions(4);

		expect(() => validateSeedAssessmentItems(seedAssessmentItems)).not.toThrow();
		expect(getLearnerAssessmentItems()).toHaveLength(14);
		const objectiveItems: readonly AssessmentItem[] = seedAssessmentItems.filter(
			(item) => 'answerKey' in item
		);
		expect(
			objectiveItems.every(
				(item) =>
					item.primaryScoredSignal !== undefined &&
					item.errorSignalTags.includes(item.primaryScoredSignal) &&
					(!item.choices?.length || item.responseSignals !== undefined)
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

	it.each(['accuplacer_esl', 'cambridge_cept'] as const)(
		'builds one 20-task objective form with three shared and two %s items per area',
		(profile) => {
			const fullItems = getAssessmentItemsForProfile(profile);
			const learnerItems = getLearnerAssessmentItems(profile);

			expect(fullItems).toHaveLength(20);
			expect(learnerItems).toHaveLength(20);
			expect(fullItems.every((item) => item.profile === 'shared' || item.profile === profile)).toBe(
				true
			);
			expect(fullItems.every((item) => item.area !== 'writing' && item.area !== 'speaking')).toBe(
				true
			);
			for (const area of ['listening', 'reading', 'grammar_usage', 'vocabulary'] as const) {
				const areaItems = fullItems.filter((item) => item.area === area);
				expect(areaItems).toHaveLength(5);
				expect(areaItems.filter((item) => item.difficulty === 'foundation')).toHaveLength(3);
				expect(areaItems.filter((item) => item.difficulty === 'intermediate')).toHaveLength(1);
				expect(areaItems.filter((item) => item.difficulty === 'challenge')).toHaveLength(1);
			}
		}
	);

	it.each(assessmentFormIds)(
		'uses one dedicated semantic CEPT read-and-select foundation item on form %s',
		(formId) => {
			const readingItems = getAssessmentItemsForProfile('cambridge_cept', {
				formId,
				areas: new Set(['reading'])
			});
			const readAndSelect = readingItems.filter((item) => item.taskType === 'cept_read_and_select');

			expect(readingItems).toHaveLength(5);
			expect(readingItems.filter((item) => item.difficulty === 'foundation')).toHaveLength(3);
			expect(readAndSelect).toHaveLength(1);
			expect(readAndSelect[0]).toMatchObject({
				profile: 'cambridge_cept',
				difficulty: 'foundation',
				answerMode: 'choice'
			});
			expect(readAndSelect[0]?.prompt).toMatch(/(?:notice|memo|label|letter)/iu);
			expect(readAndSelect[0]?.learnerTask.instructions).toMatch(
				/most closely matches the meaning/iu
			);
			expect(readAndSelect[0]?.choices).toHaveLength(3);
			expect(readAndSelect[0]?.answerKey).toHaveLength(1);
			expect(
				readingItems.filter((item) => item.taskType === 'short_passage_comprehension')
			).toHaveLength(1);
		}
	);

	it.each(assessmentFormIds)(
		'projects official choice counts without hiding an answer key on form %s',
		(formId) => {
			const areas = ['listening', 'reading', 'grammar_usage', 'vocabulary'] as const;
			for (const profile of ['accuplacer_esl', 'cambridge_cept'] as const) {
				for (let mask = 1; mask < 1 << areas.length; mask += 1) {
					const selectedAreas = new Set(areas.filter((_, index) => (mask & (1 << index)) !== 0));
					const fullItems = getAssessmentItemsForProfile(profile, {
						formId,
						areas: selectedAreas
					});
					const learnerItems = getLearnerAssessmentItems(profile, {
						formId,
						areas: selectedAreas
					});

					expect(learnerItems.map((item) => item.id)).toEqual(fullItems.map((item) => item.id));
					for (const fullItem of fullItems.filter((item) => item.answerMode === 'choice')) {
						const learnerItem = learnerItems.find((item) => item.id === fullItem.id);
						const visibleChoiceIds = learnerItem?.learnerTask.choices?.map((choice) => choice.id);
						const expectedChoiceCount =
							profile === 'accuplacer_esl'
								? 4
								: expectedCeptChoiceCounts[
										fullItem.taskType as keyof typeof expectedCeptChoiceCounts
									];

						expect(
							expectedChoiceCount,
							`missing expected CEPT choice count for ${fullItem.taskType}`
						).toBeDefined();
						expect(visibleChoiceIds).toHaveLength(expectedChoiceCount);
						expect(new Set(visibleChoiceIds).size).toBe(expectedChoiceCount);
						for (const answer of fullItem.answerKey ?? []) {
							expect(visibleChoiceIds).toContain(answer);
						}
					}
				}
			}
		}
	);

	it.each(assessmentFormIds)(
		'keeps every general shared choice task at four options on form %s',
		(formId) => {
			const fullItems = getAssessmentItemsForProfile('not_sure', { formId });
			const learnerItems = getLearnerAssessmentItems('not_sure', { formId });

			for (const fullItem of fullItems.filter((item) => item.answerMode === 'choice')) {
				const learnerItem = learnerItems.find((item) => item.id === fullItem.id);
				expect(fullItem.choices).toHaveLength(4);
				expect(learnerItem?.learnerTask.choices).toHaveLength(4);
				for (const answer of fullItem.answerKey ?? []) {
					expect(learnerItem?.learnerTask.choices?.map((choice) => choice.id)).toContain(answer);
				}
			}
		}
	);

	it('uses the attempt profile when projecting a stored shared item version', () => {
		const shared = getAssessmentItemsForProfile('accuplacer_esl')[0]!;
		const accuplacerItem = getLearnerAssessmentItemVersion(
			shared.id,
			shared.version,
			'accuplacer_esl'
		);
		const ceptItem = getLearnerAssessmentItemVersion(shared.id, shared.version, 'cambridge_cept');

		expect(accuplacerItem?.learnerTask.choices).toHaveLength(4);
		expect(ceptItem?.learnerTask.choices).toHaveLength(3);
		for (const answer of shared.answerKey ?? []) {
			expect(accuplacerItem?.learnerTask.choices?.map((choice) => choice.id)).toContain(answer);
			expect(ceptItem?.learnerTask.choices?.map((choice) => choice.id)).toContain(answer);
		}
	});

	it('keeps the general form at 14 tasks and supports a learner-facing CEPT open gap', () => {
		const general = getAssessmentItemsForProfile('not_sure');
		const school = getAssessmentItemsForProfile('school_specific');
		const openGap = getAssessmentItemsForProfile('cambridge_cept').find(
			(item) => item.answerMode === 'short_text'
		);
		const learnerGap = getLearnerAssessmentItems('cambridge_cept').find(
			(item) => item.id === openGap?.id
		);

		expect(general).toHaveLength(14);
		expect(school).toHaveLength(14);
		expect(openGap?.answerKey).toEqual(['for']);
		expect(openGap?.choices).toBeUndefined();
		expect(learnerGap?.answerMode).toBe('short_text');
		expect(learnerGap?.learnerTask.choices).toBeUndefined();
		expect(JSON.stringify(learnerGap)).not.toContain('answerKey');
	});

	it('adds the separate bounded WritePlacer ESL readiness essay only when requested', () => {
		const core = getAssessmentItemsForProfile('accuplacer_esl');
		const withEssay = getAssessmentItemsForProfile('accuplacer_esl', {
			includeAccuplacerWriting: true
		});
		const essay = withEssay.find((item) => item.id === 'accu-writeplacer-community-change');

		expect(core).toHaveLength(20);
		expect(withEssay).toHaveLength(21);
		expect(essay?.learnerTask.instructions).toContain('300–600 words');
		expect(essay?.learnerTask.instructions).toContain('not an official WritePlacer ESL 1–6 score');
	});

	it.each(assessmentFormIds)(
		'scores the ACCUPLACER inference probe as inference on form %s',
		(formId) => {
			const inferenceItem = getAssessmentItemsForProfile('accuplacer_esl', { formId }).find(
				(item) => item.taskType === 'reading_skills_inference'
			);

			expect(inferenceItem).toMatchObject({
				area: 'reading',
				primaryScoredSignal: 'inference',
				errorSignalTags: ['inference', 'detail']
			});
		}
	);

	it('gives every current item explicit alternate-form metadata and reviewed corrections', () => {
		for (const formId of assessmentFormIds) {
			const items = getAssessmentItemsForProfile('not_sure', { formId });
			expect(items).toHaveLength(14);
			expect(items.every((item) => item.formId === formId)).toBe(true);
			expect(items.every((item) => item.explanation.length > 0)).toBe(true);
			expect(items.every((item) => item.review.status === 'accepted')).toBe(true);
		}
	});

	it.each(assessmentFormIds)(
		'uses consecutive ordered shared stimuli for both CEPT extended-task series on form %s',
		(formId) => {
			const items = getAssessmentItemsForProfile('cambridge_cept', { formId });
			for (const [seriesType, expectedOrders] of [
				['listening', [1, 2]],
				['reading', [1, 2, 3]]
			] as const) {
				const series = items
					.filter(
						(item) =>
							item.profile === 'cambridge_cept' &&
							item.taskType.startsWith(`cept_extended_${seriesType}`)
					)
					.sort((left, right) => (left.stimulusOrder ?? 0) - (right.stimulusOrder ?? 0));

				expect(series.map((item) => item.stimulusOrder)).toEqual(expectedOrders);
				expect(new Set(series.map((item) => item.stimulusGroupId)).size).toBe(1);
				expect(series.map((item) => items.indexOf(item))).toEqual(
					series.map((_, index) => items.indexOf(series[0]!) + index)
				);
				expect(series[0]?.primaryScoredSignal).toBe('detail');
				expect(series[1]?.primaryScoredSignal).toBe('main_idea');
				if (seriesType === 'listening') {
					expect(new Set(series.map((item) => item.serverOnlyAudioScript)).size).toBe(1);
				} else {
					expect(new Set(series.map((item) => item.prompt)).size).toBe(1);
					expect(series[2]).toMatchObject({
						area: 'vocabulary',
						primaryScoredSignal: 'vocabulary_in_context'
					});
				}
			}
		}
	);
});
