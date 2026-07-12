import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
	getAssessmentItemVersion,
	type AssessmentArea,
	type ErrorSignal
} from './assessment-items';
import type { SkillProfile, StudyPlan } from './assessment-diagnosis';
import type { Db } from './db';
import {
	assessmentAttempt,
	practiceAttempt,
	type AttemptResponse,
	type PlacementTestProfile as IntakePlacementTestProfile
} from './db/schema';
import { getWorkersAiRuntime, runWorkersAiJson, type WorkersAiRuntime } from './workers-ai';
import { getLearnerGuide } from '$lib/learner-guides';

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

export const practiceDifficulties = ['foundation', 'practice', 'challenge'] as const;
export type PracticeDifficulty = (typeof practiceDifficulties)[number];
export type AdaptiveReason = 'plan_balance' | 'miss_repeat' | 'level_advance';
type AuthoredCeptObjectiveTaskType =
	'read_and_select' | 'gapped_sentence' | 'multiple_choice_gap_fill' | 'open_gap_fill';

const areaSchema = z.enum(assessmentAreas);
const signalSchema = z.enum(errorSignals);
const difficultySchema = z.enum(practiceDifficulties);
const adaptiveReasonSchema = z.enum(['plan_balance', 'miss_repeat', 'level_advance']);

const commonProblemShape = {
	id: z.string().trim().min(1).max(120),
	targetArea: areaSchema,
	targetSignal: signalSchema,
	sourceResponseItemId: z.string().trim().min(1).max(120).optional(),
	prompt: z.string().trim().min(1).max(700),
	difficulty: difficultySchema,
	adaptiveReason: adaptiveReasonSchema.default('plan_balance'),
	repeatOfPracticeId: z.string().trim().min(1).max(120).optional()
};

const choiceProblemSchema = z
	.object({
		...commonProblemShape,
		kind: z.literal('choice'),
		placementTaskType: z
			.enum([
				'read_and_select',
				'gapped_sentence',
				'multiple_choice_gap_fill',
				'targeted_skill_drill'
			])
			.optional(),
		choices: z
			.array(
				z.object({
					id: z.string().trim().min(1).max(12),
					text: z.string().trim().min(1).max(240)
				})
			)
			.min(2)
			.max(4),
		answerKey: z.string().trim().min(1).max(12),
		explanation: z.string().trim().min(1).max(700)
	})
	.refine((problem) => problem.choices.some((choice) => choice.id === problem.answerKey), {
		message: 'Practice problem answer key must match a choice.'
	});

const listeningChoiceProblemSchema = z
	.object({
		...commonProblemShape,
		kind: z.literal('listening_choice'),
		placementProfileId: z
			.enum(['accuplacer_esl', 'cambridge_cept', 'school_specific', 'not_sure'])
			.default('not_sure'),
		placementTaskType: z
			.enum(['listen_and_select', 'connected_discourse', 'extended_listening'])
			.default('listen_and_select'),
		modality: z.literal('audio').default('audio'),
		audioScript: z.string().trim().min(1).max(900),
		choices: z
			.array(
				z.object({
					id: z.string().trim().min(1).max(12),
					text: z.string().trim().min(1).max(240)
				})
			)
			.min(2)
			.max(4),
		answerKey: z.string().trim().min(1).max(12),
		explanation: z.string().trim().min(1).max(700)
	})
	.refine((problem) => problem.choices.some((choice) => choice.id === problem.answerKey), {
		message: 'Listening practice answer key must match a choice.'
	});

const fillProblemSchema = z.object({
	...commonProblemShape,
	kind: z.literal('fill'),
	placementTaskType: z.enum(['open_gap_fill', 'targeted_skill_drill']).optional(),
	acceptableAnswers: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
	explanation: z.string().trim().min(1).max(700)
});

const productiveRubricSchema = z.object({
	targetDescription: z.string().trim().min(1).max(300),
	minimumWords: z.number().int().min(1).max(100).optional(),
	minimumSeconds: z.number().int().min(1).max(180).optional()
});

const shortTextProblemSchema = z.object({
	...commonProblemShape,
	kind: z.literal('short_text'),
	rubric: productiveRubricSchema
});

const speakingProblemSchema = z.object({
	...commonProblemShape,
	kind: z.literal('speaking'),
	rubric: productiveRubricSchema
});

const normalizeLegacyProblem = (value: unknown) => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
	const problem = { ...(value as Record<string, unknown>) };
	if (problem.difficulty === 'easy') problem.difficulty = 'foundation';
	if (!problem.kind && Array.isArray(problem.choices)) problem.kind = 'choice';
	if (!problem.adaptiveReason) problem.adaptiveReason = 'plan_balance';
	return problem;
};

const practiceProblemSchema = z.preprocess(
	normalizeLegacyProblem,
	z.union([
		choiceProblemSchema,
		listeningChoiceProblemSchema,
		fillProblemSchema,
		shortTextProblemSchema,
		speakingProblemSchema
	])
);

export type PracticeProblem = z.output<typeof practiceProblemSchema>;

export const practiceModalityMatchesTarget = (problem: PracticeProblem) =>
	problem.targetArea === 'listening'
		? problem.kind === 'listening_choice'
		: problem.targetArea === 'writing'
			? problem.kind === 'short_text'
			: problem.targetArea === 'speaking'
				? problem.kind === 'speaking'
				: true;

const practiceMetadataSchema = z.preprocess(
	(value) => {
		if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
		const metadata = value as Record<string, unknown>;
		if ('modelId' in metadata && 'promptVersion' in metadata && 'generatedAt' in metadata) {
			return metadata;
		}
		return {
			schemaVersion: 2,
			provider: metadata.provider,
			modelId: metadata.model ?? 'unknown-legacy-model',
			promptVersion: 'legacy-v1',
			generatedAt: '1970-01-01T00:00:00.000Z',
			fallbackReason: 'legacy_metadata'
		};
	},
	z.object({
		schemaVersion: z.literal(2),
		provider: z.enum(['local', 'workers-ai']),
		modelId: z.string().trim().min(1).max(160),
		promptVersion: z.string().trim().min(1).max(80),
		generatedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), 'Invalid date.'),
		audioDeliveredAt: z
			.string()
			.refine((value) => Number.isFinite(Date.parse(value)), 'Invalid audio delivery date.')
			.optional(),
		fallbackReason: z.string().trim().min(1).max(160).optional()
	})
);

export type PracticeMetadata = z.output<typeof practiceMetadataSchema>;

const practiceFeedbackSchema = z.preprocess(
	(value) => {
		if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
		const feedback = value as Record<string, unknown>;
		if (feedback.kind) return feedback;
		if (typeof feedback.correct === 'boolean') {
			return {
				kind: 'objective',
				scored: true,
				correct: feedback.correct,
				message: feedback.message,
				explanation: feedback.message
			};
		}
		return value;
	},
	z.union([
		z.object({
			kind: z.literal('objective'),
			scored: z.boolean(),
			correct: z.boolean(),
			message: z.string().trim().min(1).max(900),
			explanation: z.string().trim().min(1).max(700),
			prompt: z.string().trim().min(1).max(700).optional(),
			learnerAnswer: z.string().trim().min(1).max(240).optional(),
			expectedAnswer: z.string().trim().min(1).max(240).optional(),
			nextStep: z.string().trim().min(1).max(400).optional(),
			audioTranscript: z.string().trim().min(1).max(900).optional()
		}),
		z.object({
			kind: z.literal('productive'),
			scored: z.boolean(),
			meetsTarget: z.boolean().nullable(),
			strength: z.string().trim().min(1).max(400),
			correction: z.string().trim().min(1).max(500),
			nextTip: z.string().trim().min(1).max(400)
		})
	])
);

export type PracticeFeedback = z.output<typeof practiceFeedbackSchema>;

const practiceResponseSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('choice'), answer: z.string().trim().min(1).max(12) }),
	z.object({ kind: z.literal('listening_choice'), answer: z.string().trim().min(1).max(12) }),
	z.object({ kind: z.literal('fill'), answer: z.string().trim().min(1).max(160) }),
	z.object({ kind: z.literal('short_text'), text: z.string().trim().min(1).max(2000) }),
	z.object({
		kind: z.literal('speaking'),
		transcript: z.string().trim().min(1).max(2400).optional(),
		transcriptSource: z.enum(['workers_ai_asr', 'submitted']).optional(),
		responseSeconds: z.number().int().min(1).max(180)
	})
]);

export type PracticeResponse = z.infer<typeof practiceResponseSchema>;

export type PracticeProblemPublic = {
	practiceId: string;
	sessionId: string;
	sequence: number;
	totalProblems: 5;
	targetArea: AssessmentArea;
	targetSignal: ErrorSignal;
	difficulty: PracticeDifficulty;
	prompt: string;
} & (
	| {
			kind: 'choice';
			choices: { id: string; text: string }[];
			placementTaskType?:
				'read_and_select' | 'gapped_sentence' | 'multiple_choice_gap_fill' | 'targeted_skill_drill';
	  }
	| {
			kind: 'listening_choice';
			choices: { id: string; text: string }[];
			audioUrl: string;
			placementTaskType: 'listen_and_select' | 'connected_discourse' | 'extended_listening';
	  }
	| { kind: 'fill'; placementTaskType?: 'open_gap_fill' | 'targeted_skill_drill' }
	| { kind: 'short_text' }
	| { kind: 'speaking' }
);

export type AdaptiveHistoryEntry = {
	practiceId: string;
	sessionId?: string;
	targetArea: AssessmentArea;
	targetSignal: ErrorSignal;
	difficulty: PracticeDifficulty;
	adaptiveReason: AdaptiveReason;
	contentId: string;
	scored: boolean;
	correct: boolean | null;
	answeredAt?: string;
};

export type PracticeReviewSchedule = {
	attempts: number;
	correctStreak: number;
	due: boolean;
	dueAt: string | null;
};

export type PracticeSelection = {
	targetArea: AssessmentArea;
	targetSignal: ErrorSignal;
	difficulty: PracticeDifficulty;
	adaptiveReason: AdaptiveReason;
	repeatOfPracticeId?: string;
	excludeContentId?: string;
};

export class PracticeInputError extends Error {}
export class PracticeNotFoundError extends Error {}
export class PracticeConflictError extends Error {}
export class PracticeDataError extends Error {}

export const practiceTargetKey = (area: AssessmentArea, signal: ErrorSignal) =>
	`${area}:${signal}` as const;

export const practiceKindForTarget = (area: AssessmentArea) =>
	area === 'listening'
		? ('listening_choice' as const)
		: area === 'writing'
			? ('short_text' as const)
			: area === 'speaking'
				? ('speaking' as const)
				: ('objective' as const);

export const placementTestProfileIds = [
	'accuplacer_esl',
	'cambridge_cept',
	'school_specific',
	'not_sure'
] as const;

export type PracticePlacementProfile = {
	id: (typeof placementTestProfileIds)[number];
	label: string;
	sections: string[];
	taskGuidance: string;
	institution?: string;
	targetOutcome?: string;
	testDate?: string;
};

const placementTestProfiles: Record<PracticePlacementProfile['id'], PracticePlacementProfile> = {
	accuplacer_esl: {
		id: 'accuplacer_esl',
		label: 'ACCUPLACER ESL',
		sections: ['sentence meaning', 'language use', 'reading skills', 'listening'],
		taskGuidance:
			'Use an ACCUPLACER-style sentence meaning, language use, reading, listening, or essay-preparation task appropriate to the selected area.'
	},
	cambridge_cept: {
		id: 'cambridge_cept',
		label: 'Cambridge English Placement Test',
		sections: ['reading', 'listening'],
		taskGuidance:
			'Use a CEPT-style Reading task (including language-knowledge item families such as read-and-select or gap-fill) or Listening task appropriate to the selected area.'
	},
	school_specific: {
		id: 'school_specific',
		label: 'school-specific ESL placement test',
		sections: ['institution-defined ESL skills'],
		taskGuidance:
			'Use a concise placement-style task for the requested area. Respect the named institution and target outcome without inventing a score scale or proprietary test content.'
	},
	not_sure: {
		id: 'not_sure',
		label: 'general ESL placement test',
		sections: ['listening', 'reading', 'language use', 'vocabulary', 'writing', 'speaking'],
		taskGuidance:
			'Use a concise placement-style task that measures one construct and resembles common computer-based ESL placement questions.'
	}
};

export const inferPlacementTestProfile = (
	goal = '',
	intakeProfile?: IntakePlacementTestProfile
): PracticePlacementProfile => {
	const normalized = goal.toLocaleLowerCase('en-US');
	const inferredKind = intakeProfile
		? intakeProfile.kind
		: normalized.includes('accuplacer')
			? 'accuplacer_esl'
			: normalized.includes('cambridge') || normalized.includes('cept')
				? 'cambridge_cept'
				: 'not_sure';
	const knownSections = (intakeProfile?.knownSections ?? '')
		.split(/[\n,;]+/)
		.map((section) => section.trim())
		.filter(Boolean);
	const normalizedKnownSections = (intakeProfile?.knownSections ?? '').toLocaleLowerCase('en-US');
	const hasKnownSectionText = normalizedKnownSections.trim().length > 0;
	const knownRequestsAccuplacerWriting = /writ|essay|writeplacer/.test(normalizedKnownSections);
	const targetRequestsAccuplacerWriting = /writ|essay|writeplacer/i.test(
		intakeProfile?.targetOutcome ?? ''
	);
	const acceptsCustomSections = inferredKind === 'school_specific' || inferredKind === 'not_sure';
	const detectedAccuplacerSections = [
		...(normalizedKnownSections.includes('sentence meaning') ? ['sentence meaning'] : []),
		...(/language use|use of english|grammar|structure/.test(normalizedKnownSections)
			? ['language use']
			: []),
		...(normalizedKnownSections.includes('read') ? ['reading skills'] : []),
		...(/listen|audio/.test(normalizedKnownSections) ? ['listening'] : [])
	];
	const selectedNamedSections =
		inferredKind === 'accuplacer_esl'
			? hasKnownSectionText
				? [
						...detectedAccuplacerSections,
						...(knownRequestsAccuplacerWriting ? ['WritePlacer ESL'] : [])
					]
				: targetRequestsAccuplacerWriting
					? [...placementTestProfiles.accuplacer_esl.sections, 'WritePlacer ESL']
					: []
			: inferredKind === 'cambridge_cept'
				? [
						...(/read|language|grammar|structure|gap|vocab|word/.test(normalizedKnownSections)
							? ['reading']
							: []),
						...(/listen|audio/.test(normalizedKnownSections) ? ['listening'] : [])
					]
				: [];
	return {
		...placementTestProfiles[inferredKind],
		...(acceptsCustomSections && knownSections.length
			? { sections: knownSections }
			: selectedNamedSections.length
				? { sections: selectedNamedSections }
				: {}),
		...(intakeProfile?.institution ? { institution: intakeProfile.institution } : {}),
		...(intakeProfile?.targetOutcome ? { targetOutcome: intakeProfile.targetOutcome } : {}),
		...(intakeProfile?.testDate ? { testDate: intakeProfile.testDate } : {})
	};
};

const defaultAreaBySignal: Record<ErrorSignal, AssessmentArea> = {
	main_idea: 'reading',
	detail: 'listening',
	inference: 'reading',
	vocabulary_in_context: 'vocabulary',
	verb_form: 'grammar_usage',
	subject_verb_agreement: 'grammar_usage',
	article_determiner: 'writing',
	plural_countability: 'writing',
	preposition: 'grammar_usage',
	pronoun_choice: 'grammar_usage',
	sentence_control: 'writing',
	collocation: 'vocabulary',
	task_completion: 'speaking',
	clarity: 'speaking',
	fluency: 'speaking'
};

