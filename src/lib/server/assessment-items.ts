export type AssessmentArea =
	'listening' | 'reading' | 'grammar_usage' | 'vocabulary' | 'writing' | 'speaking';

export const assessmentDefinitionVersion = 2;

export type ErrorSignal =
	| 'main_idea'
	| 'detail'
	| 'vocabulary_in_context'
	| 'verb_form'
	| 'subject_verb_agreement'
	| 'article_determiner'
	| 'plural_countability'
	| 'preposition'
	| 'pronoun_choice'
	| 'sentence_control'
	| 'collocation'
	| 'task_completion'
	| 'clarity'
	| 'fluency';

type Choice = {
	readonly id: string;
	readonly text: string;
};

type ReviewMetadata = {
	authoringSessionId: string;
	reviewSessionId: string;
	reviewedAt: string;
	reviewerModel: string;
	status: 'accepted';
	notes: string;
};

export type AssessmentItem = {
	readonly id: string;
	readonly version: number;
	readonly area: AssessmentArea;
	readonly taskType: string;
	readonly prompt: string;
	readonly primaryScoredSignal?: ErrorSignal;
	readonly errorSignalTags: readonly ErrorSignal[];
	readonly explanation: string;
	readonly answerKey?: readonly string[];
	readonly rubric?: readonly string[];
	readonly choices?: readonly Choice[];
	readonly serverOnlyAudioScript?: string;
	readonly serverOnlyAudioMetadata?: {
		provider: 'workers-ai';
		model: '@cf/deepgram/aura-2-en';
		schemaVersion: 1;
	};
	readonly learnerTask: {
		instructions: string;
		choices?: readonly Choice[];
	};
	readonly review: ReviewMetadata;
};

export type LearnerAssessmentItem = Pick<
	AssessmentItem,
	'id' | 'version' | 'area' | 'taskType' | 'prompt' | 'learnerTask'
> & { audioUrl?: string };

