import { z } from 'zod';
import {
	getAssessmentItemVersion,
	getAssessmentResponseSignals,
	type AssessmentArea,
	type AssessmentItem,
	type ErrorSignal
} from './assessment-items';
import type { AttemptResponse, AttemptSelectedItem } from './db/schema';

const assessmentAreas = [
	'listening',
	'reading',
	'grammar_usage',
	'vocabulary',
	'writing',
	'speaking'
] as const satisfies readonly AssessmentArea[];
const objectiveAreas = ['listening', 'reading', 'grammar_usage', 'vocabulary'] as const;
type ProductiveArea = 'writing' | 'speaking';
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
		writing: insufficientRubricSchema,
		speaking: insufficientRubricSchema,
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
	listening: 'No reviewed listening responses were available.',
	reading: 'No reviewed reading responses were available.',
	grammar_usage: 'No reviewed grammar responses were available.',
	vocabulary: 'No reviewed vocabulary responses were available.',
	writing: 'No writing sample was available.',
	speaking: 'No speaking attempt was available.'
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

// This remains available for callers that need to validate an independently reviewed rubric.
// The first check deliberately does not apply a rubric to one writing or speaking sample.
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
	_productiveRubrics: Partial<Record<ProductiveArea, ProductiveRubric>>,
	diagnosisMetadata: DiagnosisMetadata
) {
	const skillBands = initialBands();
	const evidenceCounts = initialEvidence();
	const areaFeedback = initialFeedback();
	const signalCounts = new Map<ErrorSignal, number>();
	const signalAreas = new Map<ErrorSignal, AssessmentArea>();
	const missedAnswerExamples: SkillProfile['missedAnswerExamples'] = [];
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

		if (objectiveAreas.includes(item.area as (typeof objectiveAreas)[number])) {
			if (response.kind !== 'objective' || !item.answerKey) continue;
			evidenceCounts[item.area] += 1;
			if (item.answerKey.includes(response.answer)) continue;

			const signals = getAssessmentResponseSignals(item.id, item.version, response.answer);
			addSignals(signalCounts, signalAreas, item.area, signals);
			if (signals.length) {
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
					errorSignals: signals
				});
			}
			continue;
		}

		if (item.area === 'writing' && response.kind === 'writing_text') {
			evidenceCounts.writing = 1;
			areaFeedback.writing =
				'One writing sample is saved. It is not enough to identify grammar patterns or assign a writing level.';
			continue;
		}

		if (item.area === 'speaking' && response.kind === 'speaking_metadata') {
			evidenceCounts.speaking = 1;
			areaFeedback.speaking = response.metadata.transcript
				? 'One speaking transcript is saved. It is not enough to assign a fluency, pronunciation, or speaking level.'
				: 'One speaking attempt is logged. Audio is not stored, and this first check does not score fluency or pronunciation.';
		}
	}

	for (const area of objectiveAreas) {
		const misses = missedAnswerExamples.filter((example) => example.area === area).length;
		const correct = evidenceCounts[area] - misses;
		if (evidenceCounts[area] >= 3) {
			skillBands[area] = bandFromObjectiveScore(correct);
			areaFeedback[area] =
				`${correct} of ${evidenceCounts[area]} reviewed responses were correct. This is a short practice snapshot, not a placement level.`;
		} else if (evidenceCounts[area] > 0) {
			areaFeedback[area] =
				`${correct} of ${evidenceCounts[area]} reviewed responses were correct. More examples are needed before naming a skill level.`;
		}
	}

	const priorityWeaknesses = [...signalCounts.entries()]
		.sort((a, b) => b[1] - a[1] || errorSignals.indexOf(a[0]) - errorSignals.indexOf(b[0]))
		.slice(0, 3)
		.map(([signal]) => ({
			area: signalAreas.get(signal) ?? 'grammar_usage',
			signal,
			reason: `A selected response suggests starting with ${signalLabel[signal]}. More examples will confirm whether it is a stable need.`
		}));
	const targets = priorityWeaknesses.map(({ area, signal }, index) => ({
		area,
		signal,
		priority: index + 1
	}));

	return {
		skillProfile: skillProfileSchema.parse({
			skillBands,
			evidenceCounts,
			areaFeedback,
			// Productive responses are saved but not scored from a single sample, so this
			// remains limited even when all objective tasks are complete.
			diagnosisQuality: 'limited',
			priorityWeaknesses,
			missedAnswerExamples,
			rubricOutputs: {
				writing: {
					score: null,
					signals: [],
					feedback:
						'Your writing sample is saved. One short response is not enough to identify grammar patterns reliably.'
				},
				speaking: {
					score: null,
					signals: [],
					feedback:
						'Speaking is not scored in this first check. More transcript evidence is needed before making a language judgement.'
				},
				pronunciation: {
					score: null,
					signals: [],
					feedback:
						'Pronunciation is not scored in this first check. It needs dedicated speech evaluation.'
				}
			}
		}),
		studyPlan: studyPlanSchema.parse({
			targets,
			targetSignals: targets.map((target) => target.signal),
			reassessAfterPracticeCount: 20
		}),
		diagnosisMetadata: diagnosisMetadataSchema.parse(diagnosisMetadata)
	};
}

export async function diagnoseAssessmentAttempt(input: DiagnosisInput) {
	return buildAssessmentDiagnosis(
		input,
		{},
		{
			provider: 'local',
			modelId: 'evidence-calibrated-diagnosis',
			promptVersion: 'assessment-diagnosis-v2',
			schemaVersion: 2,
			generatedAt: new Date().toISOString(),
			fallbackReason: 'productive_scoring_deferred'
		}
	);
}

export const validateSkillProfile = (value: unknown) => skillProfileSchema.parse(value);
export const validateStudyPlan = (value: unknown) => studyPlanSchema.parse(value);
export const validateDiagnosisMetadata = (value: unknown) => diagnosisMetadataSchema.parse(value);
