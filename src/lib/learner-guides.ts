import type { ErrorSignal } from '$lib/server/assessment-items';

export type LearnerGuide = {
	label: string;
	rule: string;
	workedExample: string;
	chineseClarification: string;
	hint: string;
	practiceNext: string;
};

export const learnerGuides = {
	main_idea: {
		label: 'main idea',
		rule: 'Choose the answer that summarizes the whole message, not one small detail.',
		workedExample:
			'Example: “The bus was late, so Ana missed the meeting.” Main idea: Ana missed a meeting because her bus was late.',
		chineseClarification: '主旨是整段话最重要的信息，不是其中一个小细节。',
		hint: 'Ask: “What is this mostly about?” Then check that your answer covers the full message.',
		practiceNext: 'State the main point in your own words before you choose an answer.'
	},
	detail: {
		label: 'supporting detail',
		rule: 'A detail answer must match specific information that the text or audio actually gives.',
		workedExample:
			'Example: “The appointment is Friday at 3:00.” The correct time detail is Friday at 3:00.',
		chineseClarification: '细节是文本或音频中明确出现的具体信息。',
		hint: 'Identify the exact person, place, time, number, or reason the question asks for.',
		practiceNext: 'Underline or repeat the exact words that support your answer.'
	},
	inference: {
		label: 'supported inference',
		rule: 'An inference must follow from clues in the text or audio, even when the answer is not stated word for word.',
		workedExample:
			'Example: “The sidewalk is wet and people are carrying umbrellas.” A supported inference is that it recently rained.',
		chineseClarification: '推论不是原文直接说出的信息，而是根据文中线索可以合理得出的结论。',
		hint: 'Name the clues first, then reject any answer that adds a fact those clues do not support.',
		practiceNext: 'State the conclusion and point to two details that make it reasonable.'
	},
	vocabulary_in_context: {
		label: 'vocabulary in context',
		rule: 'Use the words around an unfamiliar word to work out the meaning it has here.',
		workedExample:
			'Example: “The room was crowded, so we could not find a seat.” Crowded means full of people.',
		chineseClarification: '利用前后文判断单词在这里的意思，不要只看字面。',
		hint: 'Replace the target word with each option and choose the one that keeps the sentence logical.',
		practiceNext: 'Write one new sentence that shows the word’s meaning without defining it.'
	},
	verb_form: {
		label: 'verb form',
		rule: 'Use the time clue and nearby helping verb to choose the correct form of the verb.',
		workedExample:
			'Example: “Yesterday she worked.” The past-time word yesterday calls for worked.',
		chineseClarification: '先看时间词和助动词，再选择正确的动词形式。',
		hint: 'Find the time word first, then check whether the verb needs a base, past, or participle form.',
		practiceNext:
			'Say the completed sentence aloud and make one new sentence with the same time pattern.'
	},
	subject_verb_agreement: {
		label: 'subject-verb agreement',
		rule: 'The subject and present-tense verb must agree in number.',
		workedExample: 'Example: “He works,” but “They work.” A singular he takes works.',
		chineseClarification: '一般现在时中，第三人称单数动词通常加 -s；复数主语通常用原形。',
		hint: 'Circle the subject before choosing the verb. Decide whether it is singular or plural.',
		practiceNext: 'Change the subject from one person to two people and adjust the verb.'
	},
	article_determiner: {
		label: 'articles and determiners',
		rule: 'Use a/an for one nonspecific countable thing and the for a specific or already-known thing.',
		workedExample: 'Example: “I saw a dog. The dog was friendly.” The second mention uses the.',
		chineseClarification: '第一次提到一个可数名词常用 a/an；再次提到或特指时常用 the。',
		hint: 'Ask whether the noun is countable and whether the listener already knows which one you mean.',
		practiceNext:
			'Describe one object using a/an first, then mention the same object again with the.'
	},
	plural_countability: {
		label: 'plurals and countability',
		rule: 'Countable nouns can use numbers and plural forms; uncountable nouns usually cannot.',
		workedExample: 'Example: “two bags” is countable, but “some information” is uncountable.',
		chineseClarification: '可数名词可以和数字、复数形式一起用；不可数名词通常不能直接加 -s。',
		hint: 'Look for a number or quantity word, then decide whether the noun can be counted individually.',
		practiceNext: 'Make one phrase with a countable noun and one with an uncountable noun.'
	},
	preposition: {
		label: 'prepositions',
		rule: 'Prepositions show relationships such as time, place, direction, and fixed word patterns.',
		workedExample: 'Example: use at with a clock time: “The meeting starts at 9:00.”',
		chineseClarification: '介词常和时间、地点或固定搭配一起记忆。',
		hint: 'Read the full phrase, not only the blank; many prepositions belong to a fixed pattern.',
		practiceNext:
			'Save the whole phrase, such as “at 9:00,” instead of memorizing only the preposition.'
	},
	pronoun_choice: {
		label: 'pronoun choice',
		rule: 'Choose a pronoun that matches the person or thing and its job in the sentence.',
		workedExample: 'Example: “Mina called. She left a message.” She is the subject replacing Mina.',
		chineseClarification: '代词要和所代替的人或物一致，也要符合它在句子中的作用。',
		hint: 'Identify the noun the pronoun replaces, then ask whether the blank is a subject, object, or possession.',
		practiceNext: 'Repeat the sentence once with the full name and once with the correct pronoun.'
	},
	sentence_control: {
		label: 'sentence control',
		rule: 'A complete sentence needs a clear subject and verb, with ideas joined in a controlled way.',
		workedExample:
			'Example: “I was tired, so I went home.” So clearly connects two complete ideas.',
		chineseClarification: '完整句通常需要主语和谓语；连接词可以帮助清楚地连接意思。',
		hint: 'Check for a subject and verb in each main idea, then choose a connector that shows the relationship.',
		practiceNext:
			'Rewrite the idea as two complete sentences, then join them with because, but, or so.'
	},
	collocation: {
		label: 'natural word combinations',
		rule: 'Some English words naturally occur together and should be learned as one phrase.',
		workedExample: 'Example: English uses “make a decision,” not “do a decision.”',
		chineseClarification: '英语中有些词通常固定搭配，最好把它们作为一个词组来学习。',
		hint: 'Choose the phrase you have seen or heard as a complete unit in natural English.',
		practiceNext: 'Use the full word combination in a sentence about your own life.'
	},
	task_completion: {
		label: 'task completion',
		rule: 'A complete response answers every part of the prompt with relevant information.',
		workedExample:
			'Example: for “Name a food and say why,” “I like noodles because they are quick to cook” answers both parts.',
		chineseClarification: '先找出题目的每一项要求，再检查是否全部回答。',
		hint: 'Count the requests in the prompt and plan one clear point for each request.',
		practiceNext:
			'Before submitting, point to the part of your response that answers each instruction.'
	},
	clarity: {
		label: 'clarity',
		rule: 'Use clear word order and specific information so the reader or listener does not need to guess.',
		workedExample:
			'Example: “I will arrive ten minutes late” is clearer than “I arrive late maybe.”',
		chineseClarification: '使用清楚的语序和具体信息，让读者或听者不用猜测。',
		hint: 'Use a simple subject-verb order first, then add the most useful detail.',
		practiceNext: 'Read your response once and replace one vague word with a specific detail.'
	},
	fluency: {
		label: 'fluency',
		rule: 'Fluency means keeping a message moving with connected ideas, not speaking as fast as possible.',
		workedExample: 'Example: “First I called. Then I explained the problem. Finally we fixed it.”',
		chineseClarification: '流利度重在持续、连贯地表达，不是说得越快越好。',
		hint: 'Plan three short points and connect them with words such as first, then, and finally.',
		practiceNext: 'Give the response again using one more connector and fewer long pauses.'
	}
} satisfies Record<ErrorSignal, LearnerGuide>;

export const getLearnerGuide = (signal: ErrorSignal): LearnerGuide => learnerGuides[signal];
