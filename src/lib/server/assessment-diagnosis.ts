import { getSeedAssessmentItems, type AssessmentArea, type ErrorSignal } from './assessment-items';
import type { AttemptResponse, AttemptSelectedItem } from './db/schema';
import { getWorkersAiRuntime, runWorkersAiJson } from './workers-ai';
import { z } from 'zod';

export type SkillBand = 'emerging' | 'developing' | 'functional' | 'strong';

export type SkillProfile = {
	skillBands: Record<AssessmentArea, SkillBand>;
	priorityWeaknesses: { area: AssessmentArea; signal: ErrorSignal; reason: string }[];
	missedAnswerExamples: {
		area: AssessmentArea;
		itemId: string;
		learnerAnswer: string;
		expectedAnswer: string;
		explanation: string;
		errorSignals: ErrorSignal[];
	}[];
	rubricOutputs: {
		writing: { score: number; signals: ErrorSignal[]; feedback: string };
		speaking: { score: number; signals: ErrorSignal[]; feedback: string };
		pronunciation: { score: null; signals: ErrorSignal[]; feedback: string };
	};
};

export type StudyPlan = {
	today: string[];
	thisWeek: string[];
	targetSignals: ErrorSignal[];
};

export type DiagnosisMetadata = {
	schemaVersion: 1;
	provider: 'local' | 'workers-ai';
	model: string;
	modelVersion: '2026-07-08';
	selectedItems: AttemptSelectedItem[];
};

type DiagnosisInput = {
	selectedItems: AttemptSelectedItem[];
	responses: AttemptResponse[];
};

const bandFromScore = (score: number): SkillBand =>
	score >= 3 ? 'strong' : score >= 2 ? 'functional' : score >= 1 ? 'developing' : 'emerging';

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

const assessmentAreas = [
	'listening',
	'reading',
	'grammar_usage',
	'vocabulary',
	'writing',
	'speaking'
] as const satisfies readonly AssessmentArea[];
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
const skillBandSchema = z.enum(['emerging', 'developing', 'functional', 'strong']);
const areaSchema = z.enum(assessmentAreas);
const signalSchema = z.enum(errorSignals);
const rubricSchema = z.object({
	score: z.number().int().min(0).max(3),
	signals: z.array(signalSchema),
	feedback: z.string().trim().min(1).max(500)
});
const skillProfileSchema = z.object({
	skillBands: z.object({
		listening: skillBandSchema,
		reading: skillBandSchema,
		grammar_usage: skillBandSchema,
		vocabulary: skillBandSchema,
		writing: skillBandSchema,
		speaking: skillBandSchema
	}),
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
			learnerAnswer: z.string(),
			expectedAnswer: z.string(),
			explanation: z.string().trim().min(1),
			errorSignals: z.array(signalSchema)
		})
	),
	rubricOutputs: z.object({
		writing: rubricSchema,
		speaking: rubricSchema,
		pronunciation: z.object({
			score: z.null(),
			signals: z.array(signalSchema),
			feedback: z.string().trim().min(1).max(500)
		})
	})
}) satisfies z.ZodType<SkillProfile>;
const studyPlanSchema = z.object({
	today: z.array(z.string().trim().min(1).max(200)).max(5),
	thisWeek: z.array(z.string().trim().min(1).max(200)).max(5),
	targetSignals: z.array(signalSchema).max(5)
}) satisfies z.ZodType<StudyPlan>;
const aiDiagnosisSchema = z.object({
	skillProfile: skillProfileSchema,
	studyPlan: studyPlanSchema
});

const incrementSignals = (
	counts: Map<ErrorSignal, number>,
	areas: Map<ErrorSignal, AssessmentArea>,
	area: AssessmentArea,
	signals: ErrorSignal[]
) => {
	for (const signal of signals) {
		counts.set(signal, (counts.get(signal) ?? 0) + 1);
		if (!areas.has(signal)) areas.set(signal, area);
	}
};

