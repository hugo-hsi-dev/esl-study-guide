import { z } from 'zod';
import {
	getAssessmentItemVersion,
	type AssessmentArea,
	type AssessmentItem,
	type ErrorSignal
} from './assessment-items';
import type { AttemptResponse, AttemptSelectedItem, PlacementTestProfile } from './db/schema';
import { getWorkersAiRuntime, runWorkersAiJson, type WorkersAiRuntime } from './workers-ai';

const assessmentAreas = [
	'listening',
	'reading',
	'grammar_usage',
	'vocabulary',
	'writing',
	'speaking'
] as const satisfies readonly AssessmentArea[];
const objectiveAreas = [
	'listening',
	'reading',
	'grammar_usage',
	'vocabulary'
] as const satisfies readonly AssessmentArea[];
const productiveAreas = ['writing', 'speaking'] as const;
const errorSignals = [
	'main_idea',
	'detail',
	'inference',
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

const areaSchema = z.enum(assessmentAreas);
const signalSchema = z.enum(errorSignals);
const skillBandSchema = z.enum([
	'insufficient_evidence',
	'emerging',
	'developing',
	'functional',
	'strong'
]);
const scoredRubricSchema = z
	.object({
		score: z.number().int().min(0).max(3),
		signals: z.array(signalSchema).max(5),
		feedback: z.string().trim().min(1).max(500)
	})
	.strict();
const insufficientRubricSchema = z.object({
	score: z.null(),
	signals: z.tuple([]),
	feedback: z.string().trim().min(1).max(500)
});
const rubricOutputSchema = z.union([scoredRubricSchema, insufficientRubricSchema]);
const areaBandSchema = z.object({
	listening: skillBandSchema,
	reading: skillBandSchema,
	grammar_usage: skillBandSchema,
	vocabulary: skillBandSchema,
	writing: skillBandSchema,
	speaking: skillBandSchema
});
const areaEvidenceSchema = z.object({
	listening: z.number().int().min(0).max(5),
	reading: z.number().int().min(0).max(5),
	grammar_usage: z.number().int().min(0).max(5),
	vocabulary: z.number().int().min(0).max(5),
	writing: z.number().int().min(0).max(1),
	speaking: z.number().int().min(0).max(1)
});
const upperTierEvidenceSchema = z.object({
	listening: z.number().int().min(0).max(2),
	reading: z.number().int().min(0).max(2),
	grammar_usage: z.number().int().min(0).max(2),
	vocabulary: z.number().int().min(0).max(2)
});
const areaFeedbackSchema = z.object({
	listening: z.string().trim().min(1).max(500),
	reading: z.string().trim().min(1).max(500),
	grammar_usage: z.string().trim().min(1).max(500),
	vocabulary: z.string().trim().min(1).max(500),
	writing: z.string().trim().min(1).max(500),
	speaking: z.string().trim().min(1).max(500)
});
const skillProfileSchema = z.object({
	skillBands: areaBandSchema,
	evidenceCounts: areaEvidenceSchema,
	upperTierEvidenceCounts: upperTierEvidenceSchema.optional(),
	upperTierCorrectCounts: upperTierEvidenceSchema.optional(),
	assessedAreas: z.array(areaSchema).min(1).max(6).optional(),
	areaFeedback: areaFeedbackSchema,
	diagnosisQuality: z.enum(['full', 'limited']),
	priorityWeaknesses: z
		.array(
			z.object({
				area: areaSchema,
				signal: signalSchema,
				reason: z.string().trim().min(1).max(300)
			})
		)
		.max(3),
	missedAnswerExamples: z.array(
		z.object({
			area: areaSchema,
			itemId: z.string().trim().min(1),
			itemVersion: z.number().int().min(1).optional(),
			stimulus: z.string().trim().min(1).max(900).optional(),
			learnerQuestion: z.string().trim().min(1).max(900).optional(),
			learnerAnswer: z.string().trim().min(1),
			expectedAnswer: z.string().trim().min(1),
			explanation: z.string().trim().min(1),
			errorSignals: z.array(signalSchema).min(1),
			audioUrl: z.string().trim().startsWith('/assessment/audio/').optional(),
			audioTranscript: z.string().trim().min(1).max(2000).optional()
		})
	),
	rubricOutputs: z.object({
		writing: rubricOutputSchema,
		speaking: rubricOutputSchema,
		pronunciation: insufficientRubricSchema
	})
});
const studyPlanSchema = z.object({
	targets: z
		.array(
			z.object({
				area: areaSchema,
				signal: signalSchema,
				priority: z.number().int().min(1).max(6),
				basis: z.enum(['observed_weakness', 'maintenance']).optional(),
				reason: z.string().trim().min(1).max(300).optional()
			})
		)
		.max(6),
	targetSignals: z.array(signalSchema).max(6),
	reassessAfterPracticeCount: z.literal(20)
});
const diagnosisMetadataSchema = z.object({
	provider: z.enum(['local', 'workers-ai']),
	modelId: z.string().trim().min(1),
	promptVersion: z.literal('assessment-diagnosis-v2'),
	schemaVersion: z.literal(2),
	generatedAt: z.string().refine((value) => Number.isFinite(Date.parse(value))),
	fallbackReason: z.string().trim().min(1).max(300).optional()
});

export type SkillBand = z.infer<typeof skillBandSchema>;
export type ProductiveRubric = z.infer<typeof scoredRubricSchema>;
export type SkillProfile = z.infer<typeof skillProfileSchema>;
export type StudyPlan = z.infer<typeof studyPlanSchema>;
export type DiagnosisMetadata = z.infer<typeof diagnosisMetadataSchema>;
export type DiagnosisInput = {
	selectedItems: AttemptSelectedItem[];
	responses: AttemptResponse[];
	placementTest?: PlacementTestProfile;
};

const areasNamedBySections = (knownSections: string) => {
	const normalized = knownSections.toLocaleLowerCase('en-US');
	const named = new Set<AssessmentArea>();
	if (/listen|audio/.test(normalized)) named.add('listening');
	if (/read/.test(normalized)) named.add('reading');
	if (/language use|use of english|grammar|structure/.test(normalized)) {
		named.add('grammar_usage');
	}
	if (/language knowledge/.test(normalized)) {
		named.add('grammar_usage');
		named.add('vocabulary');
	}
	if (/sentence meaning|vocab|word meaning/.test(normalized)) named.add('vocabulary');
	if (/writ|essay|writeplacer/.test(normalized)) named.add('writing');
	if (/speak|oral|interview/.test(normalized)) named.add('speaking');
	return named;
};

export function placementProfileAreas(profile?: PlacementTestProfile): Set<AssessmentArea> {
	if (!profile || profile.kind === 'not_sure') {
		const named = areasNamedBySections(profile?.knownSections ?? '');
		return named.size ? named : new Set(assessmentAreas);
	}
	const named = areasNamedBySections(profile.knownSections ?? '');
	if (profile.kind === 'cambridge_cept') {
		const supported = new Set<AssessmentArea>(objectiveAreas);
		if (!named.size) return supported;
		const selected = new Set<AssessmentArea>();
		if (named.has('listening')) selected.add('listening');
		if (named.has('reading') || named.has('grammar_usage') || named.has('vocabulary')) {
			selected.add('reading');
			selected.add('grammar_usage');
			selected.add('vocabulary');
		}
		return selected.size ? selected : supported;
	}
	if (profile.kind === 'accuplacer_esl') {
		const supported = new Set<AssessmentArea>(objectiveAreas);
		if (/writ|essay|writeplacer/i.test(`${profile.targetOutcome} ${profile.knownSections ?? ''}`)) {
			supported.add('writing');
		}
		if (!named.size) return supported;
		const selected = new Set([...named].filter((area) => supported.has(area)));
		if (supported.has('writing')) selected.add('writing');
		return selected.size ? selected : supported;
	}
	return named.size ? named : new Set(assessmentAreas);
}

const signalLabel: Record<ErrorSignal, string> = {
	main_idea: 'main ideas',
	detail: 'details',
	inference: 'supported inferences',
	vocabulary_in_context: 'vocabulary in context',
	verb_form: 'verb forms',
	subject_verb_agreement: 'subject-verb agreement',
	article_determiner: 'articles',
	plural_countability: 'plural nouns',
	preposition: 'prepositions',
	pronoun_choice: 'pronouns',
	sentence_control: 'sentence control',
	collocation: 'collocations',
	task_completion: 'task completion',
	clarity: 'clarity',
	fluency: 'fluency'
};

const maintenanceSignalByArea = {
	listening: 'detail',
	reading: 'main_idea',
	grammar_usage: 'verb_form',
	vocabulary: 'vocabulary_in_context',
	writing: 'sentence_control',
	speaking: 'clarity'
} as const satisfies Record<AssessmentArea, ErrorSignal>;

export const bandFromObjectiveScore = (score: number): SkillBand =>
	score >= 2 ? 'functional' : score >= 1 ? 'developing' : 'emerging';

export const bandFromObjectiveEvidence = (evidence: {
	correct: number;
	total: number;
	upperTierCorrect: number;
	upperTierTotal: number;
}): SkillBand => {
	if (
		evidence.total >= 5 &&
		evidence.correct >= 4 &&
		evidence.upperTierTotal >= 2 &&
		evidence.upperTierCorrect === evidence.upperTierTotal
	) {
		return 'strong';
	}
	if (evidence.total > 0 && evidence.correct / evidence.total >= 2 / 3) return 'functional';
	return evidence.correct >= 1 ? 'developing' : 'emerging';
};

const initialBands = (): Record<AssessmentArea, SkillBand> => ({
	listening: 'insufficient_evidence',
	reading: 'insufficient_evidence',
	grammar_usage: 'insufficient_evidence',
	vocabulary: 'insufficient_evidence',
	writing: 'insufficient_evidence',
	speaking: 'insufficient_evidence'
});

const initialEvidence = (): Record<AssessmentArea, number> => ({
	listening: 0,
	reading: 0,
	grammar_usage: 0,
	vocabulary: 0,
	writing: 0,
	speaking: 0
});

const initialObjectiveEvidence = (): Record<(typeof objectiveAreas)[number], number> => ({
	listening: 0,
	reading: 0,
	grammar_usage: 0,
	vocabulary: 0
});

const initialFeedback = (): Record<AssessmentArea, string> => ({
	listening: 'Not enough reviewed responses were available.',
	reading: 'Not enough reviewed responses were available.',
	grammar_usage: 'Not enough reviewed responses were available.',
	vocabulary: 'Not enough reviewed responses were available.',
	writing: 'AI rubric feedback was unavailable, so this area was not scored.',
	speaking:
		'A recording-derived transcript was unavailable, so typed text was not scored as speaking.'
});

const addSignals = (
	counts: Map<AssessmentArea, Map<ErrorSignal, number>>,
	area: AssessmentArea,
	signals: readonly ErrorSignal[]
) => {
	const areaCounts = counts.get(area) ?? new Map<ErrorSignal, number>();
	for (const signal of signals) {
		areaCounts.set(signal, (areaCounts.get(signal) ?? 0) + 1);
	}
	counts.set(area, areaCounts);
};

const choiceText = (item: AssessmentItem, choiceId: string) =>
	item.choices?.find((choice) => choice.id === choiceId)?.text;

export const normalizeObjectiveAnswer = (answer: string) =>
	answer.trim().replaceAll(/\s+/g, ' ').toLocaleLowerCase('en-US');

const selectedKey = ({ id, version }: Pick<AttemptSelectedItem, 'id' | 'version'>) =>
	`${id}:${version}`;

export function validateProductiveRubric(
	item: AssessmentItem,
	rubric: ProductiveRubric
): ProductiveRubric {
	const parsed = scoredRubricSchema.parse(rubric);
	const allowedSignals = new Set<ErrorSignal>(
		item.errorSignalTags.filter((signal) => signal !== 'fluency')
	);
	if (parsed.signals.some((signal) => !allowedSignals.has(signal))) {
		throw new Error(`Rubric returned an unevidenced Error Signal for ${item.id}.`);
	}
	return parsed;
}

export function buildAssessmentDiagnosis(
	input: DiagnosisInput,
	productiveRubrics: Partial<Record<(typeof productiveAreas)[number], ProductiveRubric>>,
	diagnosisMetadata: DiagnosisMetadata
) {
	const skillBands = initialBands();
	const evidenceCounts = initialEvidence();
	const expectedEvidenceCounts = initialEvidence();
	const upperTierEvidenceCounts = initialObjectiveEvidence();
	const upperTierCorrectCounts = initialObjectiveEvidence();
	const areaFeedback = initialFeedback();
	const signalCounts = new Map<AssessmentArea, Map<ErrorSignal, number>>();
	const missedAnswerExamples: SkillProfile['missedAnswerExamples'] = [];
	const selected = new Map(input.selectedItems.map((item) => [selectedKey(item), item]));
	const responses = new Map(
		input.responses.map((response) => [
			selectedKey({ id: response.itemId, version: response.itemVersion }),
			response
		])
	);
	for (const selectedItem of input.selectedItems) {
		const item = getAssessmentItemVersion(selectedItem.id, selectedItem.version);
		if (!item || item.area !== selectedItem.area) continue;
		if (objectiveAreas.includes(item.area as (typeof objectiveAreas)[number]) && item.answerKey) {
			expectedEvidenceCounts[item.area] += 1;
		} else if (productiveAreas.includes(item.area as (typeof productiveAreas)[number])) {
			expectedEvidenceCounts[item.area] += 1;
		}
	}

	for (const selectedItem of input.selectedItems) {
		const item = getAssessmentItemVersion(selectedItem.id, selectedItem.version);
		const response = responses.get(selectedKey(selectedItem));
		if (!item || item.area !== selectedItem.area || !response || response.area !== item.area)
			continue;
		if (!objectiveAreas.includes(item.area as (typeof objectiveAreas)[number])) continue;
		if (response.kind !== 'objective' || !item.answerKey || !item.primaryScoredSignal) continue;

		const area = item.area as (typeof objectiveAreas)[number];
		const upperTier = item.difficulty === 'intermediate' || item.difficulty === 'challenge';
		const correct = item.answerKey.some(
			(answer) => normalizeObjectiveAnswer(answer) === normalizeObjectiveAnswer(response.answer)
		);
		evidenceCounts[area] += 1;
		if (upperTier) upperTierEvidenceCounts[area] += 1;
		if (correct) {
			if (upperTier) upperTierCorrectCounts[area] += 1;
			continue;
		}

		addSignals(signalCounts, area, [item.primaryScoredSignal]);
		missedAnswerExamples.push({
			area,
			itemId: item.id,
			itemVersion: item.version,
			stimulus: item.prompt,
			learnerQuestion: item.learnerTask.instructions,
			learnerAnswer: choiceText(item, response.answer) ?? response.answer,
			expectedAnswer:
				item.answerKey
					.map((answer) => choiceText(item, answer))
					.filter(Boolean)
					.join(', ') || item.answerKey.join(', '),
			explanation: item.explanation,
			errorSignals: [item.primaryScoredSignal],
			...(item.serverOnlyAudioScript
				? {
						audioUrl: `/assessment/audio/${encodeURIComponent(item.id)}?version=${item.version}`,
						audioTranscript: item.serverOnlyAudioScript
					}
				: {})
		});
	}

	for (const area of objectiveAreas) {
		const misses = missedAnswerExamples.filter((example) => example.area === area).length;
		const correct = evidenceCounts[area] - misses;
		if (evidenceCounts[area] > 0) {
			skillBands[area] = bandFromObjectiveEvidence({
				correct,
				total: evidenceCounts[area],
				upperTierCorrect: upperTierCorrectCounts[area],
				upperTierTotal: upperTierEvidenceCounts[area]
			});
		}
		if (expectedEvidenceCounts[area] === 0) {
			areaFeedback[area] = 'This area was not part of the selected readiness baseline.';
		} else if (upperTierEvidenceCounts[area] >= 2) {
			areaFeedback[area] =
				`${correct} of ${evidenceCounts[area]} responses were correct, including ${upperTierCorrectCounts[area]} of ${upperTierEvidenceCounts[area]} intermediate or challenge responses. This remains an internal routing band, not an official test score.`;
		} else {
			areaFeedback[area] =
				`${correct} of ${evidenceCounts[area]} introductory responses were correct.${
					correct === evidenceCounts[area]
						? ' This short set does not contain enough higher-level items to show advanced readiness.'
						: ''
				}`;
		}
	}

	const rubricOutputs: SkillProfile['rubricOutputs'] = {
		writing: {
			score: null,
			signals: [],
			feedback: areaFeedback.writing
		},
		speaking: {
			score: null,
			signals: [],
			feedback: areaFeedback.speaking
		},
		pronunciation: {
			score: null,
			signals: [],
			feedback:
				'Pronunciation scoring is deferred; speaking feedback uses transcript-level surface analysis.'
		}
	};

	for (const area of productiveAreas) {
		const rubric = productiveRubrics[area];
		const selectedItem = input.selectedItems.find((item) => item.area === area);
		const item = selectedItem
			? getAssessmentItemVersion(selectedItem.id, selectedItem.version)
			: undefined;
		const response = selectedItem ? responses.get(selectedKey(selectedItem)) : undefined;
		const hasDefensibleEvidence =
			area === 'writing'
				? response?.kind === 'writing_text'
				: response?.kind === 'speaking_metadata' &&
					response.metadata.transcriptSource === 'workers_ai_asr';
		if (!rubric || !item || !selected.has(selectedKey(selectedItem!)) || !hasDefensibleEvidence)
			continue;

		const validated = validateProductiveRubric(item, rubric);
		evidenceCounts[area] = 1;
		skillBands[area] = bandFromObjectiveScore(validated.score);
		areaFeedback[area] = validated.feedback;
		rubricOutputs[area] = validated;
		addSignals(signalCounts, area, validated.signals);
	}

	const profileAreas = placementProfileAreas(input.placementTest);
	const assessedAreas = assessmentAreas.filter((area) => expectedEvidenceCounts[area] > 0);
	const selectedAreaSet = new Set(assessedAreas);
	const priorityWeaknesses = [...signalCounts.entries()]
		.flatMap(([area, counts]) =>
			[...counts.entries()].map(([signal, count]) => ({ area, signal, count }))
		)
		.filter((weakness) => profileAreas.has(weakness.area) && selectedAreaSet.has(weakness.area))
		.sort(
			(left, right) =>
				right.count - left.count ||
				errorSignals.indexOf(left.signal) - errorSignals.indexOf(right.signal) ||
				assessmentAreas.indexOf(left.area) - assessmentAreas.indexOf(right.area)
		)
		.filter(
			(weakness, index, weaknesses) =>
				weaknesses.findIndex((candidate) => candidate.area === weakness.area) === index
		)
		.slice(0, 3);
	const documentedWeaknesses = priorityWeaknesses.map(({ area, signal }) => ({
		area,
		signal,
		reason: `Assessment evidence showed a need to practice ${signalLabel[signal]}.`
	}));
	const weaknessTargets = documentedWeaknesses.map(({ area, signal, reason }) => ({
		area,
		signal,
		basis: 'observed_weakness' as const,
		reason
	}));
	const weaknessAreas = new Set(weaknessTargets.map((target) => target.area));
	const maintenanceTargets = assessmentAreas
		.filter(
			(area) => profileAreas.has(area) && selectedAreaSet.has(area) && !weaknessAreas.has(area)
		)
		.map((area) => {
			const signal = maintenanceSignalByArea[area];
			return {
				area,
				signal,
				basis: 'maintenance' as const,
				reason: `Maintain ${signalLabel[signal]} coverage with new ${area.replaceAll('_', ' ')} examples.`
			};
		});
	const targets = [...weaknessTargets, ...maintenanceTargets]
		.slice(0, 6)
		.map((target, index) => ({ ...target, priority: index + 1 }));
	const diagnosisQuality = assessedAreas.every(
		(area) => evidenceCounts[area] === expectedEvidenceCounts[area]
	)
		? 'full'
		: 'limited';

	return {
		skillProfile: skillProfileSchema.parse({
			skillBands,
			evidenceCounts,
			upperTierEvidenceCounts,
			upperTierCorrectCounts,
			assessedAreas,
			areaFeedback,
			diagnosisQuality,
			priorityWeaknesses: documentedWeaknesses,
			missedAnswerExamples,
			rubricOutputs
		}),
		studyPlan: studyPlanSchema.parse({
			targets,
			targetSignals: targets.map((target) => target.signal),
			reassessAfterPracticeCount: 20
		}),
		diagnosisMetadata: diagnosisMetadataSchema.parse(diagnosisMetadata)
	};
}

const productiveResponse = (input: DiagnosisInput, area: (typeof productiveAreas)[number]) => {
	const selectedItem = input.selectedItems.find((item) => item.area === area);
	if (!selectedItem) return;
	const response = input.responses.find(
		(candidate) =>
			candidate.itemId === selectedItem.id && candidate.itemVersion === selectedItem.version
	);
	const item = getAssessmentItemVersion(selectedItem.id, selectedItem.version);
	if (!item || !response) return;
	if (area === 'writing' && response.kind === 'writing_text') {
		return { item, response: response.answer };
	}
	if (
		area === 'speaking' &&
		response.kind === 'speaking_metadata' &&
		response.metadata.transcript &&
		response.metadata.transcriptSource === 'workers_ai_asr'
	) {
		return { item, response: response.metadata.transcript };
	}
};

const rubricProductiveResponse = async (
	runtime: WorkersAiRuntime,
	area: (typeof productiveAreas)[number],
	item: AssessmentItem,
	response: string
) => {
	const allowedSignals = item.errorSignalTags.filter((signal) => signal !== 'fluency');
	const rubric = await runWorkersAiJson(
		runtime,
		[
			{
				role: 'system',
				content:
					'Return only the requested JSON rubric. Evaluate only the supplied writing text or speaking transcript. Do not grade objective items, infer pronunciation, infer pauses, or invent errors.'
			},
			{
				role: 'user',
				content: JSON.stringify({
					area,
					prompt: item.prompt,
					rubric: item.rubric?.filter(
						(criterion) => area !== 'speaking' || !criterion.startsWith('fluency:')
					),
					response,
					allowedErrorSignals: allowedSignals,
					requiredShape: {
						score: 'integer 0 through 3',
						signals: 'only observed weaknesses from allowedErrorSignals',
						feedback: 'plain-language evidence-based feedback, at most 500 characters'
					}
				})
			}
		],
		scoredRubricSchema
	);
	return validateProductiveRubric(item, rubric);
};

export async function diagnoseAssessmentAttempt(input: DiagnosisInput) {
	const runtime = getWorkersAiRuntime();
	const productiveRubrics: Partial<Record<(typeof productiveAreas)[number], ProductiveRubric>> = {};
	const fallbackReasons: string[] = [];

	if (!runtime) {
		fallbackReasons.push('workers_ai_unavailable');
	} else {
		for (const area of productiveAreas) {
			if (!input.selectedItems.some((item) => item.area === area)) continue;
			const evidence = productiveResponse(input, area);
			if (!evidence) {
				fallbackReasons.push(`${area}_evidence_unavailable`);
				continue;
			}
			try {
				productiveRubrics[area] = await rubricProductiveResponse(
					runtime,
					area,
					evidence.item,
					evidence.response
				);
			} catch {
				fallbackReasons.push(`${area}_rubric_unavailable`);
			}
		}
	}

	return buildAssessmentDiagnosis(input, productiveRubrics, {
		provider: runtime?.provider ?? 'local',
		modelId: runtime?.textModelId ?? 'deterministic-objective-scoring',
		promptVersion: 'assessment-diagnosis-v2',
		schemaVersion: 2,
		generatedAt: new Date().toISOString(),
		...(fallbackReasons.length > 0 ? { fallbackReason: fallbackReasons.join(',') } : {})
	});
}

export const validateSkillProfile = (value: unknown) => skillProfileSchema.parse(value);
export const validateStudyPlan = (value: unknown) => studyPlanSchema.parse(value);
export const validateDiagnosisMetadata = (value: unknown) => diagnosisMetadataSchema.parse(value);
