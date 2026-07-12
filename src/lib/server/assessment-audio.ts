import type { getAssessmentItemAudioSource } from './assessment-items';

export const defaultWorkersAiTtsModel = '@cf/deepgram/aura-2-en';
export const assessmentAudioSchemaVersion = 1;

type AudioSource = NonNullable<ReturnType<typeof getAssessmentItemAudioSource>>;
type TtsOutput = ReadableStream | Uint8Array | string | { audio: string };
type TtsBinding = {
	run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
};
type TtsEnv = {
	AI?: TtsBinding;
	WORKERS_AI_TTS_MODEL_ID?: string;
};

export type GeneratedAssessmentAudio = {
	bytes: Uint8Array;
	contentType: 'audio/mpeg' | 'audio/wav';
	provider: 'workers-ai' | 'reviewed-fixture';
	model: string;
	schemaVersion: number;
	itemVersion: number;
};

export const reviewedAssessmentAudioFixtures = {
	'listen-mei-coworker-time': {
		itemVersion: 1,
		path: '/assessment-audio/listen-mei-coworker-time.wav'
	},
	'listen-ana-pharmacy-main-idea': {
		itemVersion: 1,
		path: '/assessment-audio/listen-ana-pharmacy-main-idea.wav'
	},
	'listen-bus-platform-detail': {
		itemVersion: 1,
		path: '/assessment-audio/listen-bus-platform-detail.wav'
	},
	'accu-listen-aid-deadline': {
		itemVersion: 1,
		path: '/assessment-audio/accu-listen-aid-deadline.wav'
	},
	'accu-listen-urban-trees-purpose': {
		itemVersion: 1,
		path: '/assessment-audio/accu-listen-urban-trees-purpose.wav'
	},
	'cept-listen-tutorial-change': {
		itemVersion: 1,
		path: '/assessment-audio/cept-listen-tutorial-change.wav'
	},
	'cept-listen-bicycle-study': {
		itemVersion: 1,
		path: '/assessment-audio/cept-listen-bicycle-study.wav'
	},
	'listen-lee-clinic-time-b': {
		itemVersion: 1,
		path: '/assessment-audio/listen-lee-clinic-time-b.wav'
	},
	'listen-nora-package-main-idea-b': {
		itemVersion: 1,
		path: '/assessment-audio/listen-nora-package-main-idea-b.wav'
	},
	'listen-airport-train-track-b': {
		itemVersion: 1,
		path: '/assessment-audio/listen-airport-train-track-b.wav'
	},
	'accu-listen-registration-room-b': {
		itemVersion: 1,
		path: '/assessment-audio/accu-listen-registration-room-b.wav'
	},
	'accu-listen-reusable-containers-purpose-b': {
		itemVersion: 1,
		path: '/assessment-audio/accu-listen-reusable-containers-purpose-b.wav'
	},
	'cept-listen-lab-change-b': {
		itemVersion: 1,
		path: '/assessment-audio/cept-listen-lab-change-b.wav'
	},
	'cept-listen-part-time-study-b': {
		itemVersion: 1,
		path: '/assessment-audio/cept-listen-part-time-study-b.wav'
	},
	'listening-main_idea-foundation-1': {
		itemVersion: 1,
		path: '/practice-audio/listening-main_idea-foundation-1.wav'
	},
	'listening-main_idea-foundation-2': {
		itemVersion: 1,
		path: '/practice-audio/listening-main_idea-foundation-2.wav'
	},
	'listening-main_idea-practice-1': {
		itemVersion: 1,
		path: '/practice-audio/listening-main_idea-practice-1.wav'
	},
	'listening-main_idea-practice-2': {
		itemVersion: 1,
		path: '/practice-audio/listening-main_idea-practice-2.wav'
	},
	'listening-main_idea-challenge-1': {
		itemVersion: 1,
		path: '/practice-audio/listening-main_idea-challenge-1.wav'
	},
	'listening-main_idea-challenge-2': {
		itemVersion: 1,
		path: '/practice-audio/listening-main_idea-challenge-2.wav'
	},
	'listening-detail-foundation-1': {
		itemVersion: 1,
		path: '/practice-audio/listening-detail-foundation-1.wav'
	},
	'listening-detail-foundation-2': {
		itemVersion: 1,
		path: '/practice-audio/listening-detail-foundation-2.wav'
	},
	'listening-detail-practice-1': {
		itemVersion: 1,
		path: '/practice-audio/listening-detail-practice-1.wav'
	},
	'listening-detail-practice-2': {
		itemVersion: 1,
		path: '/practice-audio/listening-detail-practice-2.wav'
	},
	'listening-detail-challenge-1': {
		itemVersion: 1,
		path: '/practice-audio/listening-detail-challenge-1.wav'
	},
	'listening-detail-challenge-2': {
		itemVersion: 1,
		path: '/practice-audio/listening-detail-challenge-2.wav'
	}
} as const;