const signalLabel: Record<ErrorSignal, string> = {
	main_idea: 'main ideas',
	detail: 'supporting details',
	inference: 'supported inferences',
	vocabulary_in_context: 'vocabulary in context',
	verb_form: 'verb forms',
	subject_verb_agreement: 'subject-verb agreement',
	article_determiner: 'articles and determiners',
	plural_countability: 'plurals and countability',
	preposition: 'prepositions',
	pronoun_choice: 'pronoun choice',
	sentence_control: 'sentence control',
	collocation: 'natural word combinations',
	task_completion: 'task completion',
	clarity: 'clarity',
	fluency: 'fluency'
};

const productiveTaskBySignal: Record<ErrorSignal, string> = {
	main_idea: 'Summarize a movie, show, or story in one main point, then add one supporting fact.',
	detail: 'Describe an upcoming appointment and include its day, time, and place.',
	inference:
		'Describe two clues from a situation and state one reasonable conclusion that those clues support.',
	vocabulary_in_context: 'Use the word “convenient” in a situation that makes its meaning clear.',
	verb_form: 'Say what you did yesterday and what you plan to do tomorrow.',
	subject_verb_agreement: 'Describe one person’s routine and then describe what two people do.',
	article_determiner:
		'Describe something you bought, using a or an first and the when you mention it again.',
	plural_countability:
		'Describe a shopping list with two countable items and one uncountable item.',
	preposition: 'Explain where an object is and when you will use it.',
	pronoun_choice: 'Introduce a friend, then refer to that person without repeating the name.',
	sentence_control: 'Explain a small problem and its result using complete connected sentences.',
	collocation:
		'Describe a busy day using two natural word pairs, such as take a break or make a decision.',
	task_completion: 'Name one place you visited and give two reasons you would or would not return.',
	clarity: 'Give clear directions from your home to a nearby place.',
	fluency: 'Tell a short sequence about your weekend, using first, then, and finally.'
};

const challengeProductiveTaskBySignal: Record<ErrorSignal, string> = {
	main_idea:
		'Summarize a proposal’s central claim, distinguish it from supporting details, and explain one implication.',
	detail:
		'Explain a multi-step campus or workplace policy, including its deadline, one exception, and the action a student should take.',
	inference:
		'Explain what a writer likely intends readers to conclude from two pieces of evidence, then distinguish that conclusion from one claim the evidence does not support.',
	vocabulary_in_context:
		'Use the word “mitigate” in a developed example whose context makes the meaning clear without defining the word directly.',
	verb_form:
		'Describe a project that began in the past, explain what has changed, and predict what will have happened by a future deadline.',
	subject_verb_agreement:
		'Explain two findings from a report, including one sentence whose subject is separated from its verb by an intervening phrase.',
	article_determiner:
		'Describe a proposed program, first introducing it with an indefinite article and then referring to specific features with appropriate determiners.',
	plural_countability:
		'Compare two research summaries while accurately using the noncount nouns evidence, advice, and information and at least two countable nouns.',
	preposition:
		'Explain how an organization changed a policy in response to a review, using precise prepositional phrases for cause, time, and procedure.',
	pronoun_choice:
		'Summarize a disagreement between two groups, using reference words clearly enough that every pronoun has an unmistakable antecedent.',
	sentence_control:
		'Present a recommendation, acknowledge a limitation with although or while, and explain the result in varied complete sentences.',
	collocation:
		'Discuss a study or proposal using at least three natural formal word combinations, such as reach a conclusion, pose a challenge, and address a concern.',
	task_completion:
		'Compare two course or transportation proposals, acknowledge one drawback of your preferred option, and recommend a concrete next step.',
	clarity:
		'Give a precise update that separates a preliminary finding from its limitation and clearly states the resulting decision.',
	fluency:
		'Develop a position on online and in-person learning with an opening claim, a qualification, a supporting example, and a concise conclusion.'
};

const alternateProductiveTaskBySignal: Record<ErrorSignal, Record<PracticeDifficulty, string>> = {
	main_idea: {
		foundation:
			'Give the main point of a short message about a schedule change, then add one fact that supports it.',
		practice:
			'Summarize a short article or announcement you recently read: state its central point and explain which detail best supports that point.',
		challenge:
			'Summarize the main argument for making public transportation free for students, distinguish two supporting reasons from the claim, and explain one consequence the argument does not address.'
	},
	detail: {
		foundation:
			'Describe a meeting and include the exact day, time, place, and one thing to bring.',
		practice:
			'Describe a class, work, or appointment schedule and include the exact day, start time, location, and one item a participant must bring.',
		challenge:
			'Explain an application process with an initial deadline, a later exception, two required documents, and the consequence of missing the first deadline.'
	},
	inference: {
		foundation:
			'Describe two visible clues in a familiar situation and say what they probably mean without adding facts that are not shown.',
		practice:
			'Explain what can reasonably be concluded from two details in a school or workplace notice, and name one conclusion the details do not support.',
		challenge:
			'Interpret the likely implication of a short report with mixed results, cite two supporting details, and state one limitation on the conclusion.'
	},
	vocabulary_in_context: {
		foundation: 'Use the word “crowded” in a short situation whose details make its meaning clear.',
		practice:
			'Use the word “reliable” in a developed example whose surrounding details make its meaning clear.',
		challenge:
			'Use the word “tentative” in a discussion of research or planning so that the surrounding context makes its meaning clear without a direct definition.'
	},
	verb_form: {
		foundation: 'Describe one action you do every week and one action you completed yesterday.',
		practice:
			'Describe something you had completed before another past event, then explain what you have done since that time.',
		challenge:
			'Explain how a project might be different now if an earlier decision had changed, then predict what will have happened by its next deadline.'
	},
	subject_verb_agreement: {
		foundation: 'Describe what one classmate does and what two classmates do each week.',
		practice:
			'Compare one local service with several similar services, making sure each subject agrees with its verb.',
		challenge:
			'Report two findings using “a series of interviews” as one subject and “the results of the surveys” as another, with accurate subject-verb agreement.'
	},
	article_determiner: {
		foundation: 'Introduce one object with a or an, then mention the same object again with the.',
		practice:
			'Introduce a course or service for the first time, then refer to the same specific course or service and one of its features with accurate articles.',
		challenge:
			'Evaluate a new campus policy while accurately using indefinite articles to introduce two countable ideas and definite articles when referring back to them.'
	},
	plural_countability: {
		foundation:
			'Describe a short shopping list with two plural countable items and one uncountable item.',
		practice:
			'Describe supplies for a workshop using “equipment” or “information” as a noncount noun and at least two countable plural nouns.',
		challenge:
			'Summarize a small study while accurately using the noncount nouns research, evidence, and feedback and the countable nouns participants and findings.'
	},
	preposition: {
		foundation:
			'Say where one object is and when you plan to use it, including a place phrase and a time phrase.',
		practice:
			'Explain how to travel from one familiar place to another, including precise phrases for location, movement, and arrival time.',
		challenge:
			'Explain how a committee acted in accordance with a policy and in response to a complaint, adding one precise phrase for the date or deadline.'
	},
	pronoun_choice: {
		foundation: 'Introduce one person, then use a clear pronoun to say what that person did.',
		practice:
			'Describe a conversation between two people, then refer to each person and one shared object without repeating their names unnecessarily.',
		challenge:
			'Summarize two researchers’ different recommendations, using relative and reference pronouns so that ownership and every antecedent remain unmistakable.'
	},
	sentence_control: {
		foundation:
			'Explain a simple cause and result in two complete sentences, then connect them with so.',
		practice:
			'Describe a schedule change with one complete although clause, one reason introduced by because, and a clear result.',
		challenge:
			'Compare two study results in varied complete sentences, using whereas for the contrast and consequently for a carefully limited conclusion.'
	},
	collocation: {
		foundation:
			'Describe one decision and one break you took, using make a decision and take a break.',
		practice:
			'Describe progress toward a goal using two natural combinations such as make progress, meet a deadline, or take responsibility.',
		challenge:
			'Evaluate a report using at least three formal combinations such as draw a conclusion, provide evidence, and raise a concern.'
	},
	task_completion: {
		foundation: 'Name one class you would like to take and give two reasons for your choice.',
		practice:
			'Choose between an online and an evening course, give one reason for your choice, identify one possible problem, and state what you would check next.',
		challenge:
			'Evaluate a plan to replace parking spaces with a campus bus stop, acknowledge one objection, use one relevant example, and recommend a concrete first step.'
	},
	clarity: {
		foundation:
			'Give a clear message that states where you are, when you will arrive, and why you are delayed.',
		practice:
			'Write or deliver a clear rescheduling message that states the original appointment, the conflict, and two specific alternative times.',
		challenge:
			'Report a preliminary result, explain why it does not prove cause, and state exactly what additional evidence is needed before a decision.'
	},
	fluency: {
		foundation: 'Tell three connected steps from your morning using first, then, and finally.',
		practice:
			'Tell how you completed a registration or application process, connecting at least four steps with varied sequence and cause-and-effect language.',
		challenge:
			'Develop a position on requiring a first-year seminar, address a reasonable counterargument, give a concrete example, and end with a qualified recommendation.'
	}
};

const productiveRequirements = (
	kind: 'short_text' | 'speaking',
	difficulty: PracticeDifficulty
) => {
	if (kind === 'short_text') {
		if (difficulty === 'challenge') {
			return { instruction: 'Write 90–120 words.', minimumWords: 90 } as const;
		}
		if (difficulty === 'practice') {
			return { instruction: 'Write 60–90 words.', minimumWords: 50 } as const;
		}
		return { instruction: 'Write 3–4 clear sentences.', minimumWords: 25 } as const;
	}
	if (difficulty === 'challenge') {
		return { instruction: 'Speak for 60–90 seconds.', minimumSeconds: 60 } as const;
	}
	if (difficulty === 'practice') {
		return { instruction: 'Speak for 45–60 seconds.', minimumSeconds: 40 } as const;
	}
	return { instruction: 'Speak for 30–45 seconds.', minimumSeconds: 25 } as const;
};

type ChoiceSeed = readonly [
	'choice',
	string,
	readonly [string, string, string, string],
	0 | 1 | 2 | 3,
	string,
	{ readonly ceptTaskType: Exclude<AuthoredCeptObjectiveTaskType, 'open_gap_fill'> }?
];
type FillSeed = readonly [
	'fill',
	string,
	readonly string[],
	string,
	readonly [string, string, string, string],
	0 | 1 | 2 | 3,
	{
		readonly ceptTaskType: Exclude<AuthoredCeptObjectiveTaskType, 'read_and_select'>;
	}?
];
type ObjectiveSeed = ChoiceSeed | FillSeed;

