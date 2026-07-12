import { describe, expect, it } from 'vitest';
import {
	bandFromObjectiveScore,
	buildAssessmentDiagnosis,
	validateSkillProfile,
	validateStudyPlan,
	validateProductiveRubric,
	type DiagnosisInput
} from './assessment-diagnosis';
import { getAssessmentItemsForProfile, getLearnerAssessmentItems } from './assessment-items';
import type { AttemptResponse } from './db/schema';

const metadata = {
	provider: 'local' as const,
	modelId: 'deterministic-objective-scoring',
	promptVersion: 'assessment-diagnosis-v2' as const,
	schemaVersion: 2 as const,
	generatedAt: '2026-07-10T00:00:00.000Z',
	fallbackReason: 'workers_ai_unavailable'
};

const generalAssessmentItems = getAssessmentItemsForProfile('not_sure');

const inputWithListeningCorrect = (correctCount: number): DiagnosisInput => {
	let listeningSeen = 0;
	const responses: AttemptResponse[] = generalAssessmentItems.map((item) => {
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
		selectedItems: generalAssessmentItems.map(({ id, version, area }) => ({ id, version, area })),
		responses
	};
};

const correctProfileInput = (profile: 'accuplacer_esl' | 'cambridge_cept'): DiagnosisInput => {
	const items = getAssessmentItemsForProfile(profile);
	return {
		placementTest: { kind: profile, institution: '', targetOutcome: '', knownSections: '' },
		selectedItems: items.map(({ id, version, area }) => ({ id, version, area })),
		responses: items.map((item) => ({
			area: item.area as 'listening' | 'reading' | 'grammar_usage' | 'vocabulary',
			itemId: item.id,
			itemVersion: item.version,
			kind: 'objective' as const,
			answer: item.answerKey![0]
		}))
	};
};

const perfectGeneralInput = (): DiagnosisInput => {
	const input = inputWithListeningCorrect(3);
	const speaking = input.responses.find((response) => response.area === 'speaking') as Extract<
		AttemptResponse,
		{ kind: 'speaking_metadata' }
	>;
	speaking.metadata.transcriptSource = 'workers_ai_asr';
	return {
		...input,
		placementTest: {
			kind: 'not_sure',
			institution: '',
			targetOutcome: '',
			knownSections: ''
		}
	};
};

const perfectProductiveRubrics = {
	writing: { score: 3 as const, signals: [], feedback: 'The response met the writing target.' },
	speaking: { score: 3 as const, signals: [], feedback: 'The response met the speaking target.' }
};

const expectedMaintenanceSignals = {
	listening: 'detail',
	reading: 'main_idea',
	grammar_usage: 'verb_form',
	vocabulary: 'vocabulary_in_context',
	writing: 'sentence_control',
	speaking: 'clarity'
} as const;

describe('assessment diagnosis', () => {
	it.each([
		[0, 'emerging'],
		[1, 'developing'],
		[2, 'functional'],
		[3, 'functional']
	] as const)('maps %i of 3 objective answers to %s', (correctCount, expectedBand) => {
		const result = buildAssessmentDiagnosis(inputWithListeningCorrect(correctCount), {}, metadata);
		expect(result.skillProfile.skillBands.listening).toBe(expectedBand);
		expect(bandFromObjectiveScore(correctCount)).toBe(expectedBand);
	});

	it('uses choice text and only the primary scored signal for missed examples', () => {
		const input = inputWithListeningCorrect(0);
		const firstItem = generalAssessmentItems.find((item) => item.area === 'listening')!;
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
		expect(example).toMatchObject({
			itemVersion: firstItem.version,
			stimulus: firstItem.prompt,
			learnerQuestion: firstItem.learnerTask.instructions,
			audioUrl: `/assessment/audio/${firstItem.id}?version=${firstItem.version}`,
			audioTranscript: firstItem.serverOnlyAudioScript
		});
	});

	it('keeps completed correction answers and listening transcripts out of in-progress items', () => {
		const learnerPayload = JSON.stringify(getLearnerAssessmentItems('not_sure'));
		const listeningScript = generalAssessmentItems.find(
			(item) => item.area === 'listening'
		)?.serverOnlyAudioScript;

		expect(listeningScript).toBeDefined();
		expect(learnerPayload).not.toContain(listeningScript);
		expect(learnerPayload).not.toContain('audioTranscript');
		expect(learnerPayload).not.toContain('expectedAnswer');
		expect(learnerPayload).not.toContain('explanation');
	});

	it('continues to validate legacy corrections without completed-only context fields', () => {
		const result = buildAssessmentDiagnosis(inputWithListeningCorrect(0), {}, metadata);
		const legacyProfile = structuredClone(result.skillProfile);
		legacyProfile.missedAnswerExamples = legacyProfile.missedAnswerExamples.map(
			({ itemVersion, stimulus, learnerQuestion, audioUrl, audioTranscript, ...legacy }) => {
				void itemVersion;
				void stimulus;
				void learnerQuestion;
				void audioUrl;
				void audioTranscript;
				return legacy;
			}
		);

		expect(() => validateSkillProfile(legacyProfile)).not.toThrow();
	});

	it('marks productive areas as insufficient instead of using response-length heuristics', () => {
		const result = buildAssessmentDiagnosis(inputWithListeningCorrect(3), {}, metadata);
		expect(result.skillProfile.diagnosisQuality).toBe('limited');
		expect(result.skillProfile.skillBands.writing).toBe('insufficient_evidence');
		expect(result.skillProfile.skillBands.speaking).toBe('insufficient_evidence');
		expect(result.diagnosisMetadata.fallbackReason).toBe('workers_ai_unavailable');
	});

	it('never converts a learner-typed transcript into speaking evidence', () => {
		const result = buildAssessmentDiagnosis(
			inputWithListeningCorrect(3),
			{
				speaking: {
					score: 3,
					signals: [],
					feedback: 'The typed response was clear.'
				}
			},
			metadata
		);

		expect(result.skillProfile.skillBands.speaking).toBe('insufficient_evidence');
		expect(result.skillProfile.evidenceCounts.speaking).toBe(0);
		expect(result.skillProfile.areaFeedback.speaking).toContain('recording-derived transcript');
	});

	it('rejects AI Error Signals that the reviewed productive item cannot evidence', () => {
		const writing = generalAssessmentItems.find((item) => item.area === 'writing')!;
		expect(() =>
			validateProductiveRubric(writing, {
				score: 1,
				signals: ['main_idea'],
				feedback: 'The response needs a clearer main idea.'
			})
		).toThrow(/unevidenced Error Signal/);
	});

	it.each(['accuplacer_esl', 'cambridge_cept'] as const)(
		'uses five objective responses per area and retains all four %s areas in the plan',
		(profile) => {
			const result = buildAssessmentDiagnosis(correctProfileInput(profile), {}, metadata);

			expect(result.skillProfile.diagnosisQuality).toBe('full');
			expect(result.skillProfile.assessedAreas).toEqual([
				'listening',
				'reading',
				'grammar_usage',
				'vocabulary'
			]);
			for (const area of ['listening', 'reading', 'grammar_usage', 'vocabulary'] as const) {
				expect(result.skillProfile.evidenceCounts[area]).toBe(5);
				expect(result.skillProfile.upperTierEvidenceCounts?.[area]).toBe(2);
				expect(result.skillProfile.upperTierCorrectCounts?.[area]).toBe(2);
				expect(result.skillProfile.skillBands[area]).toBe('strong');
			}
			expect(result.skillProfile.evidenceCounts.writing).toBe(0);
			expect(result.skillProfile.evidenceCounts.speaking).toBe(0);
			expect(result.skillProfile.priorityWeaknesses).toEqual([]);
			expect(result.studyPlan.targets).toEqual([
				{
					area: 'listening',
					signal: 'detail',
					priority: 1,
					basis: 'maintenance',
					reason: expect.any(String)
				},
				{
					area: 'reading',
					signal: 'main_idea',
					priority: 2,
					basis: 'maintenance',
					reason: expect.any(String)
				},
				{
					area: 'grammar_usage',
					signal: 'verb_form',
					priority: 3,
					basis: 'maintenance',
					reason: expect.any(String)
				},
				{
					area: 'vocabulary',
					signal: 'vocabulary_in_context',
					priority: 4,
					basis: 'maintenance',
					reason: expect.any(String)
				}
			]);
		}
	);

	it('retains all six assessed areas in a complete general plan', () => {
		const result = buildAssessmentDiagnosis(
			perfectGeneralInput(),
			perfectProductiveRubrics,
			metadata
		);

		expect(result.skillProfile.diagnosisQuality).toBe('full');
		expect(result.skillProfile.assessedAreas).toEqual([
			'listening',
			'reading',
			'grammar_usage',
			'vocabulary',
			'writing',
			'speaking'
		]);
		expect(result.studyPlan.targets).toHaveLength(6);
		expect(result.studyPlan.targets).toEqual(
			Object.entries(expectedMaintenanceSignals).map(([area, signal], index) => ({
				area,
				signal,
				priority: index + 1,
				basis: 'maintenance',
				reason: expect.any(String)
			}))
		);
	});

	it('combines one observed weakness per area with maintenance for every other assessed area', () => {
		const input = perfectGeneralInput();
		const weakAreas = ['listening', 'reading', 'grammar_usage'] as const;
		const expectedWeakSignals = new Map<string, string>();

		for (const area of weakAreas) {
			const item = generalAssessmentItems.find(
				(candidate) => candidate.area === area && candidate.choices?.length
			)!;
			const response = input.responses.find((candidate) => candidate.itemId === item.id) as Extract<
				AttemptResponse,
				{ kind: 'objective' }
			>;
			response.answer = item.choices!.find((choice) => !item.answerKey!.includes(choice.id))!.id;
			expectedWeakSignals.set(area, item.primaryScoredSignal!);
		}

		const result = buildAssessmentDiagnosis(input, perfectProductiveRubrics, metadata);
		const targetsByArea = new Map(result.studyPlan.targets.map((target) => [target.area, target]));

		expect(result.skillProfile.priorityWeaknesses).toHaveLength(3);
		expect(new Set(result.skillProfile.priorityWeaknesses.map(({ area }) => area))).toEqual(
			new Set(weakAreas)
		);
		expect(result.studyPlan.targets).toHaveLength(6);
		expect(targetsByArea.size).toBe(6);
		expect(result.studyPlan.targets.map(({ priority }) => priority)).toEqual([1, 2, 3, 4, 5, 6]);
		for (const area of weakAreas) {
			expect(targetsByArea.get(area)).toMatchObject({
				area,
				signal: expectedWeakSignals.get(area),
				basis: 'observed_weakness'
			});
		}
		for (const area of ['vocabulary', 'writing', 'speaking'] as const) {
			expect(targetsByArea.get(area)).toMatchObject({
				area,
				signal: expectedMaintenanceSignals[area],
				basis: 'maintenance'
			});
		}
	});

	it('continues to accept stored three-target study plans', () => {
		const storedPlan = {
			targets: [
				{ area: 'grammar_usage', signal: 'verb_form', priority: 1 },
				{ area: 'vocabulary', signal: 'collocation', priority: 2 },
				{ area: 'reading', signal: 'main_idea', priority: 3 }
			],
			targetSignals: ['verb_form', 'collocation', 'main_idea'],
			reassessAfterPracticeCount: 20
		};

		expect(validateStudyPlan(storedPlan)).toEqual(storedPlan);
	});

	it('requires both upper-tier responses before assigning a strong objective band', () => {
		const input = correctProfileInput('accuplacer_esl');
		const challenge = getAssessmentItemsForProfile('accuplacer_esl').find(
			(item) => item.area === 'listening' && item.difficulty === 'challenge'
		)!;
		const response = input.responses.find(
			(candidate) => candidate.itemId === challenge.id
		) as Extract<AttemptResponse, { kind: 'objective' }>;
		response.answer = challenge.choices!.find(
			(choice) => !challenge.answerKey!.includes(choice.id)
		)!.id;

		const result = buildAssessmentDiagnosis(input, {}, metadata);

		expect(result.skillProfile.evidenceCounts.listening).toBe(5);
		expect(result.skillProfile.upperTierCorrectCounts?.listening).toBe(1);
		expect(result.skillProfile.skillBands.listening).toBe('functional');
	});

	it('normalizes a CEPT open gap and shows typed correction text when it is wrong', () => {
		const correctInput = correctProfileInput('cambridge_cept');
		const correctGap = correctInput.responses.find(
			(response) => response.itemId === 'cept-open-gap-intended-for'
		) as Extract<AttemptResponse, { kind: 'objective' }>;
		correctGap.answer = '  FOR  ';

		const correctResult = buildAssessmentDiagnosis(correctInput, {}, metadata);
		expect(
			correctResult.skillProfile.missedAnswerExamples.find(
				(example) => example.itemId === 'cept-open-gap-intended-for'
			)
		).toBeUndefined();

		const wrongInput = correctProfileInput('cambridge_cept');
		const wrongGap = wrongInput.responses.find(
			(response) => response.itemId === 'cept-open-gap-intended-for'
		) as Extract<AttemptResponse, { kind: 'objective' }>;
		wrongGap.answer = 'toward';
		const wrongResult = buildAssessmentDiagnosis(wrongInput, {}, metadata);
		const correction = wrongResult.skillProfile.missedAnswerExamples.find(
			(example) => example.itemId === 'cept-open-gap-intended-for'
		);

		expect(correction?.learnerAnswer).toBe('toward');
		expect(correction?.expectedAnswer).toBe('for');
	});

	it('uses selected productive areas as maintenance targets when no weakness was observed', () => {
		const writing = generalAssessmentItems.find((item) => item.area === 'writing')!;
		const speaking = generalAssessmentItems.find((item) => item.area === 'speaking')!;
		const result = buildAssessmentDiagnosis(
			{
				placementTest: {
					kind: 'school_specific',
					institution: 'Example College',
					targetOutcome: '',
					knownSections: 'Writing and speaking'
				},
				selectedItems: [writing, speaking].map(({ id, version, area }) => ({ id, version, area })),
				responses: [
					{
						area: 'writing',
						itemId: writing.id,
						itemVersion: writing.version,
						kind: 'writing_text',
						answer: 'A complete, organized writing response.'
					},
					{
						area: 'speaking',
						itemId: speaking.id,
						itemVersion: speaking.version,
						kind: 'speaking_metadata',
						metadata: {
							representedBy: 'temporary_metadata',
							responseSeconds: 30,
							transcript: 'A complete, clear spoken response.',
							transcriptSource: 'workers_ai_asr'
						}
					}
				]
			},
			{
				writing: { score: 3, signals: [], feedback: 'The response met the writing target.' },
				speaking: { score: 3, signals: [], feedback: 'The response met the speaking target.' }
			},
			metadata
		);

		expect(result.skillProfile.priorityWeaknesses).toEqual([]);
		expect(result.studyPlan.targets).toMatchObject([
			{ area: 'writing', signal: 'sentence_control', basis: 'maintenance' },
			{ area: 'speaking', signal: 'clarity', basis: 'maintenance' }
		]);
	});
});
