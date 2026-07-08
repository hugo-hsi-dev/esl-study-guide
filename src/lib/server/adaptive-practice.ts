import { desc, eq } from 'drizzle-orm';
import { getSeedAssessmentItems, type AssessmentArea, type ErrorSignal } from './assessment-items';
import type { Db } from './db';
import { assessmentAttempt, practiceAttempt, type AttemptResponse } from './db/schema';
import type { SkillProfile, StudyPlan } from './assessment-diagnosis';

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
	model: 'deterministic-practice';
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
	model: 'deterministic-practice',
	modelVersion: '2026-07-08'
};

export const generatePracticeProblem = ({
	skillProfile,
	studyPlan,
	recentResponses = []
}: PracticeGenerationInput): PracticeProblem => {
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

	return validatePracticeProblem({
		id: `practice-${targetSignal}-1`,
		targetArea,
		targetSignal,
		sourceResponseItemId: sourceResponse?.itemId,
		...problems[targetSignal]
	});
};

export const validatePracticeProblem = (problem: PracticeProblem) => {
	if (!problem.targetArea || !problem.targetSignal) {
		throw new Error(`Practice problem ${problem.id} is missing its target skill or signal.`);
	}
	if (!problem.choices.some((choice) => choice.id === problem.answerKey)) {
		throw new Error(`Practice problem ${problem.id} is missing its answer key choice.`);
	}
	if (!problem.prompt || !problem.explanation || !problem.difficulty) {
		throw new Error(`Practice problem ${problem.id} is incomplete.`);
	}
	return problem;
};

export const gradePracticeAnswer = (problem: PracticeProblem, answer: string): PracticeFeedback => {
	const correct = answer === problem.answerKey;
	return {
		correct,
		message: correct ? 'Correct. ' + problem.explanation : 'Not yet. ' + problem.explanation
	};
};

export async function getLatestPracticeProblem(db: Db, learnerUserId: string) {
	const [attempt] = await db
		.select()
		.from(assessmentAttempt)
		.where(eq(assessmentAttempt.learnerUserId, learnerUserId))
		.orderBy(desc(assessmentAttempt.createdAt))
		.limit(1);

	if (!attempt?.skillProfileJson || !attempt.studyPlanJson) return null;

	return {
		assessmentAttemptId: attempt.id,
		problem: generatePracticeProblem({
			skillProfile: attempt.skillProfileJson,
			studyPlan: attempt.studyPlanJson,
			recentResponses: attempt.responsesJson
		})
	};
}

export async function savePracticeAttempt(db: Db, learnerUserId: string, answer: string) {
	const latest = await getLatestPracticeProblem(db, learnerUserId);
	if (!latest) return null;

	const feedback = gradePracticeAnswer(latest.problem, answer);
	await db.insert(practiceAttempt).values({
		learnerUserId,
		assessmentAttemptId: latest.assessmentAttemptId,
		practiceProblemJson: latest.problem,
		answer,
		feedbackJson: feedback,
		metadataJson: practiceMetadata
	});

	return { ...latest, answer, feedback };
}