// Each signal has reviewed fallback content at every level. The primary bank keeps the original
// items; a second reviewed practice/challenge bank below lets adaptive evidence use two genuinely
// different tasks even when Workers AI is unavailable.
const objectiveBank = {
	main_idea: {
		foundation: [
			[
				'choice',
				'NOTICE: Roadwork is delaying Route 8 today. Passengers traveling to Central Station should use Route 12 instead. Choose the sentence that most closely matches the meaning of the notice.',
				[
					'Route 8 passengers should take Route 12 to Central Station today.',
					'Central Station is closed while Route 12 is repaired.',
					'Route 12 passengers should wait for a delayed Route 8 bus.',
					'All buses to Central Station have stopped permanently.'
				],
				0,
				'The notice directs Route 8 passengers to use Route 12 for Central Station today.',
				{ ceptTaskType: 'read_and_select' }
			],
			[
				'choice',
				'Sam felt sick, so he stayed home and rested. What is the main idea?',
				[
					'Sam went shopping.',
					'Sam stayed home because he was sick.',
					'Sam worked all day.',
					'Sam visited a doctor at work.'
				],
				1,
				'The sentence is mainly about Sam staying home because he felt sick.'
			]
		],
		practice: [
			[
				'choice',
				'The library will close early today for a staff meeting. Visitors should return books before 4:00. What is the main idea?',
				[
					'The library needs more books.',
					'Visitors have a meeting.',
					'The library closes early today.',
					'Visitors may return books after 4:00.'
				],
				2,
				"Both sentences explain today's early closing."
			]
		],
		challenge: [
			[
				'choice',
				'A regional rail line planned to reduce service permanently after weekday ridership fell. Local employers argued that fewer trains would make it harder for evening-shift workers to commute. In response, the transit agency postponed the cuts for three months while it studies whether revised schedules could control costs without limiting access. What is the main idea?',
				[
					'The agency delayed service cuts while considering a less disruptive plan.',
					'Local employers agreed that evening trains should end immediately.',
					'Rail ridership increased after the agency expanded weekday service.',
					'The agency decided that operating costs no longer matter.'
				],
				0,
				'The passage centers on delaying the proposed cuts while the agency evaluates alternatives.'
			]
		]
	},
	detail: {
		foundation: [
			[
				'choice',
				'The appointment is Tuesday at 2:30. When is the appointment?',
				['Monday at 2:30', 'Tuesday at 2:30', 'Tuesday at 3:30', 'Thursday at 2:30'],
				1,
				'The stated day and time are Tuesday at 2:30.'
			],
			[
				'choice',
				'Kai left the package beside the blue door. Where is the package?',
				['Beside the blue door', 'Inside the car', 'Under the desk', 'Behind the building'],
				0,
				'The sentence places it beside the blue door.'
			]
		],
		practice: [
			[
				'choice',
				'Rosa will bring soup to the office after her 11:00 dentist visit. What will Rosa bring?',
				['A coat', 'Soup', 'A book', 'A dental form'],
				1,
				'Soup is the item Rosa will bring.'
			]
		],
		challenge: [
			[
				'choice',
				'Employees may attend the safety workshop on Wednesday at 6:15 in Room 12 or view the recording after Friday. Anyone seeking a completion certificate must attend in person and sign the roster before the presentation begins. Which participant can receive a certificate?',
				[
					'An employee who arrives Wednesday at 6:05 and signs the roster',
					'An employee who watches the recording on Thursday',
					'An employee who arrives Wednesday at 6:30 without signing in',
					'An employee who reads the slides instead of attending'
				],
				0,
				'The certificate requires in-person attendance and signing the roster before the 6:15 start.'
			]
		]
	},
	inference: {
		foundation: [
			[
				'choice',
				'The classroom lights are off, the door is locked, and a sign says “Class moved to Room 204.” What can you conclude?',
				[
					'The class is meeting in Room 204.',
					'The class was permanently cancelled.',
					'The teacher forgot to unlock the door.',
					'Room 204 has no lights.'
				],
				0,
				'The locked room and the posted sign support the conclusion that the class moved to Room 204.'
			],
			[
				'choice',
				'Mina brought an umbrella, and dark clouds covered the sky. What is a reasonable conclusion?',
				[
					'Mina expects that it may rain.',
					'Mina plans to go swimming.',
					'The weather is very hot.',
					'Mina lost her umbrella.'
				],
				0,
				'The umbrella and dark clouds reasonably suggest that Mina expects rain.'
			]
		],
		practice: [
			[
				'choice',
				'The tutoring center added evening hours after many working students said they could not arrive before 5:00. Evening appointments filled within two days. What conclusion is best supported?',
				[
					'Later hours met a need for working students.',
					'Daytime tutoring was no longer useful.',
					'Every working student booked an appointment.',
					'Tutors preferred working only in the evening.'
				],
				0,
				'The stated scheduling problem and rapid booking support the conclusion that later hours met a need.'
			]
		],
		challenge: [
			[
				'choice',
				'A college offered optional planning meetings before registration. Students who attended were more likely to finish registration on time, but attendance was voluntary and the college did not compare students with similar prior experience. Which conclusion is most justified?',
				[
					'The meetings may have helped, but the evidence does not prove they caused the difference.',
					'The meetings definitely caused every attendee to register on time.',
					'Prior experience had no relationship to registration.',
					'Making the meetings mandatory would eliminate late registration.'
				],
				0,
				'The association is suggestive, but voluntary attendance and missing comparison controls limit a causal conclusion.'
			]
		]
	},
	vocabulary_in_context: {
		foundation: [
			[
				'choice',
				'The store is crowded, so we must wait. What does crowded mean?',
				['Full of people', 'Very quiet', 'Closed', 'Easy to enter'],
				0,
				'Crowded means full of people.'
			],
			[
				'choice',
				'This bag is light, so I can carry it easily. What does light mean?',
				['Not heavy', 'Very expensive', 'Dark', 'Difficult to carry'],
				0,
				'Here, light means not heavy.'
			]
		],
		practice: [
			[
				'choice',
				'The manager postponed the meeting until Friday. What does postponed mean?',
				['Made shorter', 'Moved to a later time', 'Canceled forever', 'Moved to an earlier room'],
				1,
				'Postponed means moved to a later time.'
			]
		],
		challenge: [
			[
				'choice',
				'The city added shade trees and water stations to mitigate the effects of extreme heat at outdoor bus stops. Officials acknowledged that these measures would not eliminate high temperatures, but expected them to reduce passengers’ exposure. What does mitigate most nearly mean?',
				[
					'Reduce the severity of',
					'Provide evidence for',
					'Delay all discussion of',
					'Measure precisely'
				],
				0,
				'The measures cannot eliminate the heat, but they are intended to reduce its effects.'
			]
		]
	},
	verb_form: {
		foundation: [
			[
				'fill',
				'Mina usually ____ at the campus café on weekdays.',
				['works'],
				'Use works with the singular subject Mina in the simple present.',
				['work', 'working', 'works', 'worked'],
				2,
				{ ceptTaskType: 'gapped_sentence' }
			],
			[
				'fill',
				'Complete the sentence: We ___ dinner at home last night. (cook)',
				['cooked'],
				'Use cooked for a finished past action.',
				['cooks', 'cooked', 'cook', 'cooking'],
				1
			]
		],
		practice: [
			[
				'fill',
				'Complete the sentence: Lina has ___ the email already. (send)',
				['sent'],
				'Use the past participle sent after has.',
				['send', 'sends', 'sending', 'sent'],
				3
			]
		],
		challenge: [
			[
				'fill',
				'The inspectors identified several safety problems in May, and the repair team began work immediately. Complete the final sentence: By the time the inspectors return next month, the team will have ___ the required repairs. (complete)',
				['completed'],
				'Use the past participle completed after will have to show that the repairs will be finished before a future time.',
				['complete', 'completed', 'completing', 'completes'],
				1
			]
		]
	},
	subject_verb_agreement: {
		foundation: [
			[
				'fill',
				'Complete the sentence: My brother ___ coffee every morning. (drink)',
				['drinks'],
				'A singular third-person subject takes drinks.',
				['drink', 'drinking', 'drank', 'drinks'],
				3
			],
			[
				'fill',
				'Complete the sentence: The students ___ near the station. (live)',
				['live'],
				'A plural subject takes live.',
				['live', 'lives', 'living', 'lived'],
				0
			]
		],
		practice: [
			[
				'fill',
				'Complete the sentence: Each ticket ___ a seat number. (show)',
				['shows'],
				'Each is singular, so use shows.',
				['show', 'showing', 'shows', 'shown'],
				2
			]
		],
		challenge: [
			[
				'fill',
				'The committee will compare several final reports before choosing a proposal. Complete the next sentence: The quality of each report, along with the reliability of its supporting data, ___ on careful review. (depend)',
				['depends'],
				'The head subject quality is singular; the phrase between it and the verb does not change the agreement.',
				['depend', 'depending', 'depended', 'depends'],
				3
			]
		]
	},
	article_determiner: {
		foundation: [
			[
				'fill',
				'Complete the sentence: I bought ___ umbrella because it was raining.',
				['an'],
				'Use an before a vowel sound.',
				['a', 'the', 'an', 'some'],
				2
			],
			[
				'fill',
				'Complete the sentence: Please close ___ window next to you.',
				['the'],
				'Use the for the specific window next to the listener.',
				['a', 'an', 'some', 'the'],
				3
			]
		],
		practice: [
			[
				'fill',
				'Complete the sentence: A new manager started today. She is ___ manager I told you about.',
				['the'],
				'The earlier reference identifies a specific manager, so use the.',
				['a', 'an', 'the', 'some'],
				2
			]
		],
		challenge: [
			[
				'fill',
				'The committee could not guarantee permanent support, but it agreed on a conditional plan. Complete the next sentence: The committee reached ___ understanding that funding would continue only if the program met its enrollment target.',
				['an'],
				'Use an in the phrase reached an understanding when introducing the agreement for the first time.',
				['the', 'a', 'no article', 'an'],
				3
			]
		]
	},
	plural_countability: {
		foundation: [
			[
				'fill',
				'Complete the sentence: I need two ___ for the trip. (bag)',
				['bags'],
				'Use the plural bags after two.',
				['bag', 'bags', 'baggage', 'bag’s'],
				1
			],
			[
				'fill',
				'Complete the sentence: We bought three ___. (tomato)',
				['tomatoes'],
				'The plural of tomato is tomatoes.',
				['tomato', 'tomatos', 'tomato’s', 'tomatoes'],
				3
			]
		],
		practice: [
			[
				'choice',
				'Choose the natural sentence.',
				[
					'I need some information.',
					'I need an information.',
					'I need three informations.',
					'I need many information.'
				],
				0,
				'Information is uncountable in this use.'
			]
		],
		challenge: [
			[
				'choice',
				'Choose the sentence that uses count and noncount nouns accurately.',
				[
					'The report offers several useful advices but little supporting evidence.',
					'The report offers some useful advice but little supporting evidence.',
					'The report offers a useful advice but few supporting evidence.',
					'The report offers much useful advices but fewer supporting evidence.'
				],
				1,
				'Advice and evidence are noncount nouns here, so some advice and little evidence are accurate.'
			]
		]
	},
	preposition: {
		foundation: [
			[
				'fill',
				'Maya starts a new course next week. Her first class is ____ Monday morning.',
				['on'],
				'Use on with a day of the week.',
				['at', 'in', 'on', 'between'],
				2,
				{ ceptTaskType: 'open_gap_fill' }
			],
			[
				'fill',
				'Complete the sentence: The keys are resting flat ___ top of the table.',
				['on'],
				'Use on in the phrase on top of the table.',
				['above', 'on', 'at', 'into'],
				1
			]
		],
		practice: [
			[
				'fill',
				'Complete the sentence: The meeting starts ___ 9:00.',
				['at'],
				'Use at with a clock time.',
				['in', 'on', 'for', 'at'],
				3
			]
		],
		challenge: [
			[
				'fill',
				'An independent review found that applicants received inconsistent instructions and that staff interpreted the written policy differently. Complete the next sentence: The agency revised its procedures ___ response to concerns raised during the review.',
				['in'],
				'Use in in the fixed phrase in response to.',
				['at', 'in', 'on', 'with'],
				1
			]
		]
	},
	pronoun_choice: {
		foundation: [
			[
				'choice',
				'Mina called Alex. ___ left a message for him.',
				['She', 'Her', 'Hers', 'Herself'],
				0,
				'She is the subject pronoun for Mina.'
			],
			[
				'choice',
				'This book belongs to Leo. It is ___.',
				['he', 'him', 'his', 'himself'],
				2,
				'His can stand alone to show possession.'
			]
		],
		practice: [
			[
				'choice',
				'Sara and I finished the report. The manager thanked ___.',
				['we', 'us', 'our', 'ours'],
				1,
				'Us is the object pronoun after thanked.'
			]
		],
		challenge: [
			[
				'choice',
				'The committee needed independent evaluators who understood community-based research in urban schools. It invited two researchers, both of ___ had previously evaluated similar programs and published their methods.',
				['who', 'whom', 'which', 'them'],
				1,
				'Whom is the object of the preposition of in the relative clause both of whom had evaluated.'
			]
		]
	},
	sentence_control: {
		foundation: [
			[
				'choice',
				'Choose the clearest sentence.',
				[
					'I was tired, so I went home.',
					'I tired home went.',
					'I was tired I went home.',
					'Because tired, and home.'
				],
				0,
				'So connects the two complete ideas clearly.'
			],
			[
				'choice',
				'Choose the complete sentence.',
				[
					'Because the train was late.',
					'The train was late, but we arrived.',
					'Late train because.',
					'While waiting for the late train.'
				],
				1,
				'The second choice is a complete, controlled sentence.'
			]
		],
		practice: [
			[
				'choice',
				'Choose the clearest sentence.',
				[
					'After I called the clinic, I wrote down the appointment time.',
					'After I called the clinic. Wrote down time.',
					'I clinic called appointment writing.',
					'Calling the clinic, the appointment time wrote down.'
				],
				0,
				'The first choice clearly links the actions.'
			]
		],
		challenge: [
			[
				'choice',
				'Choose the sentence that connects the concession and result with clear, controlled structure.',
				[
					'Although the pilot program increased enrollment, the college postponed expansion because completion rates had not yet improved.',
					'Although the pilot program increased enrollment. The college postponed expansion, completion rates not yet improving.',
					'The pilot program increased enrollment, because the college postponed expansion although completion rates.',
					'Increasing enrollment although, the college postponed expansion because completion rates.'
				],
				0,
				'The first sentence subordinates the concession and gives a complete reason for the result without a fragment or misplaced connector.'
			]
		]
	},
	collocation: {
		foundation: [
			[
				'choice',
				'Choose the natural phrase.',
				['do homework', 'make homework', 'build homework', 'create homework'],
				0,
				'English normally uses do homework.'
			],
			[
				'choice',
				'Choose the natural phrase.',
				['take a decision', 'do a decision', 'make a decision', 'build a decision'],
				2,
				'English normally uses make a decision.'
			]
		],
		practice: [
			[
				'choice',
				'The forecast warned of a storm. By noon, ____ rain had flooded the path beside the library.',
				['heavy', 'strong', 'hard', 'large'],
				0,
				'Heavy rain is the usual word combination.',
				{ ceptTaskType: 'multiple_choice_gap_fill' }
			]
		],
		challenge: [
			[
				'choice',
				'Choose the sentence with the most natural academic word combination.',
				[
					'The small sample poses a limitation for the study’s conclusions.',
					'The small sample makes a limitation for the study’s conclusions.',
					'The small sample performs a limitation for the study’s conclusions.',
					'The small sample builds a limitation for the study’s conclusions.'
				],
				0,
				'Pose a limitation is a natural formal collocation meaning that the sample creates a constraint.'
			]
		]
	},
	task_completion: {
		foundation: [
			[
				'choice',
				'The task says: Name a food you like and say why. Which answer completes it?',
				[
					'Pizza.',
					'I like pizza because it is easy to share.',
					'Because food.',
					'I ate with my family yesterday.'
				],
				1,
				'The answer names a food and gives a reason.'
			],
			[
				'choice',
				'The task says: Say where you went and how you traveled. Which answer completes it?',
				['I went downtown by bus.', 'A bus.', 'Yesterday was sunny.', 'Downtown is busy.'],
				0,
				'The answer includes both the place and transportation.'
			]
		],
		practice: [
			[
				'choice',
				'The task says: Explain one problem at work and what you did. Which answer completes it?',
				[
					'Work was busy.',
					'The printer stopped, so I restarted it and called support.',
					'I like my coworkers.',
					'The printer is beside the window.'
				],
				1,
				'The answer identifies a problem and the response.'
			]
		],
		challenge: [
			[
				'choice',
				'The task says: Compare two proposals, acknowledge one drawback of your preferred option, and recommend a next step. Which response fully completes it?',
				[
					'Both proposals have advantages, so the committee should discuss them.',
					'The evening course serves working students better than the daytime course, although staffing it would cost more. I recommend surveying likely participants before approving the schedule.',
					'The evening proposal is clearly better, and there are no disadvantages to consider.',
					'The daytime course begins at nine, while the evening course begins at six.'
				],
				1,
				'The second response compares the proposals, concedes a drawback, and recommends a concrete next step.'
			]
		]
	},
	clarity: {
		foundation: [
			[
				'choice',
				'Choose the clearest message.',
				[
					'I will arrive ten minutes late.',
					'I arrive late ten maybe.',
					'Late arrive I minute.',
					'Ten minutes will arrive late.'
				],
				0,
				'The first message gives a clear delay.'
			],
			[
				'choice',
				'Choose the clearest request.',
				[
					'Could you send me the address?',
					'Address send maybe me.',
					'You address could.',
					'Could the address sending?'
				],
				0,
				'The first request has clear word order.'
			]
		],
		practice: [
			[
				'choice',
				'Choose the clearest explanation.',
				[
					'I missed the call because my phone was on silent.',
					'Phone silent call missing because.',
					'My call was phone and silent.',
					'Because my phone, I missed silent.'
				],
				0,
				'The first sentence clearly states the event and reason.'
			]
		],
		challenge: [
			[
				'choice',
				'Choose the update that states the evidence, limitation, and decision most precisely.',
				[
					'Preliminary data suggest the tutoring pilot improved attendance; however, because the sample was small, the committee will extend the trial before deciding whether to expand it.',
					'The tutoring pilot improved everything, so the committee will probably continue or expand it later.',
					'Because the sample was small; however, attendance preliminary data and the committee decision.',
					'The committee extended attendance because the tutoring data were a small pilot.'
				],
				0,
				'The first update distinguishes a tentative finding from its limitation and clearly explains the resulting decision.'
			]
		]
	},
	fluency: {
		foundation: [
			[
				'choice',
				'Choose the most complete short answer to “How was your weekend?”',
				[
					'Good.',
					'I visited my sister, and we cooked dinner together.',
					'Weekend, um, sister, dinner.',
					'Because my sister on Saturday.'
				],
				1,
				'The complete sentence develops the answer smoothly.'
			],
			[
				'choice',
				'Choose the most complete answer to “Why are you learning English?”',
				[
					'For work.',
					'I am learning English because I want to speak with customers at work.',
					'English, because, customers.',
					'I learning and customer work.'
				],
				1,
				'The second answer gives a connected, complete reason.'
			]
		],
		practice: [
			[
				'choice',
				'Choose the answer that connects ideas most smoothly.',
				[
					'I took the bus. It was late, so I called my manager and explained.',
					'Bus late. Manager. Explained.',
					'I took, um, the bus, the thing.',
					'Late because manager and I took.'
				],
				0,
				'The first answer uses connected clauses to keep the message moving.'
			]
		],
		challenge: [
			[
				'choice',
				'Choose the response that develops a position with clear progression and qualification.',
				[
					'Online courses can widen access because students avoid commuting. However, they may also reduce informal interaction, so a blended format can preserve flexibility while giving students regular opportunities to collaborate.',
					'Online courses are flexible. Commuting. Interaction. Blended courses are also courses.',
					'I think online courses, you know, can be good, and then there are students and formats.',
					'Because online classes are accessible, however students collaborate, so flexibility.'
				],
				0,
				'The first response presents a benefit, qualifies it with a limitation, and reaches a coherent recommendation.'
			]
		]
	}
} satisfies Record<ErrorSignal, Record<PracticeDifficulty, readonly ObjectiveSeed[]>>;

