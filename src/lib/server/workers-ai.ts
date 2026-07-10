import { getRequestEvent } from '$app/server';
import { z } from 'zod';

type WorkersAiBinding = {
	run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
};

export type WorkersAiRuntime = {
	provider: 'workers-ai';
	ai: WorkersAiBinding;
	textModelId: string;
	transcriptionModelId: string;
};

export class AiOutputValidationError extends Error {}
export class AiProviderTimeoutError extends Error {}

const DEFAULT_TEXT_MODEL_ID = '@cf/meta/llama-3.1-8b-instruct-fp8';
const DEFAULT_TRANSCRIPTION_MODEL_ID = '@cf/openai/whisper-large-v3-turbo';
const DEFAULT_JSON_TIMEOUT_MS = 2000;
const MAX_SPEAKING_AUDIO_BYTES = 10 * 1024 * 1024;
const ALLOWED_SPEAKING_AUDIO_TYPES = new Set([
	'audio/webm',
	'audio/wav',
	'audio/x-wav',
	'audio/mpeg',
	'audio/mp4',
	'audio/ogg'
]);

export const getWorkersAiRuntime = (): WorkersAiRuntime | null => {
	try {
		const env = getRequestEvent().platform?.env;
		if (!env?.AI) return null;

		const vars = env as Env &
			Partial<Record<'WORKERS_AI_TEXT_MODEL_ID' | 'WORKERS_AI_TRANSCRIPTION_MODEL_ID', string>>;

		return {
			provider: 'workers-ai',
			ai: env.AI as WorkersAiBinding,
			textModelId: vars.WORKERS_AI_TEXT_MODEL_ID || DEFAULT_TEXT_MODEL_ID,
			transcriptionModelId: vars.WORKERS_AI_TRANSCRIPTION_MODEL_ID || DEFAULT_TRANSCRIPTION_MODEL_ID
		};
	} catch {
		return null;
	}
};

const extractText = (output: unknown) => {
	if (typeof output === 'string') return output;
	if (!output || typeof output !== 'object') return '';

	const record = output as Record<string, unknown>;
	if (typeof record.response === 'string') return record.response;
	if (typeof record.text === 'string') return record.text;
	if (typeof record.result === 'string') return record.result;
	return '';
};

const parseJson = (text: string) => {
	const trimmed = text.trim();
	const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
	return JSON.parse(fenced ?? trimmed);
};

export async function runWorkersAiJson<T>(
	runtime: WorkersAiRuntime,
	messages: { role: 'system' | 'user'; content: string }[],
	schema: z.ZodType<T>,
	options: { timeoutMs?: number } = {}
) {
	const outputPromise = runtime.ai.run(runtime.textModelId, {
		messages,
		temperature: 0.1,
		max_tokens: 1800,
		response_format: { type: 'json_object' }
	});
	outputPromise.catch(() => {});

	const timeoutMs = options.timeoutMs ?? DEFAULT_JSON_TIMEOUT_MS;
	let timeout: ReturnType<typeof setTimeout> | undefined;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeout = setTimeout(
			() => reject(new AiProviderTimeoutError('Workers AI JSON generation timed out.')),
			timeoutMs
		);
	});

	let output: unknown;
	try {
		output = await Promise.race([outputPromise, timeoutPromise]);
	} finally {
		if (timeout) clearTimeout(timeout);
	}

	try {
		return schema.parse(parseJson(extractText(output)));
	} catch (error) {
		throw new AiOutputValidationError(
			error instanceof Error ? error.message : 'Workers AI returned invalid JSON.'
		);
	}
}

export async function transcribeSpeakingAudio(file: File) {
	const runtime = getWorkersAiRuntime();
	if (file.size === 0) return null;
	if (file.size > MAX_SPEAKING_AUDIO_BYTES) {
		throw new AiOutputValidationError('Speaking audio is too large.');
	}
	if (!ALLOWED_SPEAKING_AUDIO_TYPES.has(file.type.toLowerCase().split(';')[0])) {
		throw new AiOutputValidationError('Speaking audio must be WebM, WAV, MP3, MP4, or Ogg.');
	}
	if (!runtime) return null;

	const audio = [...new Uint8Array(await file.arrayBuffer())];
	const output = await runtime.ai.run(runtime.transcriptionModelId, { audio });

	try {
		const result = z.object({ text: z.string().trim().min(1) }).parse(output);
		return {
			text: result.text,
			metadata: {
				provider: runtime.provider,
				model: runtime.transcriptionModelId,
				modelVersion: '2026-07-08' as const
			}
		};
	} catch (error) {
		throw new AiOutputValidationError(
			error instanceof Error ? error.message : 'Workers AI returned invalid ASR output.'
		);
	}
}
