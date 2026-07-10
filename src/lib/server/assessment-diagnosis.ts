import { z } from 'zod';
import {
	getAssessmentItemVersion,
	type AssessmentArea,
	type AssessmentItem,
	type ErrorSignal
} from './assessment-items';
import type { AttemptResponse, AttemptSelectedItem } from './db/schema';
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
	listening: z.number().int().min(0).max(3),
	reading: z.number().int().min(0).max(3),
	grammar_usage: z.number().int().min(0).max(3),
	vocabulary: z.number().int().min(0).max(3),
	writing: z.number().int().min(0).max(1),
	speaking: z.number().int().min(0).max(1)
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
			learnerAnswer: z.string().trim().min(1),
			expectedAnswer: z.string().trim().min(1),
			explanation: z.string().trim().min(1),
			errorSignals: z.array(signalSchema).min(1)
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
				priority: z.number().int().min(1).max(3)
			})
		)
		.max(3),
	targetSignals: z.array(signalSchema).max(3),
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
};

const signalLabel: Record<ErrorSignal, string> = {
	main_idea: 'main ideas',
	detail: 'details',
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

export const bandFromObjectiveScore = (score: number): SkillBand =>
	score >= 3 ? 'strong' : score >= 2 ? 'functional' : score >= 1 ? 'developing' : 'emerging';

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

const initialFeedback = (): Record<AssessmentArea, string> => ({
	listening: 'Not enough reviewed responses were available.',
	reading: 'Not enough reviewed responses were available.',
	grammar_usage: 'Not enough reviewed responses were available.',
	vocabulary: 'Not enough reviewed responses were available.',
	writing: 'AI rubric feedback was unavailable, so this area was not scored.',
	speaking: 'AI transcript rubric feedback was unavailable, so this area was not scored.'
});

const addSignals = (
	counts: Map<ErrorSignal, number>,
	areas: Map<ErrorSignal, AssessmentArea>,
	area: AssessmentArea,
	signals: readonly ErrorSignal[]
) => {
	for (const signal of signals) {
		counts.set(signal, (counts.get(signal) ?? 0) + 1);
		if (!areas.has(signal)) areas.set(signal, area);
	}
};

const choiceText = (item: AssessmentItem, choiceId: string) =>
	item.choices?.find((choice) => choice.id === choiceId)?.text;

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
	const areaFeedback = initialFeedback();
	const signalCounts = new Map<ErrorSignal, number>();
	const signalAreas = new Map<ErrorSignal, AssessmentArea>();
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
		const response = responses.get(selectedKey(selectedItem));
		if (!item || item.area !== selectedItem.area || !response || response.area !== item.area)
			continue;
		if (!objectiveAreas.includes(item.area as (typeof objectiveAreas)[number])) continue;
		if (response.kind !== 'objective' || !item.answerKey || !item.primaryScoredSignal) continue;

		evidenceCounts[item.area] += 1;
		if (item.answerKey.includes(response.answer)) continue;

		addSignals(signalCounts, signalAreas, item.area, [item.primaryScoredSignal]);
		missedAnswerExamples.push({
			area: item.area,
			itemId: item.id,
			learnerAnswer: choiceText(item, response.answer) ?? 'Unknown response',
			expectedAnswer:
				item.answerKey
					.map((answer) => choiceText(item, answer))
					.filter(Boolean)
					.join(', ') || 'Expected choice unavailable',
			explanation: item.explanation,
			errorSignals: [item.primaryScoredSignal]
		});
	}

	for (const area of objectiveAreas) {
		const misses = missedAnswerExamples.filter((example) => example.area === area).length;
		const correct = evidenceCounts[area] - misses;
		if (evidenceCounts[area] === 3) skillBands[area] = bandFromObjectiveScore(correct);
		areaFeedback[area] = `${correct} of ${evidenceCounts[area]} reviewed responses were correct.`;
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
		if (!rubric || !item || !selected.has(selectedKey(selectedItem!))) continue;

		const validated = validateProductiveRubric(item, rubric);
		evidenceCounts[area] = 1;
		skillBands[area] = bandFromObjectiveScore(validated.score);
		areaFeedback[area] = validated.feedback;
		rubricOutputs[area] = validated;
		addSignals(signalCounts, signalAreas, area, validated.signals);
	}

	const priorityWeaknesses = [...signalCounts.entries()]
		.sort((a, b) => b[1] - a[1] || errorSignals.indexOf(a[0]) - errorSignals.indexOf(b[0]))
		.slice(0, 3)
		.map(([signal]) => ({
			area: signalAreas.get(signal) ?? 'writing',
			signal,
			reason: `Assessment evidence showed a need to practice ${signalLabel[signal]}.`
		}));
	const targets = priorityWeaknesses.map(({ area, signal }, index) => ({
		area,
		signal,
		priority: index + 1
	}));
	const diagnosisQuality =
		objectiveAreas.every((area) => evidenceCounts[area] === 3) &&
		productiveAreas.every((area) => evidenceCounts[area] === 1)
			? 'full'
			: 'limited';

	return {
		skillProfile: skillProfileSchema.parse({
			skillBands,
			evidenceCounts,
			areaFeedback,
			diagnosisQuality,
			priorityWeaknesses,
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
		response.metadata.transcript
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