const objectiveAlternateBank = {
	main_idea: {
		practice: [
			[
				'choice',
				'Employees who normally work in the east building should report to the west building on Friday because electricians will be repairing the power system. Regular schedules will resume Monday. What is the main idea?',
				[
					'Employees will work in a different building on Friday.',
					'All employees will have Friday off.',
					'The west building will permanently close.',
					'Electrical repairs will begin on Monday.'
				],
				0,
				'The notice mainly announces the temporary Friday work-location change.'
			]
		],
		challenge: [
			[
				'choice',
				'A community college piloted evening child care to help student parents attend classes. Enrollment among eligible students rose, but the center frequently had empty spaces because schedules changed from week to week. Administrators will continue the service next term while testing flexible reservations instead of fixed weekly bookings. What is the main idea?',
				[
					'The college is refining a promising child-care program to make it work more efficiently.',
					'The college ended evening child care because no students used it.',
					'Student parents asked the college to replace evening classes with online courses.',
					'Administrators concluded that fixed reservations already match changing schedules.'
				],
				0,
				'The passage balances a positive enrollment result with an efficiency problem and explains the planned adjustment.'
			]
		]
	},
	detail: {
		practice: [
			[
				'choice',
				'To register for the computer workshop, submit the online form by noon on Thursday and bring your student card to Room 204 on Saturday. What must participants bring?',
				['A student card', 'A printed form', 'A laptop', 'A payment receipt'],
				0,
				'The instructions specifically require participants to bring a student card.'
			]
		],
		challenge: [
			[
				'choice',
				'Students receiving the transportation grant must upload a current class schedule by September 8. Students who add a late-start course may submit an updated schedule through September 15, but the original document is still required by the earlier deadline. Which statement is accurate?',
				[
					'Every applicant must submit an initial schedule by September 8.',
					'Only students with late-start courses need to submit a schedule.',
					'An updated schedule replaces the September 8 requirement.',
					'All schedule documents are due September 15.'
				],
				0,
				'The exception permits an update later; it does not remove the September 8 initial deadline.'
			]
		]
	},
	inference: {
		practice: [
			[
				'choice',
				'After the college placed reminder cards beside the library printers, paper waste fell for three straight weeks. No printer settings changed during that time. Which conclusion is best supported?',
				[
					'The reminders may have encouraged people to print more carefully.',
					'The reminders prove that nobody made a printing mistake.',
					'The library removed several printers.',
					'Paper became more expensive during the three weeks.'
				],
				0,
				'The timing and unchanged settings support a cautious inference that the reminders may have influenced behavior.'
			]
		],
		challenge: [
			[
				'choice',
				'Two neighborhoods introduced the same bus-pass discount. Ridership rose in the neighborhood that also added a frequent evening route, but barely changed in the neighborhood whose schedule stayed the same. Surveys found that residents in both places knew about the discount. What inference is best supported?',
				[
					'The usefulness of the schedule likely affected whether the discount changed travel behavior.',
					'Discounts never influence ridership unless all routes run overnight.',
					'Residents in the second neighborhood did not know about the discount.',
					'The evening route alone explains every trip in the first neighborhood.'
				],
				0,
				'Awareness was similar, while schedule usefulness differed, so the comparison supports a limited inference about schedule fit.'
			]
		]
	},
	vocabulary_in_context: {
		practice: [
			[
				'choice',
				'The afternoon class is full, but seats are still available in the evening class. What does available mean?',
				['Ready to be used', 'Already reserved', 'More expensive', 'Difficult to find'],
				0,
				'Available means that the seats are open and can still be used.'
			]
		],
		challenge: [
			[
				'choice',
				'The researchers called their conclusion tentative because only one neighborhood had participated in the survey. They plan to collect data from four additional areas before making a firm recommendation. What does tentative most nearly mean?',
				['Not yet final', 'Widely accepted', 'Carefully hidden', 'Impossible to revise'],
				0,
				'The need for more evidence before a firm recommendation shows that tentative means provisional, or not final.'
			]
		]
	},
	verb_form: {
		practice: [
			[
				'fill',
				'Complete the sentence: By the time I reached the office, the meeting had already ___. (begin)',
				['begun'],
				'Use the past participle begun after had to show the meeting started earlier.',
				['begin', 'began', 'begun', 'beginning'],
				2
			]
		],
		challenge: [
			[
				'fill',
				'The board has not approved the proposal, so construction cannot start. Complete the conditional sentence: If the board had approved it last month, the contractor would have ___ work by now. (start)',
				['started'],
				'Use the past participle started after would have in this unreal past conditional.',
				['start', 'starts', 'starting', 'started'],
				3
			]
		]
	},
	subject_verb_agreement: {
		practice: [
			[
				'fill',
				'Complete the sentence: Neither of the two evening classes ___ available this term. (be)',
				['is'],
				'In formal placement-test usage, neither is singular, so use is.',
				['are', 'is', 'were', 'being'],
				1
			]
		],
		challenge: [
			[
				'fill',
				'The reports describe several changes in student attendance over three semesters. Researchers also interviewed instructors from every department. Complete the next sentence: A series of interviews with instructors ___ additional context for those changes. (provide)',
				['provides'],
				'The head subject series is singular, so the singular verb provides is required.',
				['provide', 'provides', 'providing', 'have provided'],
				1
			]
		]
	},
	article_determiner: {
		practice: [
			[
				'fill',
				'Complete the sentence: We attended ___ orientation that the college offered for new students.',
				['the'],
				'The relative clause identifies a specific orientation, so use the.',
				['a', 'an', 'the', 'some'],
				2
			]
		],
		challenge: [
			[
				'fill',
				'The review identified an unusually large difference between the two groups. Complete the next sentence: Such ___ substantial gap requires further investigation before a policy decision is made.',
				['a'],
				'Use a in the pattern such a + adjective + singular count noun.',
				['an', 'the', 'a', 'no article'],
				2
			]
		]
	},
	plural_countability: {
		practice: [
			[
				'choice',
				'Choose the sentence that uses equipment naturally.',
				[
					'The lab purchased three new pieces of equipment.',
					'The lab purchased three new equipments.',
					'The lab purchased an equipment and two equipments.',
					'The lab purchased many new equipment pieceses.'
				],
				0,
				'Equipment is noncount; pieces of equipment expresses a countable quantity.'
			]
		],
		challenge: [
			[
				'choice',
				'Choose the sentence that accurately distinguishes count and noncount research nouns.',
				[
					'The analysts collected extensive data and reported three unexpected findings.',
					'The analysts collected many data and reported three unexpected research.',
					'The analysts collected an extensive data and reported much findings.',
					'The analysts collected several evidences and reported an information.'
				],
				0,
				'Data is treated as a mass noun in this sentence, while findings is a countable plural.'
			]
		]
	},
	preposition: {
		practice: [
			[
				'fill',
				'Complete the sentence: The advising office is responsible ___ approving schedule changes.',
				['for'],
				'Use for after responsible when naming a duty.',
				['of', 'to', 'for', 'with'],
				2
			]
		],
		challenge: [
			[
				'fill',
				'The grant rules specify how recipients must document expenses. Complete the next sentence: All purchases must be recorded ___ accordance with the procedures in the award letter.',
				['in'],
				'Use in in the fixed formal phrase in accordance with.',
				['by', 'in', 'at', 'from'],
				1
			]
		]
	},
	pronoun_choice: {
		practice: [
			[
				'choice',
				'The instructor asked Maya and ___ to lead the discussion.',
				['I', 'me', 'my', 'mine'],
				1,
				'Me is the object pronoun after asked.'
			]
		],
		challenge: [
			[
				'choice',
				'The committee wanted an evaluator who could analyze results and communicate with local partners. It interviewed an applicant ___ experience included both program evaluation and community outreach over several years.',
				['who', 'whom', 'whose', 'which'],
				2,
				'Whose introduces a relative clause and shows that the experience belongs to the applicant.'
			]
		]
	},
	sentence_control: {
		practice: [
			[
				'choice',
				'Choose the sentence with complete, controlled clauses.',
				[
					'Although the office was busy, a staff member answered my question.',
					'Although the office was busy. A staff member answered.',
					'The office busy although answered my question.',
					'Although busy, and a staff member my question.'
				],
				0,
				'The first option joins a complete dependent clause to a complete main clause.'
			]
		],
		challenge: [
			[
				'choice',
				'Choose the sentence that compares the evidence and states the consequence with precise, controlled structure.',
				[
					'Whereas the first survey measured intentions, the follow-up recorded actual behavior; consequently, the researchers treated the two results as related but not equivalent.',
					'Whereas the first survey measured intentions. The follow-up actual behavior, consequently related but not equivalent.',
					'The surveys were related whereas, consequently the researchers actual behavior and intentions.',
					'Measuring intentions, actual behavior was recorded by the follow-up and therefore the two results related.'
				],
				0,
				'The first sentence uses a complete contrast clause and an independent consequence without a fragment or dangling modifier.'
			]
		]
	},
	collocation: {
		practice: [
			[
				'choice',
				'Choose the natural word combination.',
				['make progress', 'do progress', 'create progress', 'perform progress'],
				0,
				'English normally uses make progress.'
			]
		],
		challenge: [
			[
				'choice',
				'Choose the sentence with the most natural formal collocation.',
				[
					'The available evidence does not justify drawing a firm conclusion.',
					'The available evidence does not justify making out a firm conclusion.',
					'The available evidence does not justify performing a firm conclusion.',
					'The available evidence does not justify building up a firm conclusion.'
				],
				0,
				'Draw a conclusion is the standard formal collocation for reaching an interpretation from evidence.'
			]
		]
	},
	task_completion: {
		practice: [
			[
				'choice',
				'The task says: Choose a course format, give one reason, and name one schedule concern. Which response completes every part?',
				[
					'I prefer the evening class because I work during the day, but I need to check whether the last bus runs after class.',
					'I prefer the evening class because it seems useful.',
					'The last bus leaves at nine thirty.',
					'Both formats include the same textbook and assignments.'
				],
				0,
				'The first response selects a format, explains why, and identifies a schedule concern.'
			]
		],
		challenge: [
			[
				'choice',
				'The task says: Evaluate a proposal to replace some parking spaces with a bus stop, address one likely objection, and recommend an implementation step. Which response fully completes the task?',
				[
					'A bus stop could improve access for students without cars. Although drivers may object to losing spaces, the college should first measure peak parking use and survey commuters before selecting the location.',
					'A bus stop would improve access, and the college should install one immediately.',
					'Drivers need parking spaces, while bus riders need a convenient stop.',
					'The college should survey commuters about transportation.'
				],
				0,
				'The first response evaluates the proposal, acknowledges an objection, and recommends a concrete evidence-gathering step.'
			]
		]
	},
	clarity: {
		practice: [
			[
				'choice',
				'Choose the message that most clearly requests a schedule change and supplies the needed details.',
				[
					'I cannot attend Tuesday at 2:00; could we meet Wednesday after 4:00 instead?',
					'Tuesday is bad, maybe another meeting.',
					'Could schedule changing after?',
					'Wednesday Tuesday meeting at a time.'
				],
				0,
				'The first message identifies the conflict and proposes a specific alternative.'
			]
		],
		challenge: [
			[
				'choice',
				'Choose the statement that reports the relationship between the evidence and conclusion without overstating it.',
				[
					'Students who attended tutoring earned higher average grades, but because attendance was voluntary, the study cannot establish that tutoring caused the difference.',
					'Tutoring certainly caused every participating student to earn a higher grade.',
					'The grades and tutoring were different because voluntary attendance established the cause.',
					'The study cannot say anything because some students chose tutoring.'
				],
				0,
				'The first option states the observed association and clearly limits the causal claim.'
			]
		]
	},
	fluency: {
		practice: [
			[
				'choice',
				'Choose the response with the clearest sequence of events.',
				[
					'First I checked the course list, then I spoke with an adviser, and finally I registered online.',
					'I checked, adviser, registration, and the course list.',
					'Finally I registered because first an adviser then.',
					'The course list was online, you know, and things happened.'
				],
				0,
				'The first response uses sequence markers to connect three events smoothly.'
			]
		],
		challenge: [
			[
				'choice',
				'Choose the response that sustains a position, addresses a counterargument, and reaches a logical conclusion.',
				[
					'Requiring a first-year seminar could help students find support early. Although another requirement may limit choice, discipline-specific sections could preserve flexibility while improving access to resources.',
					'A first-year seminar helps, although requirements and choices and different sections.',
					'Some students need support. There are also course requirements. Resources are available.',
					'Because seminars could be required, however students choose disciplines, so first year.'
				],
				0,
				'The first response develops the claim, answers an objection, and integrates both ideas into a recommendation.'
			]
		]
	}
} satisfies Record<ErrorSignal, Record<'practice' | 'challenge', readonly ObjectiveSeed[]>>;

type ListeningSeed = readonly [
	string,
	string,
	readonly [string, string, string, string],
	0 | 1 | 2 | 3,
	string
];

const listeningBank = {
	main_idea: {
		foundation: [
			[
				'Listen once or twice. What is the main message?',
				'The community center will close at five today because the staff have a training meeting.',
				[
					'The community center closes early today.',
					'The community center needs more staff.',
					'The training meeting starts at five.',
					'The community center opens at five today.'
				],
				0,
				'The full message explains that the community center is closing early today.'
			],
			[
				'Listen once or twice. What is the main idea?',
				"Jin's car would not start this morning, so he took the bus to work.",
				[
					'Jin took the bus to work because his car would not start.',
					'Jin bought a new car before work.',
					'Jin missed work because the bus was late.',
					'Jin repaired his car on the way to work.'
				],
				0,
				'Jin used the bus because his car would not start.'
			]
		],
		practice: [
			[
				'Listen to the announcement. What is it mainly about?',
				"Beginning Monday, the library's second floor will be closed for repairs. Visitors can use the study tables on the first floor.",
				[
					'The library is adding more study tables.',
					'Part of the library will close temporarily.',
					'The whole library will move on Monday.',
					'Visitors cannot study anywhere during repairs.'
				],
				1,
				'The announcement focuses on the temporary second-floor closure.'
			],
			[
				'Listen to the transportation update. What is the main message?',
				'The north-campus shuttle will not stop at the science building this week because the road is being repaired. Riders should use the temporary stop beside the recreation center.',
				[
					'The shuttle has a temporary stop during road repairs.',
					'The recreation center is closed for the week.',
					'Riders must pay an extra fee at the science building.',
					'The north-campus shuttle has ended permanently.'
				],
				0,
				'The update mainly explains the temporary shuttle-stop change caused by road repairs.'
			]
		],
		challenge: [
			[
				'Listen to the campus advice. What is the main message?',
				'At orientation, an adviser explains that students should visit the writing center early and bring a draft. Tutors do not edit papers for students. Instead, they ask questions and teach strategies that students can use while revising and on future assignments.',
				[
					'The writing center teaches strategies students can reuse.',
					'The writing center only helps after an assignment is late.',
					'Tutors at the writing center edit every paper for students.',
					'Students should avoid bringing drafts to the writing center.'
				],
				0,
				'The adviser recommends early help that teaches reusable writing and revision strategies.'
			],
			[
				'Listen to the instructor’s advice. What is the main point?',
				'A history instructor explains that finding a source in the college database does not automatically make it reliable. Students should identify the author, examine the evidence, and compare important claims with another credible source. This process takes longer than choosing the first search result, but it reduces the chance of building an argument on incomplete or misleading information.',
				[
					'Students should evaluate and compare sources before relying on them.',
					'Every source in the college database contains misleading information.',
					'Students should use the first database result to save time.',
					'Only history instructors can decide whether evidence is credible.'
				],
				0,
				'The instructor’s central advice is to evaluate authors and evidence and confirm claims with another credible source.'
			]
		]
	},
	detail: {
		foundation: [
			[
				'Listen once or twice. What time is the appointment?',
				'Your dental appointment is this Thursday at two fifteen in the afternoon.',
				['Thursday at 2:15', 'Tuesday at 2:15', 'Thursday at 3:15', 'Friday at 2:15'],
				0,
				'The speaker says Thursday at two fifteen.'
			],
			[
				'Listen once or twice. Where should the package be left?',
				'Please leave the package beside the red door at the back of the building.',
				['Beside the red door', 'Inside the front office', 'Under the stairs', 'By the blue door'],
				0,
				'The package should be left beside the red door.'
			]
		],
		practice: [
			[
				'Listen to the message. What should Rosa bring?',
				'Rosa, please bring your photo identification and the blue form to your appointment tomorrow.',
				[
					'A payment receipt',
					'Photo identification and the blue form',
					'A photograph and a pen',
					'The blue form without identification'
				],
				1,
				'The message asks Rosa to bring photo identification and the blue form.'
			],
			[
				'Listen to the workshop reminder. Where will the workshop meet?',
				'Tomorrow’s résumé workshop begins at three thirty. Because Room 108 is being painted, please meet in Room 214 and bring a printed copy of your current résumé.',
				['Room 214', 'Room 108', 'The career office lobby', 'The computer lab'],
				0,
				'The reminder changes the location from Room 108 to Room 214.'
			]
		],
		challenge: [
			[
				'Listen to the testing-office message. Which instruction should the student follow?',
				'A student calls the testing office. The receptionist explains that the appointment is still Friday at nine, but it has moved from Building A to the student center. The student should bring photo identification and arrive fifteen minutes early. To reschedule, the student must call before Thursday afternoon.',
				[
					'Bring photo identification and arrive fifteen minutes early.',
					'Go to Building A on Thursday afternoon.',
					'Arrive at nine fifteen without identification.',
					'Call after Friday to change the appointment.'
				],
				0,
				'The receptionist explicitly says to bring identification and arrive fifteen minutes early.'
			],
			[
				'Listen to the professor’s message. What must a student do to receive feedback before the final deadline?',
				'The final research summary is due next Monday at noon. I can review one draft from each student, but you must upload it by Thursday at five so I have time to respond. If you only have an outline by Thursday, bring it to Friday office hours; I can discuss your plan, but I will not review a full draft submitted after Thursday.',
				[
					'Upload a full draft by Thursday at five.',
					'Bring a full draft to Friday office hours.',
					'Submit the final summary on Thursday.',
					'Email an outline after Monday at noon.'
				],
				0,
				'The professor will review a full draft only when it is uploaded by Thursday at five.'
			]
		]
	}
} satisfies Record<'main_idea' | 'detail', Record<PracticeDifficulty, readonly ListeningSeed[]>>;

