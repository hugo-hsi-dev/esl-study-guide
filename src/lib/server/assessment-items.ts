export type AssessmentArea =
	'listening' | 'reading' | 'grammar_usage' | 'vocabulary' | 'writing' | 'speaking';

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
	id: string;
	text: string;
};

type ReviewMetadata = {
	authoringSessionId: string;
	reviewSessionId: string;
	reviewedAt: string;
	reviewerModel: string;
	status: 'accepted';
	notes: string;
};

type AssessmentItem = {
	id: string;
	version: number;
	area: AssessmentArea;
	taskType: string;
	prompt: string;
	errorSignalTags: ErrorSignal[];
	explanation: string;
	answerKey?: string[];
	rubric?: string[];
	choices?: Choice[];
	serverOnlyAudioScript?: string;
	serverOnlyAudioMetadata?: {
		provider: 'workers-ai';
		model: '@cf/deepgram/aura-2-en';
		schemaVersion: 1;
	};
	learnerTask: {
		instructions: string;
		choices?: Choice[];
	};
	review: ReviewMetadata;
};

export type LearnerAssessmentItem = Pick<
	AssessmentItem,
	'id' | 'version' | 'area' | 'taskType' | 'prompt' | 'errorSignalTags' | 'learnerTask'
> & { audioUrl?: string };

export const seedAssessmentItems = [
	{
		id: 'listen-mei-coworker-time',
		version: 1,
		area: 'listening',
		taskType: 'short_audio_comprehension',
		prompt: 'Listen to a short conversation and choose the correct detail.',
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
		id: 'read-lina-return-jacket',
		version: 1,
		area: 'reading',
		taskType: 'short_passage_comprehension',
		prompt: 'Lina bought a jacket online. It was too small, so she sent it back the next day.',
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
		id: 'grammar-simple-present-goes',
		version: 1,
		area: 'grammar_usage',
		taskType: 'fill_in_the_blank',
		prompt: 'She ____ to work every morning.',
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
		id: 'vocab-delayed-train',
		version: 1,
		area: 'vocabulary',
		taskType: 'word_in_context',
		prompt: 'The train was delayed, so I arrived late.',
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
		id: 'write-problem-solved-last-week',
		version: 1,
		area: 'writing',
		taskType: 'short_paragraph',
		prompt: 'Write 4-5 sentences about a problem you solved last week.',
		errorSignalTags: [
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
] satisfies AssessmentItem[];

export function getSeedAssessmentItems() {
	validateSeedAssessmentItems(seedAssessmentItems);
	return seedAssessmentItems;
}

export function getLearnerAssessmentItems(): LearnerAssessmentItem[] {
	return getSeedAssessmentItems().map(
		({
			id,
			version,
			area,
			taskType,
			prompt,
			errorSignalTags,
			learnerTask,
			serverOnlyAudioScript
		}) => ({
			id,
			version,
			area,
			taskType,
			prompt,
			errorSignalTags,
			learnerTask,
			...(serverOnlyAudioScript ? { audioUrl: `/assessment/audio/${id}` } : {})
		})
	);
}

export function getAssessmentItemAudioSource(itemId: string) {
	const item = getSeedAssessmentItems().find((candidate) => candidate.id === itemId);
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

	for (const item of items) {
		requiredAreas.delete(item.area);

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

	if (requiredAreas.size > 0) {
		throw new Error(`Assessment Item bank missing areas: ${[...requiredAreas].join(', ')}`);
	}
}