function diagnoseAssessmentAttemptDeterministic({ selectedItems, responses }: DiagnosisInput): {
	skillProfile: SkillProfile;
	studyPlan: StudyPlan;
	diagnosisMetadata: DiagnosisMetadata;
} {
	const items = new Map(getSeedAssessmentItems().map((item) => [item.id, item]));
	const skillBands = {} as Record<AssessmentArea, SkillBand>;
	const signalCounts = new Map<ErrorSignal, number>();
	const signalAreas = new Map<ErrorSignal, AssessmentArea>();
	const missedAnswerExamples: SkillProfile['missedAnswerExamples'] = [];

	let writingScore = 1;
	let writingSignals: ErrorSignal[] = [];
	let speakingScore = 1;
	let speakingSignals: ErrorSignal[] = [];

	for (const response of responses) {
		const item = items.get(response.itemId);
		if (!item) continue;

		if (response.kind === 'objective') {
			const correct = item.answerKey?.includes(response.answer) ?? false;
			skillBands[response.area] = bandFromScore(correct ? 2 : 0);
			if (!correct) {
				incrementSignals(signalCounts, signalAreas, response.area, item.errorSignalTags);
				missedAnswerExamples.push({
					area: response.area,
					itemId: response.itemId,
					learnerAnswer: response.answer,
					expectedAnswer: item.answerKey?.join(', ') ?? 'n/a',
					explanation: item.explanation,
					errorSignals: item.errorSignalTags
				});
			}
			continue;
		}

		if (response.kind === 'writing_text') {
			const sentenceCount = response.answer.split(/[.!?]+/).filter((part) => part.trim()).length;
			writingSignals = sentenceCount >= 4 ? [] : ['task_completion', 'sentence_control'];
			writingScore = sentenceCount >= 4 ? 2 : 0;
			skillBands.writing = bandFromScore(writingScore);
			incrementSignals(signalCounts, signalAreas, 'writing', writingSignals);
			continue;
		}

		speakingSignals = response.metadata.responseSeconds >= 20 ? [] : ['fluency', 'task_completion'];
		speakingScore = response.metadata.responseSeconds >= 20 ? 2 : 0;
		skillBands.speaking = bandFromScore(speakingScore);
		incrementSignals(signalCounts, signalAreas, 'speaking', speakingSignals);
	}

	const priorityWeaknesses = [...signalCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 3)
		.map(([signal]) => ({
			area: signalAreas.get(signal) ?? 'writing',
			signal,
			reason: `Observed ${signalLabel[signal]} during this assessment.`
		}));

	const targetSignals = priorityWeaknesses.map((weakness) => weakness.signal);
	const studyPlan = {
		today: targetSignals.map(
			(signal) => `Practice ${signalLabel[signal]} with short daily-life answers.`
		),
		thisWeek: targetSignals.map(
			(signal) => `Review ${signalLabel[signal]} after 10 practice answers.`
		),
		targetSignals
	};

	return {
		skillProfile: {
			skillBands,
			priorityWeaknesses,
			missedAnswerExamples,
			rubricOutputs: {
				writing: {
					score: writingScore,
					signals: writingSignals,
					feedback:
						writingScore >= 2
							? 'Writing completed the short task.'
							: 'Writing needs a complete 4-5 sentence answer.'
				},
				speaking: {
					score: speakingScore,
					signals: speakingSignals,
					feedback:
						speakingScore >= 2
							? 'Speaking response length supports basic task completion.'
							: 'Speaking response was too short to show enough fluency.'
				},
				pronunciation: {
					score: null,
					signals: [],
					feedback:
						'Pronunciation scoring is deferred; speaking feedback uses transcript-level surface analysis.'
				}
			}
		},
		studyPlan,
		diagnosisMetadata: {
			schemaVersion: 1,
			provider: 'local',
			model: 'deterministic-diagnosis',
			modelVersion: '2026-07-08',
			selectedItems
		}
	};
}

export async function diagnoseAssessmentAttempt(input: DiagnosisInput): Promise<{
	skillProfile: SkillProfile;
	studyPlan: StudyPlan;
	diagnosisMetadata: DiagnosisMetadata;
}> {
	const deterministic = diagnoseAssessmentAttemptDeterministic(input);
	const runtime = getWorkersAiRuntime();
	if (!runtime) return deterministic;

	const result = await runWorkersAiJson(
		runtime,
		[
			{
				role: 'system',
				content:
					'Return only JSON. Diagnose ESL assessment responses into the exact requested shape. Do not score pronunciation.'
			},
			{
				role: 'user',
				content: JSON.stringify({
					requiredShape: {
						skillProfile: 'SkillProfile',
						studyPlan: 'StudyPlan'
					},
					allowedAreas: assessmentAreas,
					allowedSignals: errorSignals,
					allowedSkillBands: ['emerging', 'developing', 'functional', 'strong'],
					notes: [
						'Use objective answer correctness from the baseline.',
						'Use writing text for writing rubric feedback.',
						'Use speaking transcript when present; otherwise use duration metadata only.',
						'Pronunciation score must be null with no pronunciation scoring.'
					],
					input,
					baseline: deterministic
				})
			}
		],
		aiDiagnosisSchema
	);

	return {
		...result,
		diagnosisMetadata: {
			schemaVersion: 1,
			provider: runtime.provider,
			model: runtime.textModelId,
			modelVersion: '2026-07-08',
			selectedItems: input.selectedItems
		}
	};
}