const isSupportedListeningSignal = (signal: ErrorSignal): signal is keyof typeof listeningBank =>
	signal === 'main_idea' || signal === 'detail';

const listeningTaskType = (
	placementProfile: PracticePlacementProfile,
	difficulty: PracticeDifficulty
) =>
	placementProfile.id === 'accuplacer_esl' && difficulty === 'challenge'
		? ('connected_discourse' as const)
		: ('listen_and_select' as const);

const levelDown = (difficulty: PracticeDifficulty): PracticeDifficulty =>
	difficulty === 'challenge' ? 'practice' : 'foundation';

const levelUp = (difficulty: PracticeDifficulty): PracticeDifficulty =>
	difficulty === 'foundation' ? 'practice' : 'challenge';

const defaultDifficulty = (profile: SkillProfile, area: AssessmentArea): PracticeDifficulty => {
	const band = profile.skillBands[area];
	if (band === 'strong') return 'challenge';
	if (band === 'functional') return 'practice';
	return 'foundation';
};

const reviewIntervalDays = [1, 3, 7, 14] as const;

export function getPracticeReviewSchedule(
	history: readonly AdaptiveHistoryEntry[],
	area: AssessmentArea,
	signal: ErrorSignal,
	now = new Date()
): PracticeReviewSchedule {
	const attempts = history
		.filter(
			(entry) =>
				entry.scored &&
				entry.correct !== null &&
				entry.targetArea === area &&
				entry.targetSignal === signal
		)
		.sort((left, right) => {
			const leftTime = left.answeredAt ? Date.parse(left.answeredAt) : Number.NaN;
			const rightTime = right.answeredAt ? Date.parse(right.answeredAt) : Number.NaN;
			return Number.isFinite(leftTime) && Number.isFinite(rightTime) ? leftTime - rightTime : 0;
		});
	if (!attempts.length) return { attempts: 0, correctStreak: 0, due: true, dueAt: null };

	const latest = attempts.at(-1)!;
	const latestTime = latest.answeredAt ? Date.parse(latest.answeredAt) : Number.NaN;
	if (latest.correct === false) {
		return {
			attempts: attempts.length,
			correctStreak: 0,
			due: true,
			dueAt: Number.isFinite(latestTime) ? new Date(latestTime).toISOString() : null
		};
	}

	let correctStreak = 0;
	const distinctCorrectContent = new Set<string>();
	for (let index = attempts.length - 1; index >= 0 && attempts[index].correct; index -= 1) {
		if (!distinctCorrectContent.has(attempts[index].contentId)) {
			distinctCorrectContent.add(attempts[index].contentId);
			correctStreak += 1;
		}
	}
	if (!Number.isFinite(latestTime)) {
		return { attempts: attempts.length, correctStreak, due: false, dueAt: null };
	}
	const intervalDays =
		reviewIntervalDays[Math.min(correctStreak - 1, reviewIntervalDays.length - 1)];
	const dueAt = new Date(latestTime + intervalDays * 24 * 60 * 60 * 1000);
	return {
		attempts: attempts.length,
		correctStreak,
		due: now.getTime() >= dueAt.getTime(),
		dueAt: dueAt.toISOString()
	};
}

const planTargets = (studyPlan: StudyPlan, skillProfile: SkillProfile) => {
	const structured = [...(studyPlan.targets ?? [])]
		.sort((left, right) => left.priority - right.priority)
		.map(({ area, signal }) => ({ area, signal }));
	const legacy = studyPlan.targetSignals.map((signal) => ({
		area:
			skillProfile.priorityWeaknesses.find((weakness) => weakness.signal === signal)?.area ??
			defaultAreaBySignal[signal],
		signal
	}));
	const combined = structured.length ? structured : legacy;
	if (!combined.length) {
		const weakness = skillProfile.priorityWeaknesses[0];
		return weakness
			? [{ area: weakness.area, signal: weakness.signal }]
			: [{ area: 'grammar_usage' as const, signal: 'verb_form' as const }];
	}
	return combined.filter(
		(target, index) =>
			combined.findIndex(
				(other) => other.area === target.area && other.signal === target.signal
			) === index
	);
};

export function selectNextPracticeTarget({
	skillProfile,
	studyPlan,
	history,
	now = new Date()
}: {
	skillProfile: SkillProfile;
	studyPlan: StudyPlan;
	history: readonly AdaptiveHistoryEntry[];
	now?: Date;
}): PracticeSelection {
	const scored = history.filter((entry) => entry.scored && entry.correct !== null);
	const lastAnswered = history.at(-1);
	if (
		lastAnswered?.scored &&
		lastAnswered.correct === false &&
		lastAnswered.adaptiveReason !== 'miss_repeat'
	) {
		return {
			targetArea: lastAnswered.targetArea,
			targetSignal: lastAnswered.targetSignal,
			difficulty: levelDown(lastAnswered.difficulty),
			adaptiveReason: 'miss_repeat',
			repeatOfPracticeId: lastAnswered.practiceId,
			excludeContentId: lastAnswered.contentId
		};
	}

	let targets = planTargets(studyPlan, skillProfile);
	if (
		lastAnswered?.scored &&
		lastAnswered.correct === false &&
		lastAnswered.adaptiveReason === 'miss_repeat' &&
		targets.length > 1
	) {
		targets = targets.filter(
			(target) =>
				target.area !== lastAnswered.targetArea || target.signal !== lastAnswered.targetSignal
		);
	}
	const currentSessionId = lastAnswered?.sessionId;
	const ranked = targets
		.map((target, priority) => {
			const attempts = scored.filter(
				(entry) => entry.targetArea === target.area && entry.targetSignal === target.signal
			);
			const answeredAttempts = history.filter(
				(entry) => entry.targetArea === target.area && entry.targetSignal === target.signal
			);
			const sessionAttempts = currentSessionId
				? answeredAttempts.filter((entry) => entry.sessionId === currentSessionId)
				: answeredAttempts;
			const recent = attempts.slice(-10);
			const review = getPracticeReviewSchedule(scored, target.area, target.signal, now);
			const lastTwo = attempts.slice(-2);
			const readyToAdvance =
				lastTwo.length === 2 &&
				lastTwo.every((entry) => entry.correct) &&
				lastTwo[0].difficulty === lastTwo[1].difficulty &&
				lastTwo[0].contentId !== lastTwo[1].contentId;
			return {
				...target,
				priority,
				attempts,
				answeredAttempts,
				sessionAttempts,
				review,
				readyToAdvance,
				accuracy: recent.length ? recent.filter((entry) => entry.correct).length / recent.length : 0
			};
		})
		.sort((left, right) => {
			const rank = (target: {
				readyToAdvance: boolean;
				review: PracticeReviewSchedule;
				sessionAttempts: AdaptiveHistoryEntry[];
				attempts: AdaptiveHistoryEntry[];
			}) =>
				target.readyToAdvance
					? 0
					: target.attempts.length > 0 && target.review.due && target.sessionAttempts.length === 1
						? 1
						: target.sessionAttempts.length === 0
							? 2
							: target.attempts.length > 0 && target.review.due
								? 3
								: 4;
			return (
				rank(left) - rank(right) ||
				left.attempts.length - right.attempts.length ||
				left.accuracy - right.accuracy ||
				left.priority - right.priority
			);
		});
	const selected = ranked[0];
	const previous = selected.answeredAttempts.at(-1);
	const selectedLastTwo = selected.attempts.slice(-2);
	if (
		selectedLastTwo.length === 2 &&
		selectedLastTwo.every((entry) => entry.correct) &&
		selectedLastTwo[0].difficulty === selectedLastTwo[1].difficulty &&
		selectedLastTwo[0].contentId !== selectedLastTwo[1].contentId
	) {
		return {
			targetArea: selected.area,
			targetSignal: selected.signal,
			difficulty: levelUp(selectedLastTwo[1].difficulty),
			adaptiveReason: 'level_advance',
			excludeContentId: selectedLastTwo[1].contentId
		};
	}
	return {
		targetArea: selected.area,
		targetSignal: selected.signal,
		difficulty: previous
			? previous.correct === false
				? levelDown(previous.difficulty)
				: previous.difficulty
			: defaultDifficulty(skillProfile, selected.area),
		adaptiveReason: 'plan_balance',
		excludeContentId: previous?.contentId
	};
}

const sourceResponseFor = (
	responses: readonly AttemptResponse[],
	targetSignal: ErrorSignal,
	targetArea: AssessmentArea
) => {
	return responses.find((response) => {
		const item = getAssessmentItemVersion(response.itemId, response.itemVersion);
		return response.area === targetArea && item?.errorSignalTags.includes(targetSignal);
	})?.itemId;
};

const choiceIds = ['a', 'b', 'c', 'd'] as const;

const hasVisibleGap = (prompt: string) => /_{2,}|\[(?:blank|gap)\]/iu.test(prompt);

const authoredCeptTaskType = (
	seed: ObjectiveSeed
): AuthoredCeptObjectiveTaskType | 'targeted_skill_drill' => {
	const metadata = seed[0] === 'choice' ? seed[5] : seed[6];
	if (!metadata) return 'targeted_skill_drill';
	const taskType = metadata.ceptTaskType;
	if (
		taskType === 'read_and_select' &&
		(seed[0] !== 'choice' ||
			!/(?:notice|memo|label|letter)/iu.test(seed[1]) ||
			!/most closely matches the meaning/iu.test(seed[1]))
	) {
		throw new PracticeDataError(
			'Authored CEPT read-and-select content must be a short real-world text with an explicit meaning-match instruction.'
		);
	}
	if (
		(taskType === 'gapped_sentence' || taskType === 'multiple_choice_gap_fill') &&
		!hasVisibleGap(seed[1])
	) {
		throw new PracticeDataError(`Authored CEPT ${taskType} content must show a visible gap.`);
	}
	if (
		taskType === 'multiple_choice_gap_fill' &&
		(seed[0] !== 'choice' || (seed[1].match(/[.!?]/gu)?.length ?? 0) < 2)
	) {
		throw new PracticeDataError(
			'Authored CEPT multiple-choice gap-fill content must use a short text, not an isolated phrase.'
		);
	}
	if (
		taskType === 'open_gap_fill' &&
		(seed[0] !== 'fill' || !hasVisibleGap(seed[1]) || /\([^)]{1,40}\)/u.test(seed[1]))
	) {
		throw new PracticeDataError(
			'Authored CEPT open-gap content must require a missing word without supplying a lemma.'
		);
	}
	return taskType;
};

const ceptObjectiveChoiceCount = (
	taskType: AuthoredCeptObjectiveTaskType | 'targeted_skill_drill'
) => (taskType === 'read_and_select' ? 3 : 4);

const projectIndexedChoices = (
	texts: readonly string[],
	correctIndex: number,
	choiceCount: 3 | 4
) => {
	const sourceIndexes = Array.from(
		{ length: Math.min(choiceCount, texts.length) },
		(_, index) => index
	);
	if (!sourceIndexes.includes(correctIndex)) {
		sourceIndexes[sourceIndexes.length - 1] = correctIndex;
	}
	const answerPosition = sourceIndexes.indexOf(correctIndex);
	if (answerPosition < 0) {
		throw new PracticeDataError('The correct answer could not be projected into the choice set.');
	}
	return {
		choices: sourceIndexes.map((sourceIndex, index) => ({
			id: choiceIds[index],
			text: texts[sourceIndex]
		})),
		answerKey: choiceIds[answerPosition]
	};
};

const fallbackObjectiveProblem = (
	selection: PracticeSelection,
	placementProfile: PracticePlacementProfile,
	sourceResponseItemId?: string
): PracticeProblem => {
	const seeds: readonly ObjectiveSeed[] =
		selection.difficulty === 'foundation'
			? objectiveBank[selection.targetSignal].foundation
			: [
					...objectiveBank[selection.targetSignal][selection.difficulty],
					...objectiveAlternateBank[selection.targetSignal][selection.difficulty]
				];
	let seedIndex = seeds.findIndex(
		(_, index) =>
			`${selection.targetSignal}-${selection.difficulty}-${index + 1}` !==
			selection.excludeContentId
	);
	if (seedIndex < 0) seedIndex = 0;
	const seed = seeds[seedIndex];
	const ceptTaskType =
		placementProfile.id === 'cambridge_cept' ? authoredCeptTaskType(seed) : undefined;
	const common = {
		id: `${selection.targetSignal}-${selection.difficulty}-${seedIndex + 1}`,
		targetArea: selection.targetArea,
		targetSignal: selection.targetSignal,
		sourceResponseItemId,
		difficulty: selection.difficulty,
		adaptiveReason: selection.adaptiveReason,
		repeatOfPracticeId: selection.repeatOfPracticeId,
		prompt: seed[1]
	};
	if (seed[0] === 'fill') {
		if (
			placementProfile.id === 'accuplacer_esl' ||
			ceptTaskType === 'gapped_sentence' ||
			ceptTaskType === 'multiple_choice_gap_fill'
		) {
			const projected = projectIndexedChoices(seed[4], seed[5], 4);
			return validatePracticeProblem({
				...common,
				kind: 'choice',
				...(ceptTaskType ? { placementTaskType: ceptTaskType } : {}),
				...projected,
				explanation: seed[3]
			});
		}
		return validatePracticeProblem({
			...common,
			kind: 'fill',
			...(ceptTaskType ? { placementTaskType: ceptTaskType } : {}),
			acceptableAnswers: seed[2],
			explanation: seed[3]
		});
	}
	const projected = projectIndexedChoices(
		seed[2],
		seed[3],
		ceptTaskType ? ceptObjectiveChoiceCount(ceptTaskType) : 4
	);
	return validatePracticeProblem({
		...common,
		kind: 'choice',
		...(ceptTaskType ? { placementTaskType: ceptTaskType } : {}),
		...projected,
		explanation: seed[4]
	});
};