export const seedAssessmentItems = [
	{
		id: 'listen-mei-coworker-time',
		version: 1,
		area: 'listening',
		taskType: 'short_audio_comprehension',
		prompt: 'Listen to a short conversation and choose the correct detail.',
		primaryScoredSignal: 'detail',
		errorSignalTags: ['detail', 'main_idea'],
		explanation: 'The key detail is the meeting time, not the place or activity.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'At 8:15.' },
			{ id: 'b', text: 'At 8:50.' },
			{ id: 'c', text: 'At 9:30.' }
		],
		serverOnlyAudioScript: 'Mei says, "I will meet my coworker at eight fifty near the station."',
		serverOnlyAudioMetadata: {
			provider: 'workers-ai',
			model: '@cf/deepgram/aura-2-en',
			schemaVersion: 1
		},
		learnerTask: {
			instructions: 'Listen to the audio. What time will Mei meet her coworker?',
			choices: [
				{ id: 'a', text: 'At 8:15.' },
				{ id: 'b', text: 'At 8:50.' },
				{ id: 'c', text: 'At 9:30.' }
			]
		},
		review: {
			authoringSessionId: 'codex-issue-16-authoring-2026-07-08',
			reviewSessionId: 'codex-issue-16-content-review-2026-07-08',
			reviewedAt: '2026-07-08',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Beginner-safe daily-life context; answer is explicit and unambiguous.'
		}
	},
	{
		id: 'listen-ana-pharmacy-main-idea',
		version: 1,
		area: 'listening',
		taskType: 'short_audio_comprehension',
		prompt: 'Listen and choose the main idea.',
		primaryScoredSignal: 'main_idea',
		errorSignalTags: ['main_idea', 'detail'],
		explanation: 'Ana is explaining that she needs to collect medicine after work.',
		answerKey: ['a'],
		choices: [
			{ id: 'a', text: 'Ana needs to pick up medicine.' },
			{ id: 'b', text: 'Ana is applying for a new job.' },
			{ id: 'c', text: 'Ana is cooking dinner at work.' }
		],
		serverOnlyAudioScript:
			'Ana says, "The pharmacy closes at seven, so I need to pick up my medicine after work."',
		serverOnlyAudioMetadata: {
			provider: 'workers-ai',
			model: '@cf/deepgram/aura-2-en',
			schemaVersion: 1
		},
		learnerTask: {
			instructions: 'Listen to Ana. What is she mainly talking about?',
			choices: [
				{ id: 'a', text: 'Ana needs to pick up medicine.' },
				{ id: 'b', text: 'Ana is applying for a new job.' },
				{ id: 'c', text: 'Ana is cooking dinner at work.' }
			]
		},
		review: {
			authoringSessionId: 'codex-study-tool-authoring-2026-07-10',
			reviewSessionId: 'codex-study-tool-content-review-2026-07-10',
			reviewedAt: '2026-07-10',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'The main idea is explicit and the distractors are unrelated but plausible activities.'
		}
	},
	{
		id: 'listen-bus-platform-detail',
		version: 1,
		area: 'listening',
		taskType: 'short_audio_comprehension',
		prompt: 'Listen to an announcement and choose the correct detail.',
		primaryScoredSignal: 'detail',
		errorSignalTags: ['detail'],
		explanation: 'The announcement directs passengers to platform six.',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'Platform 2.' },
			{ id: 'b', text: 'Platform 4.' },
			{ id: 'c', text: 'Platform 6.' }
		],
		serverOnlyAudioScript:
			'The number twenty-four bus to Green Street will leave from platform six.',
		serverOnlyAudioMetadata: {
			provider: 'workers-ai',
			model: '@cf/deepgram/aura-2-en',
			schemaVersion: 1
		},
		learnerTask: {
			instructions: 'Which platform will the bus leave from?',
			choices: [
				{ id: 'a', text: 'Platform 2.' },
				{ id: 'b', text: 'Platform 4.' },
				{ id: 'c', text: 'Platform 6.' }
			]
		},
		review: {
			authoringSessionId: 'codex-study-tool-authoring-2026-07-10',
			reviewSessionId: 'codex-study-tool-content-review-2026-07-10',
			reviewedAt: '2026-07-10',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Tests one concrete listening detail with short, parallel answer choices.'
		}
	},
	{
		id: 'read-lina-return-jacket',
		version: 1,
		area: 'reading',
		taskType: 'short_passage_comprehension',
		prompt: 'Lina bought a jacket online. It was too small, so she sent it back the next day.',
		primaryScoredSignal: 'detail',
		errorSignalTags: ['detail', 'main_idea'],
		explanation: 'The passage says the jacket was too small, so that is why Lina returned it.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'It was too expensive.' },
			{ id: 'b', text: 'It was too small.' },
			{ id: 'c', text: 'It arrived late.' }
		],
		learnerTask: {
			instructions: 'Why did Lina return the jacket?',
			choices: [
				{ id: 'a', text: 'It was too expensive.' },
				{ id: 'b', text: 'It was too small.' },
				{ id: 'c', text: 'It arrived late.' }
			]
		},
		review: {
			authoringSessionId: 'codex-issue-16-authoring-2026-07-08',
			reviewSessionId: 'codex-issue-16-content-review-2026-07-08',
			reviewedAt: '2026-07-08',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Concrete passage with one supported answer and no culturally loaded content.'
		}
	},
	{
		id: 'read-omar-library-main-idea',
		version: 1,
		area: 'reading',
		taskType: 'short_passage_comprehension',
		prompt:
			'Omar went to the library on Sunday, but the door was locked. A sign said the library would open again on Monday morning.',
		primaryScoredSignal: 'main_idea',
		errorSignalTags: ['main_idea', 'detail'],
		explanation: 'The passage is mainly about Omar finding the library closed on Sunday.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'Omar lost a library book.' },
			{ id: 'b', text: 'The library was closed when Omar arrived.' },
			{ id: 'c', text: 'Omar works at the library on Monday.' }
		],
		learnerTask: {
			instructions: 'What is the passage mainly about?',
			choices: [
				{ id: 'a', text: 'Omar lost a library book.' },
				{ id: 'b', text: 'The library was closed when Omar arrived.' },
				{ id: 'c', text: 'Omar works at the library on Monday.' }
			]
		},
		review: {
			authoringSessionId: 'codex-study-tool-authoring-2026-07-10',
			reviewSessionId: 'codex-study-tool-content-review-2026-07-10',
			reviewedAt: '2026-07-10',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'The short passage supports one clear main idea without requiring outside knowledge.'
		}
	},
	{
		id: 'read-workshop-available-vocabulary',
		version: 1,
		area: 'reading',
		taskType: 'vocabulary_in_passage',
		prompt:
			'The Saturday workshop is full, but places are still available in the Tuesday workshop.',
		primaryScoredSignal: 'vocabulary_in_context',
		errorSignalTags: ['vocabulary_in_context', 'detail'],
		explanation: 'In this notice, "available" means that places are still open to join.',
		answerKey: ['a'],
		choices: [
			{ id: 'a', text: 'open to join' },
			{ id: 'b', text: 'already finished' },
			{ id: 'c', text: 'more expensive' }
		],
		learnerTask: {
			instructions: 'What does "available" mean in this passage?',
			choices: [
				{ id: 'a', text: 'open to join' },
				{ id: 'b', text: 'already finished' },
				{ id: 'c', text: 'more expensive' }
			]
		},
		review: {
			authoringSessionId: 'codex-study-tool-authoring-2026-07-10',
			reviewSessionId: 'codex-study-tool-content-review-2026-07-10',
			reviewedAt: '2026-07-10',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Context contrasts full with available, making the intended meaning recoverable.'
		}
	},
	{
		id: 'grammar-simple-present-goes',
		version: 1,
		area: 'grammar_usage',
		taskType: 'fill_in_the_blank',
		prompt: 'She ____ to work every morning.',
		primaryScoredSignal: 'subject_verb_agreement',
		errorSignalTags: ['verb_form', 'subject_verb_agreement'],
		explanation: 'Use "goes" with "she" in the simple present tense.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'go' },
			{ id: 'b', text: 'goes' },
			{ id: 'c', text: 'going' }
		],
		learnerTask: {
			instructions: 'Choose the best word to complete the sentence.',
			choices: [
				{ id: 'a', text: 'go' },
				{ id: 'b', text: 'goes' },
				{ id: 'c', text: 'going' }
			]
		},
		review: {
			authoringSessionId: 'codex-issue-16-authoring-2026-07-08',
			reviewSessionId: 'codex-issue-16-content-review-2026-07-08',
			reviewedAt: '2026-07-08',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Targets a high-value Chinese L1 verb morphology signal without assuming an error.'
		}
	},
	{
		id: 'grammar-article-umbrella',
		version: 1,
		area: 'grammar_usage',
		taskType: 'fill_in_the_blank',
		prompt: 'It is raining, so please take ____ umbrella.',
		primaryScoredSignal: 'article_determiner',
		errorSignalTags: ['article_determiner'],
		explanation: 'Use "an" before the vowel sound at the start of "umbrella."',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'a' },
			{ id: 'b', text: 'an' },
			{ id: 'c', text: 'some' }
		],
		learnerTask: {
			instructions: 'Choose the best word to complete the sentence.',
			choices: [
				{ id: 'a', text: 'a' },
				{ id: 'b', text: 'an' },
				{ id: 'c', text: 'some' }
			]
		},
		review: {
			authoringSessionId: 'codex-study-tool-authoring-2026-07-10',
			reviewSessionId: 'codex-study-tool-content-review-2026-07-10',
			reviewedAt: '2026-07-10',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'A single everyday noun isolates basic indefinite article selection.'
		}
	},
	{
		id: 'grammar-preposition-monday',
		version: 1,
		area: 'grammar_usage',
		taskType: 'fill_in_the_blank',
		prompt: 'My new class starts ____ Monday.',
		primaryScoredSignal: 'preposition',
		errorSignalTags: ['preposition'],
		explanation: 'Use "on" with a day of the week.',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'at' },
			{ id: 'b', text: 'in' },
			{ id: 'c', text: 'on' }
		],
		learnerTask: {
			instructions: 'Choose the best word to complete the sentence.',
			choices: [
				{ id: 'a', text: 'at' },
				{ id: 'b', text: 'in' },
				{ id: 'c', text: 'on' }
			]
		},
		review: {
			authoringSessionId: 'codex-study-tool-authoring-2026-07-10',
			reviewSessionId: 'codex-study-tool-content-review-2026-07-10',
			reviewedAt: '2026-07-10',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Tests a common time preposition in an unambiguous sentence.'
		}
	},
	{
		id: 'vocab-delayed-train',
		version: 1,
		area: 'vocabulary',
		taskType: 'word_in_context',
		prompt: 'The train was delayed, so I arrived late.',
		primaryScoredSignal: 'vocabulary_in_context',
		errorSignalTags: ['vocabulary_in_context', 'collocation'],
		explanation: '"Delayed" means something happened later than planned.',
		answerKey: ['c'],
		choices: [
			{ id: 'a', text: 'very full' },
			{ id: 'b', text: 'very clean' },
			{ id: 'c', text: 'later than planned' }
		],
		learnerTask: {
			instructions: 'What does "delayed" mean in this sentence?',
			choices: [
				{ id: 'a', text: 'very full' },
				{ id: 'b', text: 'very clean' },
				{ id: 'c', text: 'later than planned' }
			]
		},
		review: {
			authoringSessionId: 'codex-issue-16-authoring-2026-07-08',
			reviewSessionId: 'codex-issue-16-content-review-2026-07-08',
			reviewedAt: '2026-07-08',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Common travel/work vocabulary with distractors that do not require outside knowledge.'
		}
	},
	{
		id: 'vocab-make-decision-collocation',
		version: 1,
		area: 'vocabulary',
		taskType: 'natural_word_pair',
		prompt: 'We need to ____ a decision before Friday.',
		primaryScoredSignal: 'collocation',
		errorSignalTags: ['collocation', 'vocabulary_in_context'],
		explanation: 'English normally uses the phrase "make a decision."',
		answerKey: ['a'],
		choices: [
			{ id: 'a', text: 'make' },
			{ id: 'b', text: 'do' },
			{ id: 'c', text: 'build' }
		],
		learnerTask: {
			instructions: 'Choose the natural word to complete the sentence.',
			choices: [
				{ id: 'a', text: 'make' },
				{ id: 'b', text: 'do' },
				{ id: 'c', text: 'build' }
			]
		},
		review: {
			authoringSessionId: 'codex-study-tool-authoring-2026-07-10',
			reviewSessionId: 'codex-study-tool-content-review-2026-07-10',
			reviewedAt: '2026-07-10',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Targets one high-frequency collocation with grammatical parallel distractors.'
		}
	},
	{
		id: 'vocab-crowded-market',
		version: 1,
		area: 'vocabulary',
		taskType: 'word_in_context',
		prompt: 'The market was crowded, so it was difficult to walk between the shops.',
		primaryScoredSignal: 'vocabulary_in_context',
		errorSignalTags: ['vocabulary_in_context', 'detail'],
		explanation: 'The difficulty walking shows that "crowded" means full of people.',
		answerKey: ['b'],
		choices: [
			{ id: 'a', text: 'closed for the day' },
			{ id: 'b', text: 'full of people' },
			{ id: 'c', text: 'easy to find' }
		],
		learnerTask: {
			instructions: 'What does "crowded" mean in this sentence?',
			choices: [
				{ id: 'a', text: 'closed for the day' },
				{ id: 'b', text: 'full of people' },
				{ id: 'c', text: 'easy to find' }
			]
		},
		review: {
			authoringSessionId: 'codex-study-tool-authoring-2026-07-10',
			reviewSessionId: 'codex-study-tool-content-review-2026-07-10',
			reviewedAt: '2026-07-10',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'The consequence in the sentence provides enough context for the meaning.'
		}
	},
	{
		id: 'write-problem-solved-last-week',
		version: 1,
		area: 'writing',
		taskType: 'short_paragraph',
		prompt: 'Write 4-5 sentences about a problem you solved last week.',
		errorSignalTags: [
			'task_completion',
			'article_determiner',
			'plural_countability',
			'verb_form',
			'sentence_control',
			'clarity'
		],
		explanation:
			'The response should describe a familiar past event with clear sentence control and basic grammar accuracy.',
		rubric: [
			'task_completion: answers the prompt with 4-5 relevant sentences',
			'clarity: ideas are understandable without guessing',
			'grammar_control: checks tense, articles, plurals, and sentence boundaries',
			'vocabulary: uses familiar words accurately'
		],
		learnerTask: {
			instructions: 'Write 4-5 sentences about a problem you solved last week.'
		},
		review: {
			authoringSessionId: 'codex-issue-16-authoring-2026-07-08',
			reviewSessionId: 'codex-issue-16-content-review-2026-07-08',
			reviewedAt: '2026-07-08',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes:
				'Familiar prompt supports beginner output and maps directly to planned writing signals.'
		}
	},
	{
		id: 'speak-recent-purchase',
		version: 1,
		area: 'speaking',
		taskType: 'recorded_short_answer',
		prompt: 'Tell me about something you bought recently. What was it, and why did you buy it?',
		errorSignalTags: ['task_completion', 'clarity', 'fluency', 'verb_form', 'sentence_control'],
		explanation:
			'The response should name the item, explain the reason, and stay understandable in a short answer.',
		rubric: [
			'task_completion: names a recent purchase and gives a reason',
			'clarity: meaning is understandable',
			'fluency: answer is not blocked by long pauses',
			'grammar_control: basic past-tense and sentence control are usable'
		],
		learnerTask: {
			instructions:
				'Record a short answer: Tell me about something you bought recently. What was it, and why did you buy it?'
		},
		review: {
			authoringSessionId: 'codex-issue-16-authoring-2026-07-08',
			reviewSessionId: 'codex-issue-16-content-review-2026-07-08',
			reviewedAt: '2026-07-08',
			reviewerModel: 'gpt-5',
			status: 'accepted',
			notes: 'Safe everyday topic; no long-term audio storage implied by the seed item.'
		}
	}
] as const satisfies readonly AssessmentItem[];

