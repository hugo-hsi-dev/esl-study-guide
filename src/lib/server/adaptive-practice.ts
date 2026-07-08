import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getSeedAssessmentItems, type AssessmentArea, type ErrorSignal } from './assessment-items';
import type { Db } from './db';
import { assessmentAttempt, practiceAttempt, type AttemptResponse } from './db/schema';
import type { SkillProfile, StudyPlan } from './assessment-diagnosis';
import { getWorkersAiRuntime, runWorkersAiJson } from './workers-ai';

export type PracticeProblem = {
	id: string;
	targetArea: AssessmentArea;
	targetSignal: ErrorSignal;
	sourceResponseItemId?: string;
	prompt: string;
	choices: { id: string; text: string }[];
	answerKey: string;
	explanation: string;
	difficulty: 'easy';
};

export type PracticeFeedback = {
	correct: boolean;
	message: string;
};

export type PracticeMetadata = {
	schemaVersion: 1;
	provider: 'local' | 'workers-ai';
	model: string;
	modelVersion: '2026-07-08';
};

type PracticeGenerationInput = {
	skillProfile: SkillProfile;
	studyPlan: StudyPlan;
	recentResponses?: AttemptResponse[];
};

const defaultAreaBySignal: Record<ErrorSignal, AssessmentArea> = {
	main_idea: 'reading',
	detail: 'listening',
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

const problems: Record<ErrorSignal, Omit<PracticeProblem, 'id' | 'targetArea' | 'targetSignal'>> = {
	main_idea: {
		prompt: 'What is the main idea? "Mina missed the bus, so she walked to work."',
		choices: [
			{ id: 'a', text: 'Mina went to work.' },
			{ id: 'b', text: 'Mina bought a bus.' },
			{ id: 'c', text: 'Mina stayed home.' }
		],
		answerKey: 'a',
		explanation: 'The sentence is mainly about Mina getting to work.',
		difficulty: 'easy'
	},
	detail: {
		prompt: 'Which detail is correct? "The class starts at 9:15 on Monday."',
		choices: [
			{ id: 'a', text: 'It starts at 9:15.' },
			{ id: 'b', text: 'It starts on Friday.' },
			{ id: 'c', text: 'It starts at 8:00.' }
		],
		answerKey: 'a',
		explanation: 'The detail in the sentence is 9:15.',
		difficulty: 'easy'
	},
	vocabulary_in_context: {
		prompt: 'What does "early" mean? "I arrived early, so I waited outside."',
		choices: [
			{ id: 'a', text: 'before the planned time' },
			{ id: 'b', text: 'very angry' },
			{ id: 'c', text: 'after the planned time' }
		],
		answerKey: 'a',
		explanation: '"Early" means before the planned time.',
		difficulty: 'easy'
	},
	verb_form: {
		prompt: 'Choose the best sentence.',
		choices: [
			{ id: 'a', text: 'He work in a restaurant.' },
			{ id: 'b', text: 'He works in a restaurant.' },
			{ id: 'c', text: 'He working in a restaurant.' }
		],
		answerKey: 'b',
		explanation: 'Use "works" with "he" in the simple present.',
		difficulty: 'easy'
	},
	subject_verb_agreement: {
		prompt: 'Choose the best sentence.',
		choices: [
			{ id: 'a', text: 'She likes tea.' },
			{ id: 'b', text: 'She like tea.' },
			{ id: 'c', text: 'She liking tea.' }
		],
		answerKey: 'a',
		explanation: 'Use "likes" with "she" in the simple present.',
		difficulty: 'easy'
	},
	article_determiner: {
		prompt: 'Choose the best sentence.',
		choices: [
			{ id: 'a', text: 'I went to store.' },
			{ id: 'b', text: 'I went to the store.' },
			{ id: 'c', text: 'I went to a milk.' }
		],
		answerKey: 'b',
		explanation: 'Use "the" when talking about a known store.',
		difficulty: 'easy'
	},
	plural_countability: {
		prompt: 'Choose the best sentence.',
		choices: [
			{ id: 'a', text: 'I bought two apple.' },
			{ id: 'b', text: 'I bought two apples.' },
			{ id: 'c', text: 'I bought two water.' }
		],
		answerKey: 'b',
		explanation: 'Use plural "apples" after "two".',
		difficulty: 'easy'
	},
	preposition: {
		prompt: 'Choose the best sentence.',
		choices: [
			{ id: 'a', text: 'I live in New York.' },
			{ id: 'b', text: 'I live at New York.' },
			{ id: 'c', text: 'I live on New York.' }
		],
		answerKey: 'a',
		explanation: 'Use "in" with cities.',
		difficulty: 'easy'
	},
	pronoun_choice: {
		prompt: 'Choose the best sentence.',
		choices: [
			{ id: 'a', text: 'Maria is my friend. She is kind.' },
			{ id: 'b', text: 'Maria is my friend. He is kind.' },
			{ id: 'c', text: 'Maria is my friend. It is kind.' }
		],
		answerKey: 'a',
		explanation: 'Use "she" for Maria in this sentence.',
		difficulty: 'easy'
	},
	sentence_control: {
		prompt: 'Choose the clearest sentence.',
		choices: [
			{ id: 'a', text: 'I was tired I slept early.' },
			{ id: 'b', text: 'I was tired, so I slept early.' },
			{ id: 'c', text: 'I tired slept early was.' }
		],
		answerKey: 'b',
		explanation: 'The sentence connects two ideas clearly.',
		difficulty: 'easy'
	},
	collocation: {
		prompt: 'Choose the natural phrase.',
		choices: [
			{ id: 'a', text: 'make homework' },
			{ id: 'b', text: 'do homework' },
			{ id: 'c', text: 'take homework' }
		],
		answerKey: 'b',
		explanation: 'English usually says "do homework".',
		difficulty: 'easy'
	},
	task_completion: {
		prompt: 'Which answer completes the task: "Tell one thing you bought and why."',
		choices: [
			{ id: 'a', text: 'I bought shoes because mine were old.' },
			{ id: 'b', text: 'Shopping.' },
			{ id: 'c', text: 'Because yesterday.' }
		],
		answerKey: 'a',
		explanation: 'The answer names the item and gives a reason.',
		difficulty: 'easy'
	},
	clarity: {
		prompt: 'Choose the clearest answer.',
		choices: [
			{ id: 'a', text: 'Yesterday problem bus late.' },
			{ id: 'b', text: 'The bus was late yesterday.' },
			{ id: 'c', text: 'Late was bus the.' }
		],
		answerKey: 'b',
		explanation: 'This answer has clear word order.',
		difficulty: 'easy'
	},
	fluency: {
		prompt: 'Choose the complete spoken answer.',
		choices: [
			{ id: 'a', text: 'I bought a notebook because I need it for class.' },
			{ id: 'b', text: 'Notebook.' },
			{ id: 'c', text: 'Because, um, thing.' }
		],
		answerKey: 'a',
		explanation: 'This is a complete short answer.',
		difficulty: 'easy'
	}
};

export const practiceMetadata: PracticeMetadata = {
	schemaVersion: 1,
	provider: 'local',
	model: 'deterministic-practice',
	modelVersion: '2026-07-08'
};

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

const practiceProblemSchema = z
	.object({
		id: z.string().trim().min(1).max(80),
		targetArea: z.enum([
			'listening',
			'reading',
			'grammar_usage',
			'vocabulary',
			'writing',
			'speaking'
		] as const satisfies readonly AssessmentArea[]),
		targetSignal: z.enum(errorSignals),
		sourceResponseItemId: z.string().trim().min(1).optional(),
		prompt: z.string().trim().min(1).max(500),
		choices: z
			.array(
				z.object({
					id: z.string().trim().min(1).max(8),
					text: z.string().trim().min(1).max(200)
				})
			)
			.min(2)
			.max(4),
		answerKey: z.string().trim().min(1).max(8),
		explanation: z.string().trim().min(1).max(500),
		difficulty: z.literal('easy')
	})
	.refine((problem) => problem.choices.some((choice) => choice.id === problem.answerKey), {
		message: 'Practice problem answer key must match a choice.'
	}) satisfies z.ZodType<PracticeProblem>;

const practiceMetadataSchema = z.object({
	schemaVersion: z.literal(1),
	provider: z.enum(['local', 'workers-ai']),
	model: z.string().trim().min(1),
	modelVersion: z.literal('2026-07-08')
}) satisfies z.ZodType<PracticeMetadata>;

const practiceContextFrom = ({
	skillProfile,
	studyPlan,
	recentResponses = []
}: PracticeGenerationInput) => {
	const items = new Map(getSeedAssessmentItems().map((item) => [item.id, item]));
	const targetSignal =
		studyPlan.targetSignals[0] ?? skillProfile.priorityWeaknesses[0]?.signal ?? 'verb_form';
	const responseHasTargetSignal = (response: AttemptResponse) => {
		const signals = items.get(response.itemId)?.errorSignalTags as
			readonly ErrorSignal[] | undefined;
		return signals?.includes(targetSignal) ?? false;
	};
	const targetArea =
		skillProfile.priorityWeaknesses.find((weakness) => weakness.signal === targetSignal)?.area ??
		recentResponses.find(responseHasTargetSignal)?.area ??
		defaultAreaBySignal[targetSignal];
	const sourceResponse = recentResponses.find(
		(response) => response.area === targetArea && responseHasTargetSignal(response)
	);
	return { targetSignal, targetArea, sourceResponseItemId: sourceResponse?.itemId };
};

const generateDeterministicPracticeProblem = (input: PracticeGenerationInput): PracticeProblem => {
	const { targetSignal, targetArea, sourceResponseItemId } = practiceContextFrom(input);
	return validatePracticeProblem({
		id: `practice-${targetSignal}-1`,
		targetArea,
		targetSignal,
		sourceResponseItemId,
		...problems[targetSignal]
	});
};

export const generatePracticeProblem = async (
	input: PracticeGenerationInput
): Promise<{ problem: PracticeProblem; metadata: PracticeMetadata }> => {
	const deterministic = {
		problem: generateDeterministicPracticeProblem(input),
		metadata: practiceMetadata
	};
	const runtime = getWorkersAiRuntime();
	if (!runtime) return deterministic;

	const { targetSignal, targetArea, sourceResponseItemId } = practiceContextFrom(input);
	let problem;
	try {
		problem = await runWorkersAiJson(
			runtime,
			[
				{
					role: 'system',
					content:
						'Return only JSON for one beginner ESL multiple-choice practice problem. No markdown.'
				},
				{
					role: 'user',
					content: JSON.stringify({
						targetSignal,
						targetArea,
						sourceResponseItemId,
						...input,
						requirements: [
							'Use the targetSignal exactly.',
							'Use the targetArea exactly.',
							'Use difficulty "easy".',
							'Use 3 choices with short ids like a, b, c.',
							'Make the answerKey equal one choice id.',
							'Use daily-life ESL content suitable for adult beginners.'
						]
					})
				}
			],
			practiceProblemSchema
		);
	} catch {
		return deterministic;
	}

	return {
		problem: validatePracticeProblem({
			...problem,
			targetSignal,
			targetArea,
			sourceResponseItemId
		}),
		metadata: {
			schemaVersion: 1,
			provider: runtime.provider,
			model: runtime.textModelId,
			modelVersion: '2026-07-08'
		}
	};
};

export const validatePracticeProblem = (problem: PracticeProblem) => {
	return practiceProblemSchema.parse(problem);
};

export const validatePracticeMetadata = (metadata: PracticeMetadata) => {
	return practiceMetadataSchema.parse(metadata);
};

export const gradePracticeAnswer = (problem: PracticeProblem, answer: string): PracticeFeedback => {
	const correct = answer === problem.answerKey;
	return {
		correct,
		message: correct ? 'Correct. ' + problem.explanation : 'Not yet. ' + problem.explanation
	};
};

export async function getLatestPracticeProblem(db: Db, learnerUserId: string) {
	const attempt = await getLatestAssessmentAttempt(db, learnerUserId);
	if (!attempt?.skillProfileJson || !attempt.studyPlanJson) return null;

	const generated = await generatePracticeProblem({
		skillProfile: attempt.skillProfileJson,
		studyPlan: attempt.studyPlanJson,
		recentResponses: attempt.responsesJson
	});
	return {
		assessmentAttemptId: attempt.id,
		...generated
	};
}

async function getLatestAssessmentAttempt(db: Db, learnerUserId: string) {
	const [attempt] = await db
		.select()
		.from(assessmentAttempt)
		.where(eq(assessmentAttempt.learnerUserId, learnerUserId))
		.orderBy(desc(assessmentAttempt.createdAt))
		.limit(1);

	return attempt;
}

export async function savePracticeAttempt(
	db: Db,
	learnerUserId: string,
	answer: string,
	submitted?: { problem: PracticeProblem; metadata: PracticeMetadata }
) {
	const latest = await getLatestAssessmentAttempt(db, learnerUserId);
	if (!latest?.skillProfileJson || !latest.studyPlanJson) return null;

	const generated =
		submitted ??
		(await generatePracticeProblem({
			skillProfile: latest.skillProfileJson,
			studyPlan: latest.studyPlanJson,
			recentResponses: latest.responsesJson
		}));
	const problem = validatePracticeProblem(generated.problem);
	const metadata = validatePracticeMetadata(generated.metadata);

	const feedback = gradePracticeAnswer(problem, answer);
	await db.insert(practiceAttempt).values({
		learnerUserId,
		assessmentAttemptId: latest.id,
		practiceProblemJson: problem,
		answer,
		feedbackJson: feedback,
		metadataJson: metadata
	});

	return { assessmentAttemptId: latest.id, problem, metadata, answer, feedback };
}