const fallbackListeningProblem = (
	selection: PracticeSelection,
	placementProfile: PracticePlacementProfile,
	sourceResponseItemId?: string
): PracticeProblem => {
	if (!isSupportedListeningSignal(selection.targetSignal)) {
		throw new PracticeDataError(
			`Listening practice does not support the ${selection.targetSignal} signal.`
		);
	}
	const seeds = listeningBank[selection.targetSignal][selection.difficulty];
	let seedIndex = seeds.findIndex(
		(_, index) =>
			`listening-${selection.targetSignal}-${selection.difficulty}-${index + 1}` !==
			selection.excludeContentId
	);
	if (seedIndex < 0) seedIndex = 0;
	const seed = seeds[seedIndex];
	const choiceCount = placementProfile.id === 'cambridge_cept' ? 3 : 4;
	const projected = projectIndexedChoices(seed[2], seed[3], choiceCount);
	return validatePracticeProblem({
		id: `listening-${selection.targetSignal}-${selection.difficulty}-${seedIndex + 1}`,
		targetArea: 'listening',
		targetSignal: selection.targetSignal,
		sourceResponseItemId,
		difficulty: selection.difficulty,
		adaptiveReason: selection.adaptiveReason,
		repeatOfPracticeId: selection.repeatOfPracticeId,
		kind: 'listening_choice',
		placementProfileId: placementProfile.id,
		placementTaskType: listeningTaskType(placementProfile, selection.difficulty),
		modality: 'audio',
		prompt: seed[0],
		audioScript: seed[1],
		...projected,
		explanation: seed[4]
	});
};

const fallbackProductiveProblem = (
	selection: PracticeSelection,
	kind: 'short_text' | 'speaking',
	sourceResponseItemId?: string
): PracticeProblem => {
	const requirements = productiveRequirements(kind, selection.difficulty);
	const tasks = [
		selection.difficulty === 'challenge'
			? challengeProductiveTaskBySignal[selection.targetSignal]
			: productiveTaskBySignal[selection.targetSignal],
		alternateProductiveTaskBySignal[selection.targetSignal][selection.difficulty]
	];
	let taskIndex = tasks.findIndex(
		(_, index) =>
			`${kind}-${selection.targetSignal}-${selection.difficulty}-${index + 1}` !==
			selection.excludeContentId
	);
	if (taskIndex < 0) taskIndex = 0;
	const task = tasks[taskIndex];
	return validatePracticeProblem({
		id: `${kind}-${selection.targetSignal}-${selection.difficulty}-${taskIndex + 1}`,
		targetArea: selection.targetArea,
		targetSignal: selection.targetSignal,
		sourceResponseItemId,
		difficulty: selection.difficulty,
		adaptiveReason: selection.adaptiveReason,
		repeatOfPracticeId: selection.repeatOfPracticeId,
		kind,
		prompt: `${requirements.instruction} ${task}`,
		rubric: {
			targetDescription: `The response completes the requested task and gives observable evidence of ${signalLabel[selection.targetSignal]}.`,
			...('minimumWords' in requirements
				? { minimumWords: requirements.minimumWords }
				: { minimumSeconds: requirements.minimumSeconds })
		}
	});
};

const aiChoiceCandidateSchema = z
	.object({
		kind: z.literal('choice'),
		prompt: z.string().trim().min(1).max(700),
		choices: z
			.array(
				z.object({ id: z.string().trim().min(1).max(12), text: z.string().trim().min(1).max(240) })
			)
			.min(2)
			.max(4),
		answerKey: z.string().trim().min(1).max(12),
		explanation: z.string().trim().min(1).max(700)
	})
	.refine((problem) => problem.choices.some((choice) => choice.id === problem.answerKey));
const aiObjectiveCandidateSchema = z.union([
	aiChoiceCandidateSchema,
	z.object({
		kind: z.literal('fill'),
		prompt: z.string().trim().min(1).max(700),
		acceptableAnswers: z.array(z.string().trim().min(1).max(120)).min(1).max(8),
		explanation: z.string().trim().min(1).max(700)
	})
]);
const aiListeningCandidateSchema = z
	.object({
		kind: z.literal('listening_choice'),
		prompt: z.string().trim().min(1).max(700),
		audioScript: z.string().trim().min(1).max(900),
		choices: z
			.array(
				z.object({ id: z.string().trim().min(1).max(12), text: z.string().trim().min(1).max(240) })
			)
			.min(2)
			.max(4),
		answerKey: z.string().trim().min(1).max(12),
		explanation: z.string().trim().min(1).max(700)
	})
	.refine((problem) => problem.choices.some((choice) => choice.id === problem.answerKey));
const aiProductiveCandidateSchema = z.object({ prompt: z.string().trim().min(1).max(600) });
const aiReviewSchema = z.object({
	targetAligned: z.boolean(),
	answerAgrees: z.boolean(),
	levelAppropriate: z.boolean(),
	examAligned: z.boolean(),
	learnerRelevant: z.boolean()
});

const generatedMetadata = (
	provider: PracticeMetadata['provider'],
	modelId: string,
	fallbackReason?: string
): PracticeMetadata => ({
	schemaVersion: 2,
	provider,
	modelId,
	promptVersion: 'adaptive-practice-v2',
	generatedAt: new Date().toISOString(),
	...(fallbackReason ? { fallbackReason } : {})
});

export type PracticeGenerationInput = {
	skillProfile: SkillProfile;
	studyPlan: StudyPlan;
	learnerGoal?: string;
	placementProfile?: PracticePlacementProfile;
	recentResponses?: AttemptResponse[];
	history?: AdaptiveHistoryEntry[];
	selection?: PracticeSelection;
	kind?: 'objective' | 'listening_choice' | 'short_text' | 'speaking';
	runtime?: WorkersAiRuntime | null;
};

const normalizeFingerprintText = (value: string) =>
	value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en-US');

const stableContentHash = (value: string) => {
	let hash = 1469598103934665603n;
	for (const character of value) {
		hash ^= BigInt(character.codePointAt(0) ?? 0);
		hash = BigInt.asUintN(64, hash * 1099511628211n);
	}
	return hash.toString(36);
};

const aiCandidateContentId = (
	candidate:
		| z.infer<typeof aiObjectiveCandidateSchema>
		| z.infer<typeof aiListeningCandidateSchema>
		| z.infer<typeof aiProductiveCandidateSchema>,
	selection: PracticeSelection,
	kind: 'objective' | 'listening_choice' | 'short_text' | 'speaking'
) => {
	const parts = [kind, normalizeFingerprintText(candidate.prompt)];
	if (kind === 'listening_choice' && 'audioScript' in candidate) {
		parts.push(normalizeFingerprintText(candidate.audioScript));
	}
	if ('choices' in candidate && Array.isArray(candidate.choices)) {
		const correctText = candidate.choices.find((choice) => choice.id === candidate.answerKey)?.text;
		parts.push(
			...(correctText ? [`correct:${normalizeFingerprintText(correctText)}`] : []),
			...candidate.choices.map((choice) => normalizeFingerprintText(choice.text)).sort()
		);
	}
	if ('acceptableAnswers' in candidate && Array.isArray(candidate.acceptableAnswers)) {
		parts.push(...candidate.acceptableAnswers.map(normalizeFingerprintText).sort());
	}
	return `ai-${selection.targetSignal}-${selection.difficulty}-${stableContentHash(parts.join('\u001f'))}`;
};

const buildAiProblem = (
	candidate:
		| z.infer<typeof aiObjectiveCandidateSchema>
		| z.infer<typeof aiListeningCandidateSchema>
		| z.infer<typeof aiProductiveCandidateSchema>,
	selection: PracticeSelection,
	kind: 'objective' | 'listening_choice' | 'short_text' | 'speaking',
	placementProfile: PracticePlacementProfile,
	sourceResponseItemId?: string
): PracticeProblem => {
	const common = {
		id: aiCandidateContentId(candidate, selection, kind),
		targetArea: selection.targetArea,
		targetSignal: selection.targetSignal,
		sourceResponseItemId,
		difficulty: selection.difficulty,
		adaptiveReason: selection.adaptiveReason,
		repeatOfPracticeId: selection.repeatOfPracticeId
	};
	if (kind === 'short_text' || kind === 'speaking') {
		const requirements = productiveRequirements(kind, selection.difficulty);
		return validatePracticeProblem({
			...common,
			kind,
			prompt: `${requirements.instruction} ${candidate.prompt}`,
			rubric: {
				targetDescription: `The response gives observable evidence of ${signalLabel[selection.targetSignal]}.`,
				...('minimumWords' in requirements
					? { minimumWords: requirements.minimumWords }
					: { minimumSeconds: requirements.minimumSeconds })
			}
		});
	}
	return validatePracticeProblem({
		...common,
		...(kind === 'listening_choice'
			? {
					placementProfileId: placementProfile.id,
					placementTaskType: listeningTaskType(placementProfile, selection.difficulty),
					modality: 'audio' as const
				}
			: placementProfile.id === 'cambridge_cept' && 'kind' in candidate
				? {
						placementTaskType: 'targeted_skill_drill' as const
					}
				: {}),
		...candidate
	});
};

export async function generatePracticeProblem(
	input: PracticeGenerationInput
): Promise<{ problem: PracticeProblem; metadata: PracticeMetadata }> {
	const selection =
		input.selection ??
		selectNextPracticeTarget({
			skillProfile: input.skillProfile,
			studyPlan: input.studyPlan,
			history: input.history ?? []
		});
	const requestedKind = input.kind ?? 'objective';
	const kind =
		selection.targetArea === 'listening'
			? 'listening_choice'
			: selection.targetArea === 'writing'
				? 'short_text'
				: selection.targetArea === 'speaking'
					? 'speaking'
					: requestedKind;
	if (kind === 'listening_choice' && selection.targetArea !== 'listening') {
		throw new PracticeDataError('Listening practice must target the listening area.');
	}
	const learnerGoal = input.learnerGoal?.trim() || 'Build practical English placement-test skills.';
	const placementProfile = input.placementProfile ?? inferPlacementTestProfile(learnerGoal);
	const learnerBand = input.skillProfile.skillBands[selection.targetArea];
	const levelGuidance = `The learner's internal ${selection.targetArea.replaceAll('_', ' ')} band is ${learnerBand}; make this ${selection.difficulty} task meaningfully level-appropriate without claiming an official test level.`;
	const objectiveFormatGuidance =
		placementProfile.id === 'accuplacer_esl'
			? 'Return choice with exactly four plausible alternatives, one unambiguous answer, and an explanation.'
			: placementProfile.id === 'cambridge_cept'
				? 'Return either a four-choice objective drill or an open one-word fill, with one unambiguous answer and an explanation. Reviewed local items, not generated drills, provide named CEPT task-family simulations.'
				: 'Return choice or fill with one unambiguous answer and an explanation.';
	const productiveResponseRequirement =
		kind === 'short_text' || kind === 'speaking'
			? productiveRequirements(kind, selection.difficulty).instruction
			: undefined;
	const sourceResponseItemId = sourceResponseFor(
		input.recentResponses ?? [],
		selection.targetSignal,
		selection.targetArea
	);
	const fallback = (reason: string) => ({
		problem:
			kind === 'objective'
				? fallbackObjectiveProblem(selection, placementProfile, sourceResponseItemId)
				: kind === 'listening_choice'
					? fallbackListeningProblem(selection, placementProfile, sourceResponseItemId)
					: fallbackProductiveProblem(selection, kind, sourceResponseItemId),
		metadata: generatedMetadata('local', 'reviewed-practice-bank-v2', reason)
	});
	const runtime = input.runtime === undefined ? getWorkersAiRuntime() : input.runtime;
	if (!runtime) return fallback('provider_unavailable');

	let candidate:
		| z.infer<typeof aiObjectiveCandidateSchema>
		| z.infer<typeof aiListeningCandidateSchema>
		| z.infer<typeof aiProductiveCandidateSchema>;
	try {
		candidate = await runWorkersAiJson(
			runtime,
			[
				{
					role: 'system',
					content:
						'Return only JSON for one adult ESL placement-practice problem at the requested evidence band and difficulty. No markdown.'
				},
				{
					role: 'user',
					content: JSON.stringify({
						targetSignal: selection.targetSignal,
						targetArea: selection.targetArea,
						difficulty: selection.difficulty,
						kind,
						learnerGoal,
						placementTestProfile: placementProfile,
						learnerBand,
						requirements:
							kind === 'objective'
								? `${objectiveFormatGuidance} ${levelGuidance} ${placementProfile.taskGuidance}`
								: kind === 'listening_choice'
									? `Return listening_choice with a server-only audioScript whose length and discourse match the requested difficulty, one question, the profile-appropriate number of choices, one unambiguous answer, and an explanation. Do not place the script in the prompt or choices. ${levelGuidance} ${placementProfile.taskGuidance}`
									: `Return only the task prompt. The learner response requirement is “${productiveResponseRequirement}” The task must elicit enough language to evidence the requested difficulty. ${levelGuidance} ${placementProfile.taskGuidance}`
					})
				}
			],
			kind === 'objective'
				? aiObjectiveCandidateSchema
				: kind === 'listening_choice'
					? aiListeningCandidateSchema
					: aiProductiveCandidateSchema
		);
	} catch {
		return fallback('generation_failed');
	}
	if (
		kind === 'objective' &&
		placementProfile.id === 'accuplacer_esl' &&
		'kind' in candidate &&
		(candidate.kind !== 'choice' ||
			!('choices' in candidate) ||
			!Array.isArray(candidate.choices) ||
			candidate.choices.length !== 4)
	) {
		return fallback('profile_format_rejected');
	}
	if (
		kind === 'objective' &&
		placementProfile.id === 'cambridge_cept' &&
		'kind' in candidate &&
		candidate.kind === 'choice' &&
		(!('choices' in candidate) ||
			!Array.isArray(candidate.choices) ||
			candidate.choices.length !== 4)
	) {
		return fallback('profile_format_rejected');
	}
	if (
		kind === 'listening_choice' &&
		'choices' in candidate &&
		Array.isArray(candidate.choices) &&
		candidate.choices.length !== (placementProfile.id === 'cambridge_cept' ? 3 : 4)
	) {
		return fallback('profile_choice_count_rejected');
	}

	let review;
	try {
		review = await runWorkersAiJson(
			runtime,
			[
				{
					role: 'system',
					content: 'Review the supplied ESL problem. Return only the requested JSON booleans.'
				},
				{
					role: 'user',
					content: JSON.stringify({
						targetSignal: selection.targetSignal,
						targetArea: selection.targetArea,
						difficulty: selection.difficulty,
						learnerBand,
						learnerGoal,
						placementTestProfile: placementProfile,
						productiveResponseRequirement,
						candidate,
						checks: [
							'Content directly targets the requested signal.',
							'Content is safe for an adult learner and appropriately demanding for the supplied internal band and requested difficulty.',
							'For an objective item, the keyed answer agrees with the prompt and explanation.',
							'Content matches the named placement-test profile and requested area.',
							'Content is relevant to the learner goal without assuming personal facts.'
						]
					})
				}
			],
			aiReviewSchema
		);
	} catch {
		return fallback('review_failed');
	}
	if (
		!review.targetAligned ||
		!review.levelAppropriate ||
		!review.answerAgrees ||
		!review.examAligned ||
		!review.learnerRelevant
	) {
		return fallback('review_rejected');
	}

	const problem = buildAiProblem(
		candidate,
		selection,
		kind,
		placementProfile,
		sourceResponseItemId
	);
	if (selection.excludeContentId && selection.excludeContentId === problem.id) {
		return fallback('duplicate_content_rejected');
	}

	return {
		problem,
		metadata: generatedMetadata(runtime.provider, runtime.textModelId)
	};
}

