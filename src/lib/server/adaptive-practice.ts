import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
	getAssessmentItemVersion,
	type AssessmentArea,
	type ErrorSignal
} from './assessment-items';
import type { SkillProfile, StudyPlan } from './assessment-diagnosis';
import type { Db } from './db';
import { assessmentAttempt, practiceAttempt, type AttemptResponse } from './db/schema';
import { getWorkersAiRuntime, runWorkersAiJson, type WorkersAiRuntime } from './workers-ai';

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

export const practiceDifficulties = ['foundation', 'practice', 'challenge'] as const;
export type PracticeDifficulty = (typeof practiceDifficulties)[number];
export type AdaptiveReason = 'plan_balance' | 'miss_repeat' | 'level_advance';

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

const fillProblemSchema = z.object({
	...commonProblemShape,
	kind: z.literal('fill'),
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
	z.union([choiceProblemSchema, fillProblemSchema, shortTextProblemSchema, speakingProblemSchema])
);

export type PracticeProblem = z.output<typeof practiceProblemSchema>;

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
			scored: z.literal(true),
			correct: z.boolean(),
			message: z.string().trim().min(1).max(900),
			explanation: z.string().trim().min(1).max(700),
			expectedAnswer: z.string().trim().min(1).max(240).optional()
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
	z.object({ kind: z.literal('fill'), answer: z.string().trim().min(1).max(160) }),
	z.object({ kind: z.literal('short_text'), text: z.string().trim().min(1).max(2000) }),
	z.object({
		kind: z.literal('speaking'),
		transcript: z.string().trim().min(1).max(2400).optional(),
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
	| { kind: 'choice'; choices: { id: string; text: string }[] }
	| { kind: 'fill' }
	| { kind: 'short_text' }
	| { kind: 'speaking' }
);

export type AdaptiveHistoryEntry = {
	practiceId: string;
	targetArea: AssessmentArea;
	targetSignal: ErrorSignal;
	difficulty: PracticeDifficulty;
	adaptiveReason: AdaptiveReason;
	contentId: string;
	scored: boolean;
	correct: boolean | null;
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

const signalLabel: Record<ErrorSignal, string> = {
	main_idea: 'main ideas',
	detail: 'supporting details',
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

type ChoiceSeed = readonly ['choice', string, readonly [string, string, string], 0 | 1 | 2, string];
type FillSeed = readonly ['fill', string, readonly string[], string];
type ObjectiveSeed = ChoiceSeed | FillSeed;

// Each signal has a reviewed fallback at every level. Foundation has a second item so a miss
// can be repeated once without showing the same content when Workers AI is unavailable.
const objectiveBank = {
	main_idea: {
		foundation: [
			[
				'choice',
				"Nora's bus was late, so she arrived at work late. What is the main idea?",
				['Nora arrived late because of the bus.', 'Nora bought a bus.', 'Nora left work early.'],
				0,
				'The whole sentence explains why Nora arrived late.'
			],
			[
				'choice',
				'Sam felt sick, so he stayed home and rested. What is the main idea?',
				['Sam went shopping.', 'Sam stayed home because he was sick.', 'Sam worked all day.'],
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
					'The library closes early today.'
				],
				2,
				"Both sentences explain today's early closing."
			]
		],
		challenge: [
			[
				'choice',
				'A storm canceled several trains. The station added buses so travelers could continue their trips. What is the main idea?',
				[
					'Replacement buses helped after train cancellations.',
					'Travelers chose to stay at the station.',
					'The station stopped all transportation.'
				],
				0,
				'The passage focuses on replacement travel after cancellations.'
			]
		]
	},
	detail: {
		foundation: [
			[
				'choice',
				'The appointment is Tuesday at 2:30. When is the appointment?',
				['Monday at 2:30', 'Tuesday at 2:30', 'Tuesday at 3:30'],
				1,
				'The stated day and time are Tuesday at 2:30.'
			],
			[
				'choice',
				'Kai left the package beside the blue door. Where is the package?',
				['Beside the blue door', 'Inside the car', 'Under the desk'],
				0,
				'The sentence places it beside the blue door.'
			]
		],
		practice: [
			[
				'choice',
				'Rosa will bring soup to the office after her 11:00 dentist visit. What will Rosa bring?',
				['A coat', 'Soup', 'A book'],
				1,
				'Soup is the item Rosa will bring.'
			]
		],
		challenge: [
			[
				'choice',
				'The workshop moved from Room 8 to Room 12, but it still begins at 6:15. Which detail changed?',
				['The room', 'The start time', 'The day'],
				0,
				'Only the room changed.'
			]
		]
	},
	vocabulary_in_context: {
		foundation: [
			[
				'choice',
				'The store is crowded, so we must wait. What does crowded mean?',
				['Full of people', 'Very quiet', 'Closed'],
				0,
				'Crowded means full of people.'
			],
			[
				'choice',
				'This bag is light, so I can carry it easily. What does light mean?',
				['Not heavy', 'Very expensive', 'Dark'],
				0,
				'Here, light means not heavy.'
			]
		],
		practice: [
			[
				'choice',
				'The manager postponed the meeting until Friday. What does postponed mean?',
				['Made shorter', 'Moved to a later time', 'Canceled forever'],
				1,
				'Postponed means moved to a later time.'
			]
		],
		challenge: [
			[
				'choice',
				'Maya was reluctant to complain, but the broken heater forced her to call. What does reluctant mean?',
				['Not willing at first', 'Very excited', 'Unable to speak'],
				0,
				'The context shows she did not want to complain at first.'
			]
		]
	},
	verb_form: {
		foundation: [
			[
				'fill',
				'Complete the sentence: He ___ at a restaurant every day. (work)',
				['works'],
				'Use works with he in the simple present.'
			],
			[
				'fill',
				'Complete the sentence: We ___ dinner at home last night. (cook)',
				['cooked'],
				'Use cooked for a finished past action.'
			]
		],
		practice: [
			[
				'fill',
				'Complete the sentence: Lina has ___ the email already. (send)',
				['sent'],
				'Use the past participle sent after has.'
			]
		],
		challenge: [
			[
				'fill',
				'Complete the sentence: If the bus arrives soon, we will ___ on time. (be)',
				['be'],
				'Use the base form be after will.'
			]
		]
	},
	subject_verb_agreement: {
		foundation: [
			[
				'fill',
				'Complete the sentence: My brother ___ coffee every morning. (drink)',
				['drinks'],
				'A singular third-person subject takes drinks.'
			],
			[
				'fill',
				'Complete the sentence: The students ___ near the station. (live)',
				['live'],
				'A plural subject takes live.'
			]
		],
		practice: [
			[
				'fill',
				'Complete the sentence: Each ticket ___ a seat number. (show)',
				['shows'],
				'Each is singular, so use shows.'
			]
		],
		challenge: [
			[
				'fill',
				'Complete the sentence: Neither of the doors ___ open. (be)',
				['is'],
				'Neither is treated as singular here, so use is.'
			]
		]
	},
	article_determiner: {
		foundation: [
			[
				'fill',
				'Complete the sentence: I bought ___ umbrella because it was raining.',
				['an'],
				'Use an before a vowel sound.'
			],
			[
				'fill',
				'Complete the sentence: Please close ___ window next to you.',
				['the'],
				'Use the for the specific window next to the listener.'
			]
		],
		practice: [
			[
				'fill',
				'Complete the sentence: A new manager started today. She is ___ manager I told you about.',
				['the'],
				'The earlier reference identifies a specific manager, so use the.'
			]
		],
		challenge: [
			[
				'fill',
				'Complete the sentence: We had ___ unusually long wait at the clinic.',
				['an'],
				'Unusually begins with a vowel sound, so use an.'
			]
		]
	},
	plural_countability: {
		foundation: [
			[
				'fill',
				'Complete the sentence: I need two ___ for the trip. (bag)',
				['bags'],
				'Use the plural bags after two.'
			],
			[
				'fill',
				'Complete the sentence: We bought three ___. (tomato)',
				['tomatoes'],
				'The plural of tomato is tomatoes.'
			]
		],
		practice: [
			[
				'choice',
				'Choose the natural sentence.',
				['I need some information.', 'I need an information.', 'I need three informations.'],
				0,
				'Information is uncountable in this use.'
			]
		],
		challenge: [
			[
				'choice',
				'Choose the natural sentence.',
				[
					'There are less chairs today.',
					'There are fewer chairs today.',
					'There is fewer chairs today.'
				],
				1,
				'Use fewer with countable plural chairs.'
			]
		]
	},
	preposition: {
		foundation: [
			['fill', 'Complete the sentence: I live ___ Boston.', ['in'], 'Use in with cities.'],
			[
				'fill',
				'Complete the sentence: The keys are resting flat ___ top of the table.',
				['on'],
				'Use on in the phrase on top of the table.'
			]
		],
		practice: [
			[
				'fill',
				'Complete the sentence: The meeting starts ___ 9:00.',
				['at'],
				'Use at with a clock time.'
			]
		],
		challenge: [
			[
				'fill',
				'Complete the sentence: She has worked here ___ 2022.',
				['since'],
				'Use since with a starting point in time.'
			]
		]
	},
	pronoun_choice: {
		foundation: [
			[
				'choice',
				'Mina called Alex. ___ left a message for him.',
				['She', 'Her', 'Hers'],
				0,
				'She is the subject pronoun for Mina.'
			],
			[
				'choice',
				'This book belongs to Leo. It is ___.',
				['he', 'him', 'his'],
				2,
				'His can stand alone to show possession.'
			]
		],
		practice: [
			[
				'choice',
				'Sara and I finished the report. The manager thanked ___.',
				['we', 'us', 'our'],
				1,
				'Us is the object pronoun after thanked.'
			]
		],
		challenge: [
			[
				'choice',
				'The neighbors introduced ___ before the meeting.',
				['themselves', 'theirselves', 'themself'],
				0,
				'The plural reflexive pronoun is themselves.'
			]
		]
	},
	sentence_control: {
		foundation: [
			[
				'choice',
				'Choose the clearest sentence.',
				['I was tired, so I went home.', 'I tired home went.', 'I was tired I went home.'],
				0,
				'So connects the two complete ideas clearly.'
			],
			[
				'choice',
				'Choose the complete sentence.',
				[
					'Because the train was late.',
					'The train was late, but we arrived.',
					'Late train because.'
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
					'I clinic called appointment writing.'
				],
				0,
				'The first choice clearly links the actions.'
			]
		],
		challenge: [
			[
				'choice',
				'Choose the sentence with the clearest structure.',
				[
					'Although the shop was busy, the cashier helped me quickly.',
					'Although the shop was busy. The cashier quickly.',
					'The shop although busy cashier helped.'
				],
				0,
				'The dependent clause is joined to a complete main clause.'
			]
		]
	},
	collocation: {
		foundation: [
			[
				'choice',
				'Choose the natural phrase.',
				['do homework', 'make homework', 'build homework'],
				0,
				'English normally uses do homework.'
			],
			[
				'choice',
				'Choose the natural phrase.',
				['take a decision', 'do a decision', 'make a decision'],
				2,
				'English normally uses make a decision.'
			]
		],
		practice: [
			[
				'choice',
				'Choose the natural phrase.',
				['heavy rain', 'strong rain', 'hard rain'],
				0,
				'Heavy rain is the usual word combination.'
			]
		],
		challenge: [
			[
				'choice',
				'Choose the natural phrase.',
				['meet a deadline', 'catch a deadline', 'touch a deadline'],
				0,
				'Meet a deadline means finish on time.'
			]
		]
	},
	task_completion: {
		foundation: [
			[
				'choice',
				'The task says: Name a food you like and say why. Which answer completes it?',
				['Pizza.', 'I like pizza because it is easy to share.', 'Because food.'],
				1,
				'The answer names a food and gives a reason.'
			],
			[
				'choice',
				'The task says: Say where you went and how you traveled. Which answer completes it?',
				['I went downtown by bus.', 'A bus.', 'Yesterday was sunny.'],
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
					'I like my coworkers.'
				],
				1,
				'The answer identifies a problem and the response.'
			]
		],
		challenge: [
			[
				'choice',
				'The task says: Compare two travel choices and recommend one. Which answer completes it?',
				[
					'Trains and buses travel.',
					'The train is faster, while the bus is cheaper; I recommend the train when time is short.',
					'I traveled last year.'
				],
				1,
				'The answer compares both choices and makes a supported recommendation.'
			]
		]
	},
	clarity: {
		foundation: [
			[
				'choice',
				'Choose the clearest message.',
				['I will arrive ten minutes late.', 'I arrive late ten maybe.', 'Late arrive I minute.'],
				0,
				'The first message gives a clear delay.'
			],
			[
				'choice',
				'Choose the clearest request.',
				['Could you send me the address?', 'Address send maybe me.', 'You address could.'],
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
					'My call was phone and silent.'
				],
				0,
				'The first sentence clearly states the event and reason.'
			]
		],
		challenge: [
			[
				'choice',
				'Choose the clearest update.',
				[
					'The delivery was delayed; however, it should arrive before noon tomorrow.',
					'Delivery delay however tomorrow maybe noon.',
					'It delivery tomorrow was delayed before.'
				],
				0,
				'The first update makes the contrast and new time clear.'
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
					'Weekend, um, sister, dinner.'
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
					'English, because, customers.'
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
					'I took, um, the bus, the thing.'
				],
				0,
				'The first answer uses connected clauses to keep the message moving.'
			]
		],
		challenge: [
			[
				'choice',
				'Choose the answer that develops the idea most smoothly.',
				[
					'At first I was nervous, but after a few minutes I relaxed and explained my idea clearly.',
					'Nervous first. Minutes. Idea.',
					'I was, you know, and then, the idea.'
				],
				0,
				'The first answer uses transitions and complete clauses.'
			]
		]
	}
} satisfies Record<ErrorSignal, Record<PracticeDifficulty, readonly ObjectiveSeed[]>>;

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
		(target, index) => combined.findIndex((other) => other.signal === target.signal) === index
	);
};

