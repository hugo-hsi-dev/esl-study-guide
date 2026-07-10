import { describe, expect, it } from 'vitest';
import {
	bandFromObjectiveScore,
	buildAssessmentDiagnosis,
	validateProductiveRubric,
	type DiagnosisInput
} from './assessment-diagnosis';
import { getSeedAssessmentItems } from './assessment-items';
import type { AttemptResponse } from './db/schema';

const metadata = {
	provider: 'local' as const,
	modelId: 'deterministic-objective-scoring',
	promptVersion: 'assessment-diagnosis-v2' as const,
	schemaVersion: 2 as const,
	generatedAt: '2026-07-10T00:00:00.000Z',
	fallbackReason: 'workers_ai_unavailable'
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
	] as const)('maps %i of 3 objective answers to %s', (correctCount, expectedBand) => {
		const result = buildAssessmentDiagnosis(inputWithListeningCorrect(correctCount), {}, metadata);
		expect(result.skillProfile.skillBands.listening).toBe(expectedBand);
		expect(bandFromObjectiveScore(correctCount)).toBe(expectedBand);
	});

	it('uses choice text and only the primary scored signal for missed examples', () => {
		const input = inputWithListeningCorrect(0);
		const firstItem = getSeedAssessmentItems().find((item) => item.area === 'listening')!;
		const firstResponse = input.responses.find(
			(response) => response.itemId === firstItem.id
		) as Extract<AttemptResponse, { kind: 'objective' }>;
		const result = buildAssessmentDiagnosis(input, {}, metadata);
		const example = result.skillProfile.missedAnswerExamples.find(
			(candidate) => candidate.itemId === firstItem.id
		)!;

		expect(example.learnerAnswer).toBe(
			firstItem.choices!.find((choice) => choice.id === firstResponse.answer)!.text
		);
		expect(example.expectedAnswer).toBe(
			firstItem.choices!.find((choice) => choice.id === firstItem.answerKey![0])!.text
		);
		expect(example.errorSignals).toEqual([firstItem.primaryScoredSignal]);
	});

	it('marks productive areas as insufficient instead of using response-length heuristics', () => {
		const result = buildAssessmentDiagnosis(inputWithListeningCorrect(3), {}, metadata);
		expect(result.skillProfile.diagnosisQuality).toBe('limited');
		expect(result.skillProfile.skillBands.writing).toBe('insufficient_evidence');
		expect(result.skillProfile.skillBands.speaking).toBe('insufficient_evidence');
		expect(result.diagnosisMetadata.fallbackReason).toBe('workers_ai_unavailable');
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