export const reviewedAssessmentAudioModel = 'versioned-static-speech-v1';

export function getReviewedAssessmentAudioFixture(source: AudioSource) {
	const fixture =
		reviewedAssessmentAudioFixtures[source.itemId as keyof typeof reviewedAssessmentAudioFixtures];
	return fixture?.itemVersion === source.itemVersion ? fixture : undefined;
}

export async function loadReviewedAssessmentAudio(
	source: AudioSource,
	baseUrl: URL,
	fetcher: typeof fetch
): Promise<GeneratedAssessmentAudio | null> {
	const fixture = getReviewedAssessmentAudioFixture(source);
	if (!fixture) return null;
	const response = await fetcher(new URL(fixture.path, baseUrl));
	if (!response.ok) return null;
	const bytes = new Uint8Array(await response.arrayBuffer());
	if (bytes.length <= 44 || new TextDecoder().decode(bytes.slice(0, 4)) !== 'RIFF') return null;
	return {
		bytes,
		contentType: 'audio/wav',
		provider: 'reviewed-fixture',
		model: reviewedAssessmentAudioModel,
		schemaVersion: assessmentAudioSchemaVersion,
		itemVersion: source.itemVersion
	};
}

export class AssessmentAudioUnavailableError extends Error {
	constructor() {
		super('Listening audio is temporarily unavailable. This item must not be scored.');
	}
}

export const getWorkersAiTtsModelId = (env?: TtsEnv) =>
	env?.WORKERS_AI_TTS_MODEL_ID || defaultWorkersAiTtsModel;

export async function generateAssessmentAudio(
	source: AudioSource,
	env?: TtsEnv
): Promise<GeneratedAssessmentAudio> {
	const model = getWorkersAiTtsModelId(env);

	if (!env?.AI) throw new AssessmentAudioUnavailableError();

	try {
		const output = (await env.AI.run(model, ttsInputs(model, source.script))) as TtsOutput;

		return {
			bytes: await ttsOutputBytes(output),
			contentType: 'audio/mpeg',
			provider: 'workers-ai',
			model,
			schemaVersion: assessmentAudioSchemaVersion,
			itemVersion: source.itemVersion
		};
	} catch {
		throw new AssessmentAudioUnavailableError();
	}
}

function ttsInputs(model: string, text: string) {
	return model.startsWith('@cf/deepgram/aura')
		? { text, encoding: 'mp3' }
		: { prompt: text, lang: 'en' };
}

export function assessmentAudioCacheKey(requestUrl: string, source: AudioSource, model: string) {
	const url = new URL(requestUrl);
	url.search = '';
	url.searchParams.set('itemVersion', String(source.itemVersion));
	url.searchParams.set('schemaVersion', String(assessmentAudioSchemaVersion));
	url.searchParams.set('model', model);
	return url.toString();
}

export function assessmentAudioResponse(audio: GeneratedAssessmentAudio) {
	return new Response(audio.bytes.slice().buffer, {
		headers: {
			'cache-control': 'public, max-age=31536000, immutable',
			'content-type': audio.contentType,
			'x-audio-provider': audio.provider,
			'x-audio-model': audio.model,
			'x-audio-schema-version': String(audio.schemaVersion),
			'x-audio-item-version': String(audio.itemVersion)
		}
	});
}

function base64ToBytes(value: string) {
	return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function ttsOutputBytes(output: TtsOutput) {
	if (output instanceof Uint8Array) return output;
	if (output instanceof ReadableStream)
		return new Uint8Array(await new Response(output).arrayBuffer());
	return base64ToBytes(typeof output === 'string' ? output : output.audio);
}