export function selectNextPracticeTarget({
	skillProfile,
	studyPlan,
	history
}: {
	skillProfile: SkillProfile;
	studyPlan: StudyPlan;
	history: readonly AdaptiveHistoryEntry[];
}): PracticeSelection {
	const scored = history.filter((entry) => entry.scored && entry.correct !== null);
	const last = scored.at(-1);
	if (last?.correct === false && last.adaptiveReason !== 'miss_repeat') {
		return {
			targetArea: last.targetArea,
			targetSignal: last.targetSignal,
			difficulty: levelDown(last.difficulty),
			adaptiveReason: 'miss_repeat',
			repeatOfPracticeId: last.practiceId,
			excludeContentId: last.contentId
		};
	}

	const lastTwo = scored.slice(-2);
	if (
		lastTwo.length === 2 &&
		lastTwo.every((entry) => entry.correct) &&
		lastTwo[0].targetSignal === lastTwo[1].targetSignal &&
		lastTwo[0].difficulty === lastTwo[1].difficulty
	) {
		return {
			targetArea: lastTwo[1].targetArea,
			targetSignal: lastTwo[1].targetSignal,
			difficulty: levelUp(lastTwo[1].difficulty),
			adaptiveReason: 'level_advance'
		};
	}

	let targets = planTargets(studyPlan, skillProfile).slice(0, 3);
	if (last?.correct === false && last.adaptiveReason === 'miss_repeat' && targets.length > 1) {
		targets = targets.filter((target) => target.signal !== last.targetSignal);
	}
	const ranked = targets
		.map((target, priority) => {
			const attempts = scored.filter((entry) => entry.targetSignal === target.signal);
			const recent = attempts.slice(-10);
			return {
				...target,
				priority,
				attempts,
				accuracy: recent.length ? recent.filter((entry) => entry.correct).length / recent.length : 0
			};
		})
		.sort(
			(left, right) =>
				left.attempts.length - right.attempts.length ||
				left.accuracy - right.accuracy ||
				left.priority - right.priority
		);
	const selected = ranked[0];
	const previous = selected.attempts.at(-1);
	return {
		targetArea: selected.area,
		targetSignal: selected.signal,
		difficulty: previous
			? previous.correct === false
				? levelDown(previous.difficulty)
				: previous.difficulty
			: defaultDifficulty(skillProfile, selected.area),
		adaptiveReason: 'plan_balance'
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

const fallbackObjectiveProblem = (
	selection: PracticeSelection,
	sourceResponseItemId?: string
): PracticeProblem => {
	const seeds = objectiveBank[selection.targetSignal][selection.difficulty];
	let seedIndex = seeds.findIndex(
		(_, index) =>
			`${selection.targetSignal}-${selection.difficulty}-${index + 1}` !==
			selection.excludeContentId
	);
	if (seedIndex < 0) seedIndex = 0;
	const seed = seeds[seedIndex];
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
		return validatePracticeProblem({
			...common,
			kind: 'fill',
			acceptableAnswers: seed[2],
			explanation: seed[3]
		});
	}
	const ids = ['a', 'b', 'c'] as const;
	return validatePracticeProblem({
		...common,
		kind: 'choice',
		choices: seed[2].map((text, index) => ({ id: ids[index], text })),
		answerKey: ids[seed[3]],
		explanation: seed[4]
	});
};

const fallbackProductiveProblem = (
	selection: PracticeSelection,
	kind: 'short_text' | 'speaking',
	sourceResponseItemId?: string
): PracticeProblem =>
	validatePracticeProblem({
		id: `${kind}-${selection.targetSignal}-${selection.difficulty}-1`,
		targetArea: selection.targetArea,
		targetSignal: selection.targetSignal,
		sourceResponseItemId,
		difficulty: selection.difficulty,
		adaptiveReason: selection.adaptiveReason,
		repeatOfPracticeId: selection.repeatOfPracticeId,
		kind,
		prompt: `${kind === 'short_text' ? 'Write 2–3 clear sentences.' : 'Speak for 20–40 seconds.'} ${productiveTaskBySignal[selection.targetSignal]}`,
		rubric: {
			targetDescription: `The response completes the requested task and gives observable evidence of ${signalLabel[selection.targetSignal]}.`,
			...(kind === 'short_text' ? { minimumWords: 12 } : { minimumSeconds: 20 })
		}
	});

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
const aiProductiveCandidateSchema = z.object({ prompt: z.string().trim().min(1).max(700) });
const aiReviewSchema = z.object({
	targetAligned: z.boolean(),
	answerAgrees: z.boolean(),
	safeForAdultBeginner: z.boolean()
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
	recentResponses?: AttemptResponse[];
	history?: AdaptiveHistoryEntry[];
	selection?: PracticeSelection;
	kind?: 'objective' | 'short_text' | 'speaking';
	runtime?: WorkersAiRuntime | null;
};

const buildAiProblem = (
	candidate:
		z.infer<typeof aiObjectiveCandidateSchema> | z.infer<typeof aiProductiveCandidateSchema>,
	selection: PracticeSelection,
	kind: 'objective' | 'short_text' | 'speaking',
	sourceResponseItemId?: string
): PracticeProblem => {
	const common = {
		id: `ai-${selection.targetSignal}-${selection.difficulty}-${crypto.randomUUID()}`,
		targetArea: selection.targetArea,
		targetSignal: selection.targetSignal,
		sourceResponseItemId,
		difficulty: selection.difficulty,
		adaptiveReason: selection.adaptiveReason,
		repeatOfPracticeId: selection.repeatOfPracticeId
	};
	if (kind !== 'objective') {
		return validatePracticeProblem({
			...common,
			kind,
			prompt: candidate.prompt,
			rubric: {
				targetDescription: `The response gives observable evidence of ${signalLabel[selection.targetSignal]}.`,
				...(kind === 'short_text' ? { minimumWords: 12 } : { minimumSeconds: 20 })
			}
		});
	}
	return validatePracticeProblem({ ...common, ...candidate });
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
	const kind = input.kind ?? 'objective';
	const sourceResponseItemId = sourceResponseFor(
		input.recentResponses ?? [],
		selection.targetSignal,
		selection.targetArea
	);
	const fallback = (reason: string) => ({
		problem:
			kind === 'objective'
				? fallbackObjectiveProblem(selection, sourceResponseItemId)
				: fallbackProductiveProblem(selection, kind, sourceResponseItemId),
		metadata: generatedMetadata('local', 'reviewed-practice-bank-v2', reason)
	});
	const runtime = input.runtime === undefined ? getWorkersAiRuntime() : input.runtime;
	if (!runtime) return fallback('provider_unavailable');

	let candidate:
		z.infer<typeof aiObjectiveCandidateSchema> | z.infer<typeof aiProductiveCandidateSchema>;
	try {
		candidate = await runWorkersAiJson(
			runtime,
			[
				{
					role: 'system',
					content: 'Return only JSON for one adult-beginner ESL practice problem. No markdown.'
				},
				{
					role: 'user',
					content: JSON.stringify({
						targetSignal: selection.targetSignal,
						targetArea: selection.targetArea,
						difficulty: selection.difficulty,
						kind,
						requirements:
							kind === 'objective'
								? 'Return choice or fill with one unambiguous answer and an explanation.'
								: 'Return only a prompt that elicits the target in 2–3 sentences or 20–40 seconds.'
					})
				}
			],
			kind === 'objective' ? aiObjectiveCandidateSchema : aiProductiveCandidateSchema
		);
	} catch {
		return fallback('generation_failed');
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
						candidate,
						checks: [
							'Content directly targets the requested signal.',
							'Content is safe and suitable for an adult beginner.',
							'For an objective item, the keyed answer agrees with the prompt and explanation.'
						]
					})
				}
			],
			aiReviewSchema
		);
	} catch {
		return fallback('review_failed');
	}
	if (!review.targetAligned || !review.safeForAdultBeginner || !review.answerAgrees) {
		return fallback('review_rejected');
	}

	return {
		problem: buildAiProblem(candidate, selection, kind, sourceResponseItemId),
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
	problem: Extract<PracticeProblem, { kind: 'choice' | 'fill' }>,
	response: Extract<PracticeResponse, { kind: 'choice' | 'fill' }>
): PracticeFeedback => {
	if (problem.kind !== response.kind) throw new PracticeInputError('Response type does not match.');
	const correct =
		problem.kind === 'choice'
			? response.answer === problem.answerKey
			: problem.acceptableAnswers.some(
					(answer) => normalizeAnswer(answer) === normalizeAnswer(response.answer)
				);
	const expectedAnswer =
		problem.kind === 'choice'
			? problem.choices.find((choice) => choice.id === problem.answerKey)?.text
			: problem.acceptableAnswers[0];
	return {
		kind: 'objective',
		scored: true,
		correct,
		message: `${correct ? 'Correct.' : 'Not yet.'} ${problem.explanation}`,
		explanation: problem.explanation,
		expectedAnswer
	};
};