export function getSeedAssessmentItems(): readonly AssessmentItem[] {
	validateSeedAssessmentItems(seedAssessmentItems);
	return seedAssessmentItems;
}

const currentAssessmentItems = (items: readonly AssessmentItem[]) => {
	const current = new Map<string, AssessmentItem>();
	for (const item of items) {
		if (!current.has(item.id) || current.get(item.id)!.version < item.version) {
			current.set(item.id, item);
		}
	}
	return [...current.values()];
};

export function getLearnerAssessmentItems(): LearnerAssessmentItem[] {
	return currentAssessmentItems(getSeedAssessmentItems()).map(toLearnerAssessmentItem);
}

const toLearnerAssessmentItem = ({
	id,
	version,
	area,
	taskType,
	prompt,
	learnerTask,
	serverOnlyAudioScript
}: AssessmentItem): LearnerAssessmentItem => ({
	id,
	version,
	area,
	taskType,
	prompt,
	learnerTask,
	...(serverOnlyAudioScript ? { audioUrl: `/assessment/audio/${id}?version=${version}` } : {})
});

export function getAssessmentItemVersion(itemId: string, itemVersion: number) {
	return getSeedAssessmentItems().find(
		(candidate) => candidate.id === itemId && candidate.version === itemVersion
	);
}