export const validatePracticeProblem = (problem: unknown): PracticeProblem =>
	practiceProblemSchema.parse(problem);

export const validatePracticeMetadata = (metadata: unknown): PracticeMetadata =>
	practiceMetadataSchema.parse(metadata);

export const validatePracticeFeedback = (feedback: unknown): PracticeFeedback =>
	practiceFeedbackSchema.parse(feedback);

export const validatePracticeResponse = (response: unknown): PracticeResponse =>
	practiceResponseSchema.parse(response);

const normalizeAnswer = (answer: string) => answer.trim().toLocaleLowerCase('en-US');

const gradeObjectiveResponse = (
	problem: Extract<PracticeProblem, { kind: 'choice' | 'listening_choice' | 'fill' }>,
	response: Extract<PracticeResponse, { kind: 'choice' | 'listening_choice' | 'fill' }>,
	options: { listeningAudioDelivered?: boolean } = {}
): PracticeFeedback => {
	if (problem.kind !== response.kind) throw new PracticeInputError('Response type does not match.');
	const choiceProblem = problem.kind === 'choice' || problem.kind === 'listening_choice';
	const correct = choiceProblem
		? response.answer === problem.answerKey
		: problem.acceptableAnswers.some(
				(answer) => normalizeAnswer(answer) === normalizeAnswer(response.answer)
			);
	const expectedAnswer = choiceProblem
		? problem.choices.find((choice) => choice.id === problem.answerKey)?.text
		: problem.acceptableAnswers[0];
	const learnerAnswer = choiceProblem
		? (problem.choices.find((choice) => choice.id === response.answer)?.text ?? response.answer)
		: response.answer;
	const guide = getLearnerGuide(problem.targetSignal);
	const modalityCanBeScored =
		practiceModalityMatchesTarget(problem) &&
		(problem.targetArea !== 'listening' || options.listeningAudioDelivered === true);
	return {
		kind: 'objective',
		scored: modalityCanBeScored,
		correct,
		message: modalityCanBeScored
			? `${correct ? 'Correct.' : 'Not yet.'} ${problem.explanation}`
			: `Response saved but not scored because the response format did not provide valid ${problem.targetArea.replaceAll('_', ' ')} evidence. ${problem.explanation}`,
		prompt: problem.prompt,
		learnerAnswer,
		explanation: problem.explanation,
		expectedAnswer: expectedAnswer ?? 'Expected answer unavailable.',
		nextStep: correct ? guide.practiceNext : `Retry this skill with a new example. ${guide.hint}`,
		...(problem.kind === 'listening_choice' ? { audioTranscript: problem.audioScript } : {})
	};
};

export const gradePracticeAnswer = (
	problem: PracticeProblem,
	answer: string,
	options: { listeningAudioDelivered?: boolean } = {}
): PracticeFeedback => {
	if (problem.kind !== 'choice' && problem.kind !== 'listening_choice' && problem.kind !== 'fill') {
		return unavailableProductiveFeedback('This response needs rubric feedback.');
	}
	return gradeObjectiveResponse(problem, { kind: problem.kind, answer }, options);
};

const unavailableProductiveFeedback = (reason: string): PracticeFeedback => ({
	kind: 'productive',
	scored: false,
	meetsTarget: null,
	strength: 'Your response was saved.',
	correction: `Automated feedback is unavailable: ${reason}`,
	nextTip: 'Continue with the next problem; this response will not affect adaptation.'
});

const productiveAiFeedbackSchema = z.object({
	meetsTarget: z.boolean(),
	strength: z.string().trim().min(1).max(400),
	correction: z.string().trim().min(1).max(500),
	nextTip: z.string().trim().min(1).max(400)
});

async function gradeProductiveResponse(
	problem: Extract<PracticeProblem, { kind: 'short_text' | 'speaking' }>,
	response: Extract<PracticeResponse, { kind: 'short_text' | 'speaking' }>,
	runtime: WorkersAiRuntime | null
): Promise<{ feedback: PracticeFeedback; fallbackReason?: string }> {
	if (problem.kind !== response.kind) throw new PracticeInputError('Response type does not match.');
	const learnerResponse = response.kind === 'short_text' ? response.text : response.transcript;
	if (response.kind === 'speaking' && response.transcriptSource !== 'workers_ai_asr') {
		return {
			feedback: unavailableProductiveFeedback(
				'typed practice scripts are not valid evidence of speaking ability'
			),
			fallbackReason: 'speaking_transcript_not_audio_derived'
		};
	}
	if (!learnerResponse) {
		return {
			feedback: unavailableProductiveFeedback('no transcript was available'),
			fallbackReason: 'feedback_missing_transcript'
		};
	}
	if (!runtime) {
		return {
			feedback: unavailableProductiveFeedback('the feedback provider is unavailable'),
			fallbackReason: 'feedback_provider_unavailable'
		};
	}
	try {
		const feedback = await runWorkersAiJson(
			runtime,
			[
				{
					role: 'system',
					content:
						'Return only bounded ESL rubric feedback. Judge only evidence in the response; do not score pronunciation.'
				},
				{
					role: 'user',
					content: JSON.stringify({
						targetSignal: problem.targetSignal,
						rubric: problem.rubric,
						learnerResponse,
						responseSeconds: response.kind === 'speaking' ? response.responseSeconds : undefined
					})
				}
			],
			productiveAiFeedbackSchema
		);
		return { feedback: { kind: 'productive', scored: true, ...feedback } };
	} catch {
		return {
			feedback: unavailableProductiveFeedback('feedback could not be validated'),
			fallbackReason: 'feedback_failed'
		};
	}
}

export function toPublicPracticeProblem(
	practiceId: string,
	sessionId: string,
	sequence: number,
	problem: PracticeProblem
): PracticeProblemPublic {
	const common = {
		practiceId,
		sessionId,
		sequence,
		totalProblems: 5 as const,
		targetArea: problem.targetArea,
		targetSignal: problem.targetSignal,
		difficulty: problem.difficulty,
		prompt: problem.prompt
	};
	if (problem.kind === 'choice') {
		return {
			...common,
			kind: problem.kind,
			choices: problem.choices,
			...(problem.placementTaskType ? { placementTaskType: problem.placementTaskType } : {})
		};
	}
	if (problem.kind === 'listening_choice') {
		return {
			...common,
			kind: problem.kind,
			choices: problem.choices,
			placementTaskType: problem.placementTaskType,
			audioUrl: `/practice/audio/${practiceId}`
		};
	}
	if (problem.kind === 'fill') {
		return {
			...common,
			kind: problem.kind,
			...(problem.placementTaskType ? { placementTaskType: problem.placementTaskType } : {})
		};
	}
	return { ...common, kind: problem.kind };
}

type PracticeRow = typeof practiceAttempt.$inferSelect;
type AssessmentRow = typeof assessmentAttempt.$inferSelect;

const storedStatus = (row: PracticeRow) => row.status ?? (row.answer ? 'answered' : 'presented');

const parseStoredRow = (row: PracticeRow) => {
	try {
		return {
			problem: validatePracticeProblem(row.practiceProblemJson),
			metadata: validatePracticeMetadata(row.metadataJson),
			feedback: row.feedbackJson ? validatePracticeFeedback(row.feedbackJson) : null
		};
	} catch (error) {
		throw new PracticeDataError(
			error instanceof Error
				? `Invalid persisted practice data: ${error.message}`
				: 'Invalid persisted practice data.'
		);
	}
};

export async function getPracticeListeningAudioSource(
	db: Db,
	learnerUserId: string,
	practiceIdInput: string
) {
	const practiceId = z.string().uuid().parse(practiceIdInput);
	const [row] = await db
		.select()
		.from(practiceAttempt)
		.where(
			and(eq(practiceAttempt.id, practiceId), eq(practiceAttempt.learnerUserId, learnerUserId))
		)
		.limit(1);
	if (!row) return null;
	const { problem } = parseStoredRow(row);
	if (problem.kind !== 'listening_choice' || problem.targetArea !== 'listening') return null;
	return {
		itemId: problem.id,
		itemVersion: 1,
		script: problem.audioScript,
		metadata: {
			provider: 'workers-ai' as const,
			model: '@cf/deepgram/aura-2-en' as const,
			schemaVersion: 1 as const
		}
	};
}

export async function markPracticeListeningAudioDelivered(
	db: Db,
	learnerUserId: string,
	practiceIdInput: string
) {
	const practiceId = z.string().uuid().parse(practiceIdInput);
	const [row] = await db
		.select()
		.from(practiceAttempt)
		.where(
			and(eq(practiceAttempt.id, practiceId), eq(practiceAttempt.learnerUserId, learnerUserId))
		)
		.limit(1);
	if (!row) return false;
	const { problem, metadata } = parseStoredRow(row);
	if (problem.kind !== 'listening_choice' || problem.targetArea !== 'listening') return false;
	await db
		.update(practiceAttempt)
		.set({ metadataJson: { ...metadata, audioDeliveredAt: new Date().toISOString() } })
		.where(
			and(eq(practiceAttempt.id, practiceId), eq(practiceAttempt.learnerUserId, learnerUserId))
		);
	return true;
}

const historyFromRows = (rows: readonly PracticeRow[]): AdaptiveHistoryEntry[] =>
	rows.map((row) => {
		const { problem, feedback, metadata } = parseStoredRow(row);
		const validModalityEvidence = practiceModalityMatchesTarget(problem);
		const validListeningEvidence =
			problem.targetArea !== 'listening' || Boolean(metadata.audioDeliveredAt);
		const validEvidence = validModalityEvidence && validListeningEvidence;
		return {
			practiceId: row.id,
			sessionId: row.sessionId,
			targetArea: problem.targetArea,
			targetSignal: problem.targetSignal,
			difficulty: problem.difficulty,
			adaptiveReason: problem.adaptiveReason,
			contentId: problem.id,
			scored: (feedback?.scored ?? false) && validEvidence,
			answeredAt: (row.answeredAt ?? row.createdAt).toISOString(),
			correct: !validEvidence
				? null
				: feedback?.kind === 'objective'
					? feedback.correct
					: feedback?.kind === 'productive'
						? feedback.meetsTarget
						: null
		};
	});

async function getLatestCompletedAssessment(db: Db, learnerUserId: string) {
	const attempts = await db
		.select()
		.from(assessmentAttempt)
		.where(eq(assessmentAttempt.learnerUserId, learnerUserId))
		.orderBy(desc(assessmentAttempt.createdAt))
		.limit(20);
	return attempts.find(
		(attempt) => attempt.status === 'completed' && attempt.skillProfileJson && attempt.studyPlanJson
	);
}

const getPracticeRows = (db: Db, learnerUserId: string) =>
	db
		.select()
		.from(practiceAttempt)
		.where(eq(practiceAttempt.learnerUserId, learnerUserId))
		.orderBy(desc(practiceAttempt.createdAt), desc(practiceAttempt.sequence))
		.limit(250)
		.then((rows) => rows.reverse());

type SessionGroup = { sessionId: string; rows: PracticeRow[]; legacy: boolean };

const sessionGroups = (rows: readonly PracticeRow[]): SessionGroup[] => {
	const groups = new Map<string, PracticeRow[]>();
	for (const row of rows) {
		const list = groups.get(row.sessionId) ?? [];
		list.push(row);
		groups.set(row.sessionId, list);
	}
	return [...groups.entries()]
		.map(([sessionId, sessionRows]) => ({
			sessionId,
			rows: sessionRows.sort((left, right) => left.sequence - right.sequence),
			legacy:
				sessionRows.length === 1 &&
				sessionRows[0].id === sessionId &&
				sessionRows[0].sequence === 1 &&
				storedStatus(sessionRows[0]) === 'answered'
		}))
		.sort((left, right) => {
			const leftDate = Math.max(...left.rows.map((row) => row.createdAt.getTime()));
			const rightDate = Math.max(...right.rows.map((row) => row.createdAt.getTime()));
			return leftDate - rightDate;
		});
};

const isCompleteSession = (group: SessionGroup) =>
	group.rows.length === 5 && group.rows.every((row) => storedStatus(row) === 'answered');

const publicPlacementProfile = (assessment: AssessmentRow) => {
	const profile = inferPlacementTestProfile(
		assessment.intakeJson.goal,
		assessment.intakeJson.placementTest
	);
	return { id: profile.id, label: profile.label, sections: profile.sections };
};

const displayStoredAnswer = (problem: PracticeProblem, storedAnswer: string | null) => {
	if (!storedAnswer) return 'No response was saved.';
	let value: unknown = storedAnswer;
	try {
		value = JSON.parse(storedAnswer);
	} catch {
		// Legacy objective attempts stored the answer directly.
	}
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		const answer = String(value);
		return problem.kind === 'choice' || problem.kind === 'listening_choice'
			? (problem.choices.find((choice) => choice.id === answer)?.text ?? answer)
			: answer;
	}
	const response = value as Record<string, unknown>;
	if (
		(problem.kind === 'choice' || problem.kind === 'listening_choice') &&
		typeof response.answer === 'string'
	) {
		return problem.choices.find((choice) => choice.id === response.answer)?.text ?? response.answer;
	}
	if (problem.kind === 'fill' && typeof response.answer === 'string') return response.answer;
	if (problem.kind === 'short_text' && typeof response.text === 'string') return response.text;
	if (problem.kind === 'speaking') {
		if (typeof response.transcript === 'string') return response.transcript;
		if (typeof response.responseSeconds === 'number') {
			return `Audio response (${response.responseSeconds} seconds); transcript unavailable.`;
		}
	}
	return 'Saved response could not be displayed.';
};

const expectedAnswerFor = (problem: PracticeProblem) => {
	if (problem.kind === 'choice' || problem.kind === 'listening_choice') {
		return (
			problem.choices.find((choice) => choice.id === problem.answerKey)?.text ??
			'Expected answer unavailable.'
		);
	}
	if (problem.kind === 'fill') return problem.acceptableAnswers[0];
	return 'Open response — there is no single correct answer.';
};

export const buildPracticeReview = (
	problem: PracticeProblem,
	storedAnswer: string | null,
	feedback: PracticeFeedback
) => {
	const guide = getLearnerGuide(problem.targetSignal);
	return {
		prompt: problem.prompt,
		learnerAnswer: displayStoredAnswer(problem, storedAnswer),
		expectedAnswer: expectedAnswerFor(problem),
		explanation:
			feedback.kind === 'objective' && 'explanation' in problem
				? problem.explanation
				: feedback.kind === 'productive'
					? feedback.correction
					: 'Explanation unavailable.',
		nextStep:
			feedback.kind === 'objective' ? (feedback.nextStep ?? guide.practiceNext) : feedback.nextTip
	};
};

const sessionResults = (rows: readonly PracticeRow[]) =>
	rows.flatMap((row) => {
		const { problem, feedback } = parseStoredRow(row);
		return feedback
			? [
					{
						practiceId: row.id,
						sequence: row.sequence,
						targetArea: problem.targetArea,
						targetSignal: problem.targetSignal,
						difficulty: problem.difficulty,
						...(problem.kind === 'listening_choice'
							? {
									audioUrl: `/practice/audio/${row.id}`,
									audioTranscript: problem.audioScript
								}
							: {}),
						...buildPracticeReview(problem, row.answer, feedback),
						feedback
					}
				]
			: [];
	});