export const gradePracticeAnswer = (problem: PracticeProblem, answer: string): PracticeFeedback => {
	if (problem.kind !== 'choice' && problem.kind !== 'fill') {
		return unavailableProductiveFeedback('This response needs rubric feedback.');
	}
	return gradeObjectiveResponse(problem, { kind: problem.kind, answer });
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
	return problem.kind === 'choice'
		? { ...common, kind: problem.kind, choices: problem.choices }
		: { ...common, kind: problem.kind };
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

const historyFromRows = (rows: readonly PracticeRow[]): AdaptiveHistoryEntry[] =>
	rows.map((row) => {
		const { problem, feedback } = parseStoredRow(row);
		return {
			practiceId: row.id,
			targetArea: problem.targetArea,
			targetSignal: problem.targetSignal,
			difficulty: problem.difficulty,
			adaptiveReason: problem.adaptiveReason,
			contentId: problem.id,
			scored: feedback?.scored ?? false,
			correct:
				feedback?.kind === 'objective'
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
		.orderBy(asc(practiceAttempt.createdAt), asc(practiceAttempt.sequence))
		.limit(250);

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

const sessionResults = (rows: readonly PracticeRow[]) =>
	rows.flatMap((row) => {
		const { problem, feedback } = parseStoredRow(row);
		return feedback
			? [
					{
						practiceId: row.id,
						sequence: row.sequence,
						targetSignal: problem.targetSignal,
						difficulty: problem.difficulty,
						feedback
					}
				]
			: [];
	});

const sessionState = (assessment: AssessmentRow, group?: SessionGroup): PracticeSessionState => {
	if (!group) {
		return {
			assessmentAttemptId: assessment.id,
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
	sessionId: string | null;
	completedCount: number;
	totalProblems: 5;
	completed: boolean;
	problem: PracticeProblemPublic | null;
	results: {
		practiceId: string;
		sequence: number;
		targetSignal: ErrorSignal;
		difficulty: PracticeDifficulty;
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
	const completedSessions = groups.filter(isCompleteSession).length;
	const kind = sequence < 5 ? 'objective' : completedSessions % 2 === 0 ? 'short_text' : 'speaking';
	const history = historyFromRows(rows);
	const selection = selectNextPracticeTarget({
		skillProfile: assessment.skillProfileJson,
		studyPlan: assessment.studyPlanJson,
		history
	});
	const generated = await generatePracticeProblem({
		skillProfile: assessment.skillProfileJson,
		studyPlan: assessment.studyPlanJson,
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
	options: { runtime?: WorkersAiRuntime | null } = {}
) {
	const practiceId = z.string().uuid().parse(input.practiceId);
	const response = validatePracticeResponse(input.response);
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
	const initialFeedback =
		problem.kind === 'choice' || problem.kind === 'fill'
			? gradeObjectiveResponse(
					problem,
					response as Extract<PracticeResponse, { kind: 'choice' | 'fill' }>
				)
			: unavailableProductiveFeedback('feedback is still being prepared');
	const answeredAt = new Date();
	const updated = await db
		.update(practiceAttempt)
		.set({
			status: 'answered',
			answer: JSON.stringify(response),
			feedbackJson: initialFeedback,
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
	if (!updated.length)
		throw new PracticeConflictError('Practice problem has already been answered.');

	let feedback = initialFeedback;
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
				feedbackJson: feedback,
				metadataJson: graded.fallbackReason
					? { ...metadata, fallbackReason: graded.fallbackReason }
					: metadata
			})
			.where(
				and(eq(practiceAttempt.id, practiceId), eq(practiceAttempt.learnerUserId, learnerUserId))
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

export const getReassessmentProgress = (
	history: readonly AdaptiveHistoryEntry[],
	threshold = 20
) => {
	const scoredCount = history.filter((entry) => entry.scored).length;
	return {
		scoredCount,
		threshold,
		remaining: Math.max(0, threshold - scoredCount),
		recommended: scoredCount >= threshold
	};
};

export async function getPracticeProgress(db: Db, learnerUserId: string) {
	const assessment = await getLatestCompletedAssessment(db, learnerUserId);
	if (!assessment?.studyPlanJson) return null;
	const rows = (await getPracticeRows(db, learnerUserId)).filter(
		(row) => row.assessmentAttemptId === assessment.id
	);
	const history = historyFromRows(rows);
	return {
		assessmentAttemptId: assessment.id,
		...getReassessmentProgress(history, assessment.studyPlanJson.reassessAfterPracticeCount ?? 20),
		completedSessions: sessionGroups(rows).filter(
			(group) => !group.legacy && isCompleteSession(group)
		).length
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
	if (session.problem.kind !== 'choice' && session.problem.kind !== 'fill') {
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
