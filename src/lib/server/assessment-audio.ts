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
	provider: 'workers-ai' | 'deterministic-fixture';
	model: string;
	schemaVersion: number;
	itemVersion: number;
};

export const getWorkersAiTtsModelId = (env?: TtsEnv) =>
	env?.WORKERS_AI_TTS_MODEL_ID || defaultWorkersAiTtsModel;

export async function generateAssessmentAudio(
	source: AudioSource,
	env?: TtsEnv
): Promise<GeneratedAssessmentAudio> {
	const model = getWorkersAiTtsModelId(env);

	if (!env?.AI) return deterministicAudio(source, model);

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
		return deterministicAudio(source, model);
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

function deterministicAudio(source: AudioSource, model: string): GeneratedAssessmentAudio {
	return {
		bytes: deterministicWav(source.script),
		contentType: 'audio/wav',
		provider: 'deterministic-fixture',
		model,
		schemaVersion: assessmentAudioSchemaVersion,
		itemVersion: source.itemVersion
	};
}

function deterministicWav(seed: string) {
	const sampleRate = 8000;
	const sampleCount = Math.floor(sampleRate * 0.2);
	const bytes = new Uint8Array(44 + sampleCount * 2);
	const view = new DataView(bytes.buffer);
	const frequency = 440 + (seed.length % 12) * 20;

	writeAscii(bytes, 0, 'RIFF');
	view.setUint32(4, bytes.length - 8, true);
	writeAscii(bytes, 8, 'WAVEfmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	writeAscii(bytes, 36, 'data');
	view.setUint32(40, sampleCount * 2, true);

	for (let i = 0; i < sampleCount; i += 1) {
		view.setInt16(44 + i * 2, Math.sin((i / sampleRate) * frequency * Math.PI * 2) * 8000, true);
	}

	return bytes;
}

function writeAscii(bytes: Uint8Array, offset: number, value: string) {
	for (let i = 0; i < value.length; i += 1) bytes[offset + i] = value.charCodeAt(i);
}