const sessionState = (assessment: AssessmentRow, group?: SessionGroup): PracticeSessionState => {
	if (!group) {
		return {
			assessmentAttemptId: assessment.id,
			placementProfile: publicPlacementProfile(assessment),
			sessionId: null,
			completedCount: 0,
			totalProblems: 5,
			completed: false,
			problem: null,
			results: []
		};
	}
	const pending = group.rows.find((row) => storedStatus(row) === 'presented');
	let problem: PracticeProblemPublic | null = null;
	if (pending) {
		const stored = parseStoredRow(pending);
		problem = toPublicPracticeProblem(
			pending.id,
			pending.sessionId,
			pending.sequence,
			stored.problem
		);
	}
	return {
		assessmentAttemptId: assessment.id,
		placementProfile: publicPlacementProfile(assessment),
		sessionId: group.sessionId,
		completedCount: group.rows.filter((row) => storedStatus(row) === 'answered').length,
		totalProblems: 5,
		completed: isCompleteSession(group),
		problem,
		results: sessionResults(group.rows)
	};
};

export type PracticeSessionState = {
	assessmentAttemptId: string;
	placementProfile: {
		id: PracticePlacementProfile['id'];
		label: string;
		sections: string[];
	};
	sessionId: string | null;
	completedCount: number;
	totalProblems: 5;
	completed: boolean;
	problem: PracticeProblemPublic | null;
	results: {
		practiceId: string;
		sequence: number;
		targetArea: AssessmentArea;
		targetSignal: ErrorSignal;
		difficulty: PracticeDifficulty;
		audioUrl?: string;
		audioTranscript?: string;
		prompt: string;
		learnerAnswer: string;
		expectedAnswer: string;
		explanation: string;
		nextStep: string;
		feedback: PracticeFeedback;
	}[];
};

export async function getPracticeSession(
	db: Db,
	learnerUserId: string
): Promise<PracticeSessionState | null> {
	const assessment = await getLatestCompletedAssessment(db, learnerUserId);
	if (!assessment) return null;
	const rows = (await getPracticeRows(db, learnerUserId)).filter(
		(row) => row.assessmentAttemptId === assessment.id
	);
	const latest = sessionGroups(rows)
		.filter((group) => !group.legacy)
		.at(-1);
	return sessionState(assessment, latest);
}

export async function startPracticeSession(
	db: Db,
	learnerUserId: string
): Promise<PracticeSessionState | null> {
	const assessment = await getLatestCompletedAssessment(db, learnerUserId);
	if (!assessment?.skillProfileJson || !assessment.studyPlanJson) return null;
	const allRows = await getPracticeRows(db, learnerUserId);
	const stalePresented = allRows.find(
		(row) => row.assessmentAttemptId !== assessment.id && storedStatus(row) === 'presented'
	);
	if (stalePresented) {
		const { metadata } = parseStoredRow(stalePresented);
		await db
			.update(practiceAttempt)
			.set({
				status: 'answered',
				answer: null,
				feedbackJson: unavailableProductiveFeedback(
					'this problem was superseded by a newer Skill Diagnosis'
				),
				metadataJson: { ...metadata, fallbackReason: 'superseded_by_reassessment' },
				answeredAt: new Date()
			})
			.where(
				and(
					eq(practiceAttempt.id, stalePresented.id),
					eq(practiceAttempt.learnerUserId, learnerUserId),
					eq(practiceAttempt.status, 'presented')
				)
			);
	}
	const rows = allRows.filter((row) => row.assessmentAttemptId === assessment.id);
	const groups = sessionGroups(rows).filter((group) => !group.legacy);
	const latest = groups.at(-1);
	if (latest && !isCompleteSession(latest)) {
		const pending = latest.rows.find((row) => storedStatus(row) === 'presented');
		if (pending) return sessionState(assessment, latest);
	}

	const current = latest && !isCompleteSession(latest) ? latest : undefined;
	const sequence = current ? Math.max(...current.rows.map((row) => row.sequence)) + 1 : 1;
	if (sequence > 5) throw new PracticeDataError('Practice session has an invalid sequence.');
	const sessionId = current?.sessionId ?? crypto.randomUUID();
	const history = historyFromRows(rows);
	const selection = selectNextPracticeTarget({
		skillProfile: assessment.skillProfileJson,
		studyPlan: assessment.studyPlanJson,
		history
	});
	const kind = practiceKindForTarget(selection.targetArea);
	const generated = await generatePracticeProblem({
		skillProfile: assessment.skillProfileJson,
		studyPlan: assessment.studyPlanJson,
		learnerGoal: assessment.intakeJson.goal,
		placementProfile: inferPlacementTestProfile(
			assessment.intakeJson.goal,
			assessment.intakeJson.placementTest
		),
		recentResponses: assessment.responsesJson,
		history,
		selection,
		kind
	});
	const practiceId = crypto.randomUUID();

	try {
		await db.insert(practiceAttempt).values({
			id: practiceId,
			learnerUserId,
			assessmentAttemptId: assessment.id,
			status: 'presented',
			sessionId,
			sequence,
			practiceProblemJson: generated.problem,
			answer: null,
			feedbackJson: null,
			metadataJson: generated.metadata,
			answeredAt: null
		});
	} catch (error) {
		const existing = await getPracticeSession(db, learnerUserId);
		if (existing?.problem) return existing;
		throw error;
	}

	return {
		assessmentAttemptId: assessment.id,
		placementProfile: publicPlacementProfile(assessment),
		sessionId,
		completedCount: current?.rows.filter((row) => storedStatus(row) === 'answered').length ?? 0,
		totalProblems: 5,
		completed: false,
		problem: toPublicPracticeProblem(practiceId, sessionId, sequence, generated.problem),
		results: current ? sessionResults(current.rows) : []
	};
}

export async function submitPracticeResponse(
	db: Db,
	learnerUserId: string,
	input: { practiceId: string; response: PracticeResponse },
	options: {
		runtime?: WorkersAiRuntime | null;
		resolveSpeakingResponse?: (
			response: Extract<PracticeResponse, { kind: 'speaking' }>
		) => Promise<Extract<PracticeResponse, { kind: 'speaking' }>>;
	} = {}
) {
	const practiceId = z.string().uuid().parse(input.practiceId);
	let response = validatePracticeResponse(input.response);
	const [row] = await db
		.select()
		.from(practiceAttempt)
		.where(
			and(eq(practiceAttempt.id, practiceId), eq(practiceAttempt.learnerUserId, learnerUserId))
		)
		.limit(1);
	if (!row) throw new PracticeNotFoundError('Practice problem was not found.');
	if (storedStatus(row) !== 'presented') {
		throw new PracticeConflictError('Practice problem has already been answered.');
	}
	const assessment = await getLatestCompletedAssessment(db, learnerUserId);
	if (!assessment || row.assessmentAttemptId !== assessment.id) {
		throw new PracticeConflictError('Practice problem belongs to an older Skill Diagnosis.');
	}
	const { problem, metadata } = parseStoredRow(row);
	if (problem.kind !== response.kind) throw new PracticeInputError('Response type does not match.');
	const shouldResolveSpeaking =
		problem.kind === 'speaking' &&
		response.kind === 'speaking' &&
		options.resolveSpeakingResponse !== undefined;
	const initialFeedback =
		problem.kind === 'choice' || problem.kind === 'listening_choice' || problem.kind === 'fill'
			? gradeObjectiveResponse(
					problem,
					response as Extract<PracticeResponse, { kind: 'choice' | 'listening_choice' | 'fill' }>,
					{ listeningAudioDelivered: Boolean(metadata.audioDeliveredAt) }
				)
			: unavailableProductiveFeedback(
					shouldResolveSpeaking
						? 'speaking transcription did not finish'
						: 'feedback is still being prepared'
				);
	const answeredAt = new Date();
	// Claim the attempt before invoking ASR. If this request stops here, the learner still has
	// an honest, unscored result instead of a presented row that would block the whole session.
	const claimed = await db
		.update(practiceAttempt)
		.set({
			status: 'answered',
			answer: JSON.stringify(response),
			feedbackJson: initialFeedback,
			metadataJson: shouldResolveSpeaking
				? { ...metadata, fallbackReason: 'processing_interrupted' }
				: metadata,
			answeredAt
		})
		.where(
			and(
				eq(practiceAttempt.id, practiceId),
				eq(practiceAttempt.learnerUserId, learnerUserId),
				eq(practiceAttempt.status, 'presented')
			)
		)
		.returning({ id: practiceAttempt.id });
	if (!claimed.length) {
		throw new PracticeConflictError('Practice problem has already been answered.');
	}

	let feedback = initialFeedback;
	if (shouldResolveSpeaking) {
		try {
			response = validatePracticeResponse(
				await options.resolveSpeakingResponse!(
					response as Extract<PracticeResponse, { kind: 'speaking' }>
				)
			);
			if (response.kind !== 'speaking')
				throw new PracticeInputError('Response type does not match.');
		} catch {
			feedback = unavailableProductiveFeedback('speaking transcription could not be completed');
			await db
				.update(practiceAttempt)
				.set({
					feedbackJson: feedback,
					metadataJson: { ...metadata, fallbackReason: 'transcription_failed' }
				})
				.where(
					and(
						eq(practiceAttempt.id, practiceId),
						eq(practiceAttempt.learnerUserId, learnerUserId),
						eq(practiceAttempt.status, 'answered')
					)
				);
			return {
				practiceId,
				sessionId: row.sessionId,
				sequence: row.sequence,
				completed: row.sequence === 5,
				feedback
			};
		}
	}
	if (problem.kind === 'short_text' || problem.kind === 'speaking') {
		const runtime = options.runtime === undefined ? getWorkersAiRuntime() : options.runtime;
		const graded = await gradeProductiveResponse(
			problem,
			response as Extract<PracticeResponse, { kind: 'short_text' | 'speaking' }>,
			runtime
		);
		feedback = graded.feedback;
		await db
			.update(practiceAttempt)
			.set({
				answer: JSON.stringify(response),
				feedbackJson: feedback,
				metadataJson: graded.fallbackReason
					? { ...metadata, fallbackReason: graded.fallbackReason }
					: metadata
			})
			.where(
				and(
					eq(practiceAttempt.id, practiceId),
					eq(practiceAttempt.learnerUserId, learnerUserId),
					eq(practiceAttempt.status, 'answered')
				)
			);
	}

	return {
		practiceId,
		sessionId: row.sessionId,
		sequence: row.sequence,
		completed: row.sequence === 5,
		feedback
	};
}

export type ReassessmentOptions = {
	targets?: readonly { area: AssessmentArea; signal: ErrorSignal }[];
	completedSessions?: number;
	minimumCompletedSessions?: number;
	minimumResponsesPerTarget?: number;
};

export const getReassessmentProgress = (
	history: readonly AdaptiveHistoryEntry[],
	threshold = 20,
	options: ReassessmentOptions = {}
) => {
	const contentExposureCounts = new Map<string, number>();
	const scored = history.filter((entry) => {
		if (!entry.scored || entry.correct === null) return false;
		const key = `${practiceTargetKey(entry.targetArea, entry.targetSignal)}:${entry.contentId}`;
		const exposures = contentExposureCounts.get(key) ?? 0;
		contentExposureCounts.set(key, exposures + 1);
		return exposures < 2;
	});
	const configuredTargets = options.targets?.length
		? options.targets
		: scored.map((entry) => ({ area: entry.targetArea, signal: entry.targetSignal }));
	const targets = configuredTargets.filter(
		(target, index) =>
			configuredTargets.findIndex(
				(other) => other.area === target.area && other.signal === target.signal
			) === index
	);
	const effectiveThreshold = targets.length ? Math.min(threshold, targets.length * 8) : threshold;
	const minimumResponsesPerTarget =
		options.minimumResponsesPerTarget ??
		Math.max(2, Math.floor(effectiveThreshold / Math.max(1, targets.length * 2)));
	const targetEvidence = targets.map((target) => {
		const targetScored = scored.filter(
			(entry) => entry.targetArea === target.area && entry.targetSignal === target.signal
		);
		const scoredCount = targetScored.length;
		const distinctContentCount = new Set(targetScored.map((entry) => entry.contentId)).size;
		const minimumDistinctContent = Math.min(2, minimumResponsesPerTarget);
		return {
			targetArea: target.area,
			targetSignal: target.signal,
			scoredCount,
			distinctContentCount,
			minimum: minimumResponsesPerTarget,
			minimumDistinctContent,
			ready:
				scoredCount >= minimumResponsesPerTarget && distinctContentCount >= minimumDistinctContent
		};
	});
	const completedSessions =
		options.completedSessions ??
		new Set(scored.map((entry) => entry.sessionId).filter((sessionId) => sessionId)).size;
	const requiredSessions =
		options.minimumCompletedSessions ?? Math.max(2, Math.ceil(effectiveThreshold / 5));
	const scoredCount = scored.length;
	const coveredTargets = targetEvidence.filter((target) => target.ready).length;
	const totalEvidenceReady = scoredCount >= effectiveThreshold;
	const distributedEvidenceReady =
		targetEvidence.length > 0 && coveredTargets === targetEvidence.length;
	const sessionEvidenceReady = completedSessions >= requiredSessions;
	return {
		scoredCount,
		threshold: effectiveThreshold,
		remaining: Math.max(0, effectiveThreshold - scoredCount),
		coveredTargets,
		requiredTargets: targetEvidence.length,
		completedSessions,
		requiredSessions,
		minimumResponsesPerTarget,
		targetEvidence,
		totalEvidenceReady,
		distributedEvidenceReady,
		sessionEvidenceReady,
		recommended: totalEvidenceReady && distributedEvidenceReady && sessionEvidenceReady
	};
};

export async function getPracticeProgress(db: Db, learnerUserId: string) {
	const assessment = await getLatestCompletedAssessment(db, learnerUserId);
	if (!assessment?.studyPlanJson) return null;
	const rows = (await getPracticeRows(db, learnerUserId)).filter(
		(row) => row.assessmentAttemptId === assessment.id
	);
	const history = historyFromRows(rows);
	const groups = sessionGroups(rows);
	const progress = getReassessmentProgress(
		history,
		assessment.studyPlanJson.reassessAfterPracticeCount ?? 20,
		{
			targets: assessment.studyPlanJson.targets,
			completedSessions: groups.filter((group) => !group.legacy && isCompleteSession(group)).length
		}
	);
	return {
		assessmentAttemptId: assessment.id,
		reassessmentContext: {
			assessmentAttemptId: assessment.id,
			recommended: progress.recommended
		},
		...progress
	};
}

// Backward-compatible names for the prototype route while it moves to opaque practice IDs.
export async function getLatestPracticeProblem(db: Db, learnerUserId: string) {
	const session = await startPracticeSession(db, learnerUserId);
	return session?.problem
		? { assessmentAttemptId: session.assessmentAttemptId, problem: session.problem }
		: null;
}

export async function savePracticeAttempt(
	db: Db,
	learnerUserId: string,
	answer: string,
	submitted?: { problem: PracticeProblem; metadata: PracticeMetadata }
) {
	void submitted;
	const session = await startPracticeSession(db, learnerUserId);
	if (!session?.problem) return null;
	if (
		session.problem.kind !== 'choice' &&
		session.problem.kind !== 'listening_choice' &&
		session.problem.kind !== 'fill'
	) {
		throw new PracticeInputError('Use a typed productive response for this problem.');
	}
	const result = await submitPracticeResponse(db, learnerUserId, {
		practiceId: session.problem.practiceId,
		response: { kind: session.problem.kind, answer }
	});
	return {
		assessmentAttemptId: session.assessmentAttemptId,
		problem: session.problem,
		answer,
		feedback: result.feedback
	};
}
