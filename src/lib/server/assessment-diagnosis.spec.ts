import { describe, expect, it } from 'vitest';
import {
	bandFromObjectiveScore,
	buildAssessmentDiagnosis,
	diagnoseAssessmentAttempt,
	validateProductiveRubric,
	type DiagnosisInput
} from './assessment-diagnosis';
import { getSeedAssessmentItems } from './assessment-items';
import type { AttemptResponse } from './db/schema';

const metadata = {
	provider: 'local' as const,
	modelId: 'evidence-calibrated-diagnosis',
	promptVersion: 'assessment-diagnosis-v2' as const,
	schemaVersion: 2 as const,
	generatedAt: '2026-07-10T00:00:00.000Z',
	fallbackReason: 'productive_scoring_deferred'
};

const inputWithListeningCorrect = (correctCount: number): DiagnosisInput => {
	let listeningSeen = 0;
	const responses: AttemptResponse[] = getSeedAssessmentItems().map((item) => {
		if (item.area === 'writing') {
			return {
				area: 'writing',
				itemId: item.id,
				itemVersion: item.version,
				kind: 'writing_text',
				answer: 'I solved a problem at work.'
			};
		}
		if (item.area === 'speaking') {
			return {
				area: 'speaking',
				itemId: item.id,
				itemVersion: item.version,
				kind: 'speaking_metadata',
				metadata: {
					representedBy: 'temporary_metadata',
					responseSeconds: 30,
					transcript: 'I bought a notebook because I needed it.',
					transcriptSource: 'submitted'
				}
			};
		}

		const shouldBeCorrect = item.area !== 'listening' || listeningSeen++ < correctCount;
		const answer = shouldBeCorrect
			? item.answerKey![0]
			: item.choices!.find((choice) => !item.answerKey!.includes(choice.id))!.id;
		return {
			area: item.area,
			itemId: item.id,
			itemVersion: item.version,
			kind: 'objective',
			answer
		};
	});
	return {
		selectedItems: getSeedAssessmentItems().map(({ id, version, area }) => ({ id, version, area })),
		responses
	};
};

describe('assessment diagnosis', () => {
	it.each([
		[0, 'emerging'],
		[1, 'developing'],
		[2, 'functional'],
		[3, 'strong']
	] as const)('maps %i of 3 reviewed objective answers to %s', (correctCount, expectedBand) => {
		const result = buildAssessmentDiagnosis(inputWithListeningCorrect(correctCount), {}, metadata);
		expect(result.skillProfile.skillBands.listening).toBe(expectedBand);
		expect(bandFromObjectiveScore(correctCount)).toBe(expectedBand);
	});

	it('keeps a one-task result as insufficient evidence and uses the selected distractor signal', () => {
		const grammar = getSeedAssessmentItems().find(
			(item) => item.id === 'grammar-simple-present-goes'
		)!;
		const result = buildAssessmentDiagnosis(
			{
				selectedItems: [{ id: grammar.id, version: grammar.version, area: grammar.area }],
				responses: [
					{
						area: 'grammar_usage',
						itemId: grammar.id,
						itemVersion: grammar.version,
						kind: 'objective',
						answer: 'c'
					}
				]
			},
			{},
			metadata
		);

		expect(result.skillProfile.skillBands.grammar_usage).toBe('insufficient_evidence');
		expect(result.skillProfile.evidenceCounts.grammar_usage).toBe(1);
		expect(result.skillProfile.priorityWeaknesses).toEqual([
			expect.objectContaining({ area: 'grammar_usage', signal: 'verb_form' })
		]);
		expect(result.skillProfile.missedAnswerExamples[0]).toMatchObject({
			learnerAnswer: 'going',
			expectedAnswer: 'goes',
			errorSignals: ['verb_form']
		});
	});

	it('keeps productive samples unscored and records an evidence-calibrated diagnosis', async () => {
		const result = await diagnoseAssessmentAttempt(inputWithListeningCorrect(3));

		expect(result.skillProfile.diagnosisQuality).toBe('limited');
		expect(result.skillProfile.skillBands.writing).toBe('insufficient_evidence');
		expect(result.skillProfile.skillBands.speaking).toBe('insufficient_evidence');
		expect(result.skillProfile.rubricOutputs.writing.score).toBeNull();
		expect(result.skillProfile.rubricOutputs.speaking.score).toBeNull();
		expect(result.skillProfile.rubricOutputs.pronunciation.score).toBeNull();
		expect(result.diagnosisMetadata).toMatchObject({
			modelId: 'evidence-calibrated-diagnosis',
			schemaVersion: 2,
			fallbackReason: 'productive_scoring_deferred'
		});
	});

	it('rejects AI Error Signals that the reviewed productive item cannot evidence', () => {
		const writing = getSeedAssessmentItems().find((item) => item.area === 'writing')!;
		expect(() =>
			validateProductiveRubric(writing, {
				score: 1,
				signals: ['main_idea'],
				feedback: 'The response needs a clearer main idea.'
			})
		).toThrow(/unevidenced Error Signal/);
	});
});
