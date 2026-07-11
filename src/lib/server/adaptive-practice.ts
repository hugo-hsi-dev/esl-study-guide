import { asc, desc, eq } from 'drizzle-orm';
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

export type PracticeHistoryEntry = {
	practiceProblemJson: PracticeProblem;
	feedbackJson: PracticeFeedback;
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
	practiceHistory?: PracticeHistoryEntry[];
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

type CuratedPracticeVariant = Omit<
	PracticeProblem,
	'id' | 'targetArea' | 'targetSignal' | 'sourceResponseItemId'
> & {
	supportive: boolean;
};

const variant = (
	prompt: string,
	choices: PracticeProblem['choices'],
	answerKey: string,
	explanation: string,
	supportive = false
): CuratedPracticeVariant => ({
	prompt,
	choices,
	answerKey,
	explanation,
	difficulty: 'easy',
	supportive
});

// Variants deliberately use different everyday situations and language forms. The second and
// third are more scaffolded so a missed answer can lead to a new, supportive example.
const problems: Record<ErrorSignal, readonly CuratedPracticeVariant[]> = {
	main_idea: [
		variant(
			'Read: "Ravi forgot his lunch, so he bought a sandwich near work." What is the main idea?',
			[
				{ id: 'a', text: 'Ravi got food for lunch.' },
				{ id: 'b', text: 'Ravi started a new job.' },
				{ id: 'c', text: 'Ravi cooked dinner.' }
			],
			'a',
			'The sentence is mainly about how Ravi got lunch.'
		),
		variant(
			'Read: "The pharmacy was closed, so Noor will return tomorrow." Tip: choose the whole message, not one small detail.',
			[
				{ id: 'a', text: 'Noor will return to the pharmacy tomorrow.' },
				{ id: 'b', text: 'Noor works at the pharmacy.' },
				{ id: 'c', text: 'The pharmacy opens at noon.' }
			],
			'a',
			'The message is about Noor returning because the pharmacy is closed.',
			true
		),
		variant(
			'Read: "Eli practiced driving after work because he has a road test on Friday." Tip: ask, “What is this mostly about?”',
			[
				{ id: 'a', text: 'Eli is preparing for a driving test.' },
				{ id: 'b', text: 'Eli is looking for a new job.' },
				{ id: 'c', text: 'Eli missed work on Friday.' }
			],
			'a',
			'The main idea is that Eli is getting ready for a driving test.',
			true
		)
	],
	detail: [
		variant(
			'A coworker says: "The team meeting is at 8:40 in Room 3." Which detail is correct?',
			[
				{ id: 'a', text: 'The meeting is at 8:40.' },
				{ id: 'b', text: 'The meeting is in Room 8.' },
				{ id: 'c', text: 'The meeting is at 3:00.' }
			],
			'a',
			'The message gives the time 8:40 and the place Room 3.'
		),
		variant(
			'A neighbor says: "Please bring the package to Apartment 12 after 6:00." Tip: match the number and time exactly.',
			[
				{ id: 'a', text: 'Bring it to Apartment 12 after 6:00.' },
				{ id: 'b', text: 'Bring it to Apartment 6 at 12:00.' },
				{ id: 'c', text: 'Bring it to the office before 6:00.' }
			],
			'a',
			'The exact detail is Apartment 12 after 6:00.',
			true
		),
		variant(
			'A clinic message says: "Your appointment is Tuesday, July 14, at 2:30." Tip: listen for the date and time.',
			[
				{ id: 'a', text: 'Tuesday, July 14, at 2:30.' },
				{ id: 'b', text: 'Thursday, July 14, at 2:30.' },
				{ id: 'c', text: 'Tuesday, July 24, at 3:30.' }
			],
			'a',
			'The appointment detail is Tuesday, July 14, at 2:30.',
			true
		)
	],
	vocabulary_in_context: [
		variant(
			'What does "available" mean here? "The manager is available after lunch."',
			[
				{ id: 'a', text: 'free to talk or meet' },
				{ id: 'b', text: 'very tired' },
				{ id: 'c', text: 'far from the office' }
			],
			'a',
			'Here, “available” means free to talk or meet.'
		),
		variant(
			'What does "refund" mean? "The store gave Mei a refund for the broken lamp." Tip: use the situation around the word.',
			[
				{ id: 'a', text: 'money returned to a customer' },
				{ id: 'b', text: 'a new kind of lamp' },
				{ id: 'c', text: 'a store opening time' }
			],
			'a',
			'A refund is money returned after an item is returned or has a problem.',
			true
		),
		variant(
			'What does "crowded" mean? "The bus was crowded, so Jia stood near the door." Tip: notice why Jia could not sit.',
			[
				{ id: 'a', text: 'full of many people' },
				{ id: 'b', text: 'running early' },
				{ id: 'c', text: 'very quiet' }
			],
			'a',
			'“Crowded” means there are many people in a small space.',
			true
		)
	],
	verb_form: [
		variant(
			'Choose the best word: "Yesterday, I ___ the bus to work."',
			[
				{ id: 'a', text: 'missed' },
				{ id: 'b', text: 'miss' },
				{ id: 'c', text: 'missing' }
			],
			'a',
			'“Yesterday” signals the past, so use the past form “missed.”'
		),
		variant(
			'Choose the best word: "My brother ___ dinner every Friday." Tip: “every Friday” tells you this is a routine.',
			[
				{ id: 'a', text: 'cook' },
				{ id: 'b', text: 'cooks' },
				{ id: 'c', text: 'cooking' }
			],
			'b',
			'For a regular routine with “my brother,” use “cooks.”',
			true
		),
		variant(
			'Choose the best word: "Right now, Sam is ___ a job application." Tip: “right now” points to an action in progress.',
			[
				{ id: 'a', text: 'fill' },
				{ id: 'b', text: 'filled' },
				{ id: 'c', text: 'filling out' }
			],
			'c',
			'Use “is filling out” for an action happening right now.',
			true
		)
	],
	subject_verb_agreement: [
		variant(
			'Choose the best sentence.',
			[
				{ id: 'a', text: 'The buses arrives at seven.' },
				{ id: 'b', text: 'The bus arrives at seven.' },
				{ id: 'c', text: 'The bus arriving at seven.' }
			],
			'b',
			'One bus uses the singular verb “arrives.”'
		),
		variant(
			'Choose the best sentence. Tip: first find the subject: “my parents” means more than one person.',
			[
				{ id: 'a', text: 'My parents works late.' },
				{ id: 'b', text: 'My parents work late.' },
				{ id: 'c', text: 'My parents working late.' }
			],
			'b',
			'With the plural subject “my parents,” use “work.”',
			true
		),
		variant(
			'Choose the best sentence. Tip: “the store” is one thing, so its verb needs -s in the simple present.',
			[
				{ id: 'a', text: 'The store close at nine.' },
				{ id: 'b', text: 'The store closes at nine.' },
				{ id: 'c', text: 'The store closing at nine.' }
			],
			'b',
			'With the singular subject “the store,” use “closes.”',
			true
		)
	],
	article_determiner: [
		variant(
			'Choose the best sentence for a message about one specific office.',
			[
				{ id: 'a', text: 'I am at office now.' },
				{ id: 'b', text: 'I am at the office now.' },
				{ id: 'c', text: 'I am at an office now.' }
			],
			'b',
			'Use “the office” when both people know which office you mean.'
		),
		variant(
			'Choose the best word: "I need ___ umbrella because it is raining." Tip: use “an” before a vowel sound.',
			[
				{ id: 'a', text: 'a' },
				{ id: 'b', text: 'an' },
				{ id: 'c', text: 'the' }
			],
			'b',
			'Use “an” before the vowel sound at the start of “umbrella.”',
			true
		),
		variant(
			'Choose the best word: "Please close ___ window next to you." Tip: the phrase tells you exactly which window.',
			[
				{ id: 'a', text: 'a' },
				{ id: 'b', text: 'an' },
				{ id: 'c', text: 'the' }
			],
			'c',
			'Use “the” when the description identifies one specific window.',
			true
		)
	],
	plural_countability: [
		variant(
			'Choose the best sentence for a shopping list.',
			[
				{ id: 'a', text: 'I need three tomato.' },
				{ id: 'b', text: 'I need three tomatoes.' },
				{ id: 'c', text: 'I need three tomatoe.' }
			],
			'b',
			'After “three,” use the plural form “tomatoes.”'
		),
		variant(
			'Choose the best phrase. Tip: “rice” is not counted one by one; use a container or amount word.',
			[
				{ id: 'a', text: 'two rices' },
				{ id: 'b', text: 'two bags of rice' },
				{ id: 'c', text: 'two rice' }
			],
			'b',
			'Use “bags of rice” because rice is usually uncountable.',
			true
		),
		variant(
			'Choose the best sentence. Tip: “some” works with plural countable nouns when the exact number is not important.',
			[
				{ id: 'a', text: 'There are some chairs in the room.' },
				{ id: 'b', text: 'There are some chair in the room.' },
				{ id: 'c', text: 'There is some chairs in the room.' }
			],
			'a',
			'Use plural “chairs” with “there are.”',
			true
		)
	],
	preposition: [
		variant(
			'Choose the best word: "The train leaves ___ 6:20."',
			[
				{ id: 'a', text: 'at' },
				{ id: 'b', text: 'on' },
				{ id: 'c', text: 'in' }
			],
			'a',
			'Use “at” with a clock time.'
		),
		variant(
			'Choose the best word: "I have English class ___ Wednesday." Tip: days use “on.”',
			[
				{ id: 'a', text: 'at' },
				{ id: 'b', text: 'on' },
				{ id: 'c', text: 'in' }
			],
			'b',
			'Use “on” with a day of the week.',
			true
		),
		variant(
			'Choose the best word: "My aunt lives ___ Toronto." Tip: cities use “in.”',
			[
				{ id: 'a', text: 'at' },
				{ id: 'b', text: 'on' },
				{ id: 'c', text: 'in' }
			],
			'c',
			'Use “in” with the name of a city.',
			true
		)
	],
	pronoun_choice: [
		variant(
			'Choose the best word: "I spoke to Ana this morning. ___ will call me later."',
			[
				{ id: 'a', text: 'She' },
				{ id: 'b', text: 'He' },
				{ id: 'c', text: 'They' }
			],
			'a',
			'“She” refers back to Ana.'
		),
		variant(
			'Choose the best word: "The keys are on the table. Please put ___ in your bag." Tip: “keys” is plural.',
			[
				{ id: 'a', text: 'it' },
				{ id: 'b', text: 'them' },
				{ id: 'c', text: 'her' }
			],
			'b',
			'Use “them” to refer to more than one key.',
			true
		),
		variant(
			'Choose the best word: "My manager sent the schedule. I read ___ after lunch." Tip: the schedule is one thing.',
			[
				{ id: 'a', text: 'it' },
				{ id: 'b', text: 'them' },
				{ id: 'c', text: 'they' }
			],
			'a',
			'The schedule is one thing, so use “it.”',
			true
		)
	],
	sentence_control: [
		variant(
			'Choose the clearest text message.',
			[
				{ id: 'a', text: 'I was late the bus stopped.' },
				{ id: 'b', text: 'I was late because the bus stopped.' },
				{ id: 'c', text: 'I late bus stopped was.' }
			],
			'b',
			'“Because” connects the reason and result in a complete sentence.'
		),
		variant(
			'Choose the clearest sentence. Tip: two complete ideas need punctuation or a joining word.',
			[
				{ id: 'a', text: 'I called the clinic, but no one answered.' },
				{ id: 'b', text: 'I called the clinic no one answered.' },
				{ id: 'c', text: 'Called clinic no one answer.' }
			],
			'a',
			'The comma and “but” clearly join the two complete ideas.',
			true
		),
		variant(
			'Choose the clearest sentence. Tip: start a new sentence when you begin a new complete idea.',
			[
				{ id: 'a', text: 'I finished work. Then I went to the bank.' },
				{ id: 'b', text: 'I finished work then I went bank.' },
				{ id: 'c', text: 'Finished work then bank went.' }
			],
			'a',
			'Two short, complete sentences make the sequence easy to understand.',
			true
		)
	],
	collocation: [
		variant(
			'Choose the natural phrase: "I need to ___ a doctor’s appointment."',
			[
				{ id: 'a', text: 'make' },
				{ id: 'b', text: 'do' },
				{ id: 'c', text: 'take' }
			],
			'a',
			'English commonly says “make an appointment.”'
		),
		variant(
			'Choose the natural phrase: "Let’s ___ a short break after this task." Tip: learn common word partners as a phrase.',
			[
				{ id: 'a', text: 'make' },
				{ id: 'b', text: 'take' },
				{ id: 'c', text: 'do' }
			],
			'b',
			'English commonly says “take a break.”',
			true
		),
		variant(
			'Choose the natural phrase: "Can you ___ attention to the address?" Tip: notice which verb normally goes with “attention.”',
			[
				{ id: 'a', text: 'pay' },
				{ id: 'b', text: 'give' },
				{ id: 'c', text: 'make' }
			],
			'a',
			'English commonly says “pay attention.”',
			true
		)
	],
	task_completion: [
		variant(
			'Which spoken answer completes this task: “Tell your coworker why you will be late.”',
			[
				{ id: 'a', text: 'I will be late because my train was delayed.' },
				{ id: 'b', text: 'Late train.' },
				{ id: 'c', text: 'Maybe at work.' }
			],
			'a',
			'The answer says what will happen and gives a clear reason.'
		),
		variant(
			'Which spoken answer completes this task: “Ask the landlord to fix one problem in your apartment.” Tip: include the problem and a polite request.',
			[
				{ id: 'a', text: 'The kitchen light is broken. Could you please fix it?' },
				{ id: 'b', text: 'Kitchen light.' },
				{ id: 'c', text: 'Please apartment.' }
			],
			'a',
			'The answer identifies the problem and makes the requested polite ask.',
			true
		),
		variant(
			'Which spoken answer completes this task: “Tell a classmate what you need for tomorrow.” Tip: name the item and the reason.',
			[
				{ id: 'a', text: 'Please bring your notebook because we have a writing activity.' },
				{ id: 'b', text: 'Notebook tomorrow.' },
				{ id: 'c', text: 'Because writing.' }
			],
			'a',
			'The answer names what is needed and explains why.',
			true
		)
	],
	clarity: [
		variant(
			'Choose the clearest message to a coworker.',
			[
				{ id: 'a', text: 'I cannot open the file. Can you send it again?' },
				{ id: 'b', text: 'File cannot open again.' },
				{ id: 'c', text: 'Open send file cannot.' }
			],
			'a',
			'The message clearly states the problem and the requested action.'
		),
		variant(
			'Choose the clearest message. Tip: put the person or thing first, then say what happened.',
			[
				{ id: 'a', text: 'The delivery arrived this afternoon.' },
				{ id: 'b', text: 'This afternoon delivery arrived the.' },
				{ id: 'c', text: 'Arrived delivery afternoon.' }
			],
			'a',
			'The normal word order makes the message easy to understand.',
			true
		),
		variant(
			'Choose the clearest message. Tip: include a time when it helps the listener act.',
			[
				{ id: 'a', text: 'I can meet you at the library at 5:00.' },
				{ id: 'b', text: 'Library meet later.' },
				{ id: 'c', text: 'At maybe library.' }
			],
			'a',
			'The message gives a complete plan with a place and time.',
			true
		)
	],
	fluency: [
		variant(
			'Choose the short answer that sounds complete and easy to follow when spoken.',
			[
				{ id: 'a', text: 'I took the bus because it was raining.' },
				{ id: 'b', text: 'Bus, raining.' },
				{ id: 'c', text: 'Because, um, bus thing.' }
			],
			'a',
			'The answer is a complete sentence with a clear reason.'
		),
		variant(
			'Choose the short answer that is easiest to say clearly. Tip: use one complete thought instead of isolated words.',
			[
				{ id: 'a', text: 'I am looking for the customer service desk.' },
				{ id: 'b', text: 'Customer service, where?' },
				{ id: 'c', text: 'Looking desk service.' }
			],
			'a',
			'The complete sentence is easier for a listener to follow and respond to.',
			true
		),
		variant(
			'Choose the short answer that has a clear beginning and reason. Tip: link two simple ideas with “because.”',
			[
				{ id: 'a', text: 'I need to leave now because my child is waiting.' },
				{ id: 'b', text: 'Leave now, child.' },
				{ id: 'c', text: 'Because waiting child now.' }
			],
			'a',
			'The sentence is complete and links the reason to the action.',
			true
		)
	]
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

const practiceProblemId = (targetSignal: ErrorSignal, variantIndex: number) =>
	`practice-${targetSignal}-${variantIndex + 1}`;

const selectCuratedVariant = (
	targetSignal: ErrorSignal,
	practiceHistory: readonly PracticeHistoryEntry[] = []
) => {
	const candidates = problems[targetSignal].map((content, index) => ({
		content,
		id: practiceProblemId(targetSignal, index)
	}));
	const historyForSignal = practiceHistory.filter(
		(entry) => entry.practiceProblemJson.targetSignal === targetSignal
	);
	const lastAttempt = historyForSignal[historyForSignal.length - 1];
	const attemptedIds = new Set(historyForSignal.map((entry) => entry.practiceProblemJson.id));
	if (!lastAttempt) return candidates[0];

	if (!lastAttempt.feedbackJson.correct) {
		const supportiveAlternatives = candidates.filter(
			(candidate) =>
				candidate.content.supportive && candidate.id !== lastAttempt.practiceProblemJson.id
		);
		return (
			supportiveAlternatives.find((candidate) => !attemptedIds.has(candidate.id)) ??
			supportiveAlternatives[0] ??
			candidates.find((candidate) => candidate.id !== lastAttempt.practiceProblemJson.id) ??
			candidates[0]
		);
	}

	const freshVariants = candidates.filter((candidate) => !attemptedIds.has(candidate.id));
	const freshVariant = freshVariants[freshVariants.length - 1];
	if (freshVariant) return freshVariant;

	const lastVariantIndex = candidates.findIndex(
		(candidate) => candidate.id === lastAttempt?.practiceProblemJson.id
	);
	return (
		candidates[(lastVariantIndex + 1 + candidates.length) % candidates.length] ?? candidates[0]
	);
};

const generateDeterministicPracticeProblem = (input: PracticeGenerationInput): PracticeProblem => {
	const { targetSignal, targetArea, sourceResponseItemId } = practiceContextFrom(input);
	const selected = selectCuratedVariant(targetSignal, input.practiceHistory);
	return validatePracticeProblem({
		id: selected.id,
		targetArea,
		targetSignal,
		sourceResponseItemId,
		...selected.content
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
						selectedVariant: deterministic.problem,
						recentPractice: (input.practiceHistory ?? []).slice(-3).map((entry) => ({
							id: entry.practiceProblemJson.id,
							prompt: entry.practiceProblemJson.prompt,
							correct: entry.feedbackJson.correct
						})),
						...input,
						requirements: [
							`Use id "${deterministic.problem.id}" exactly.`,
							'Use the targetSignal exactly.',
							'Use the targetArea exactly.',
							'Use difficulty "easy".',
							'Use 3 choices with short ids like a, b, c.',
							'Make the answerKey equal one choice id.',
							'Use daily-life ESL content suitable for adult beginners.',
							'Use a different everyday scenario from the recent practice when it is provided.'
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
			id: deterministic.problem.id,
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
	const practiceHistory = await getPracticeHistory(db, attempt.id);

	const generated = await generatePracticeProblem({
		skillProfile: attempt.skillProfileJson,
		studyPlan: attempt.studyPlanJson,
		recentResponses: attempt.responsesJson,
		practiceHistory
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

async function getPracticeHistory(
	db: Db,
	assessmentAttemptId: string
): Promise<PracticeHistoryEntry[]> {
	const attempts = await db
		.select()
		.from(practiceAttempt)
		.where(eq(practiceAttempt.assessmentAttemptId, assessmentAttemptId))
		.orderBy(asc(practiceAttempt.createdAt));

	return attempts.map(({ practiceProblemJson, feedbackJson }) => ({
		practiceProblemJson,
		feedbackJson
	}));
}

export async function savePracticeAttempt(
	db: Db,
	learnerUserId: string,
	answer: string,
	submitted?: { problem: PracticeProblem; metadata: PracticeMetadata }
) {
	const latest = await getLatestAssessmentAttempt(db, learnerUserId);
	if (!latest?.skillProfileJson || !latest.studyPlanJson) return null;
	const practiceHistory = await getPracticeHistory(db, latest.id);

	const generated =
		submitted ??
		(await generatePracticeProblem({
			skillProfile: latest.skillProfileJson,
			studyPlan: latest.studyPlanJson,
			recentResponses: latest.responsesJson,
			practiceHistory
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
	const nextPractice = await generatePracticeProblem({
		skillProfile: latest.skillProfileJson,
		studyPlan: latest.studyPlanJson,
		recentResponses: latest.responsesJson,
		practiceHistory: [...practiceHistory, { practiceProblemJson: problem, feedbackJson: feedback }]
	});

	return {
		assessmentAttemptId: latest.id,
		problem,
		metadata,
		answer,
		feedback,
		nextPractice: { assessmentAttemptId: latest.id, ...nextPractice }
	};
}