export function getLearnerAssessmentItemVersion(itemId: string, itemVersion: number) {
	const item = getAssessmentItemVersion(itemId, itemVersion);
	return item ? toLearnerAssessmentItem(item) : undefined;
}

export function getAssessmentItemAudioSource(itemId: string, itemVersion?: number) {
	const item = itemVersion
		? getAssessmentItemVersion(itemId, itemVersion)
		: currentAssessmentItems(getSeedAssessmentItems()).find((candidate) => candidate.id === itemId);
	if (!item?.serverOnlyAudioScript || !item.serverOnlyAudioMetadata) return;

	return {
		itemId: item.id,
		itemVersion: item.version,
		script: item.serverOnlyAudioScript,
		metadata: item.serverOnlyAudioMetadata
	};
}

export function validateSeedAssessmentItems(items: readonly AssessmentItem[]) {
	const requiredAreas = new Set<AssessmentArea>([
		'listening',
		'reading',
		'grammar_usage',
		'vocabulary',
		'writing',
		'speaking'
	]);

	const versions = new Set<string>();

	for (const item of items) {
		const versionKey = `${item.id}:${item.version}`;
		if (versions.has(versionKey)) throw new Error(`Duplicate Assessment Item ${versionKey}`);
		versions.add(versionKey);

		if (
			!item.id ||
			item.version < 1 ||
			!item.prompt ||
			!item.learnerTask.instructions ||
			!item.explanation
		) {
			throw new Error(`Assessment Item ${item.id || '(missing id)'} is missing required fields`);
		}

		if (item.errorSignalTags.length === 0) {
			throw new Error(`Assessment Item ${item.id} is missing Error Signal tags`);
		}

		if (
			item.answerKey?.length &&
			(!item.primaryScoredSignal || !item.errorSignalTags.includes(item.primaryScoredSignal))
		) {
			throw new Error(`Assessment Item ${item.id} needs one tagged primary scored signal`);
		}

		if (item.answerKey?.some((answer) => !item.choices?.some((choice) => choice.id === answer))) {
			throw new Error(`Assessment Item ${item.id} answer key must match a choice`);
		}

		if (item.serverOnlyAudioScript && !item.serverOnlyAudioMetadata) {
			throw new Error(`Assessment Item ${item.id} is missing generated audio metadata`);
		}

		if (!item.answerKey?.length && !item.rubric?.length) {
			throw new Error(`Assessment Item ${item.id} needs an answer key or rubric`);
		}

		if (
			!item.review.authoringSessionId ||
			!item.review.reviewSessionId ||
			!item.review.reviewedAt ||
			!item.review.reviewerModel ||
			!item.review.notes ||
			item.review.status !== 'accepted'
		) {
			throw new Error(`Assessment Item ${item.id} is missing AI Content Review metadata`);
		}

		if (item.review.authoringSessionId === item.review.reviewSessionId) {
			throw new Error(`Assessment Item ${item.id} review must be separate from authoring`);
		}
	}

	const currentItems = currentAssessmentItems(items);
	const counts = new Map<AssessmentArea, number>();
	for (const item of currentItems) {
		requiredAreas.delete(item.area);
		counts.set(item.area, (counts.get(item.area) ?? 0) + 1);
	}

	if (requiredAreas.size > 0) {
		throw new Error(`Assessment Item bank missing areas: ${[...requiredAreas].join(', ')}`);
	}

	for (const area of ['listening', 'reading', 'grammar_usage', 'vocabulary'] as const) {
		if (counts.get(area) !== 3) throw new Error(`Assessment Item bank needs three ${area} items`);
	}
	for (const area of ['writing', 'speaking'] as const) {
		if (counts.get(area) !== 1) throw new Error(`Assessment Item bank needs one ${area} item`);
	}
	if (currentItems.length !== 14)
		throw new Error('Assessment Item bank needs exactly 14 current items');
}
