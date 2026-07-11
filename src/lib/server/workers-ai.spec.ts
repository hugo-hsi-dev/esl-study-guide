import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
	AiOutputValidationError,
	AiProviderTimeoutError,
	runWorkersAiJson,
	transcribeSpeakingAudio,
	type WorkersAiRuntime
} from './workers-ai';

const runtime = (run: WorkersAiRuntime['ai']['run']): WorkersAiRuntime => ({
	provider: 'workers-ai',
	ai: { run },
	textModelId: '@cf/meta/llama-3.1-8b-instruct-fp8',
	transcriptionModelId: '@cf/openai/whisper-large-v3-turbo'
});

describe('speaking audio boundaries', () => {
	it('rejects an unsupported MIME type before any provider call', async () => {
		expect.assertions(1);
		const file = new File(['not audio'], 'response.txt', { type: 'text/plain' });

		await expect(transcribeSpeakingAudio(file)).rejects.toBeInstanceOf(AiOutputValidationError);
	});

	it('rejects audio larger than 10 MiB', async () => {
		expect.assertions(1);
		const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'response.webm', {
			type: 'audio/webm'
		});

		await expect(transcribeSpeakingAudio(file)).rejects.toThrow('Speaking audio is too large.');
	});
});

describe('runWorkersAiJson', () => {
	it('parses valid JSON model output', async () => {
		expect.assertions(1);

		await expect(
			runWorkersAiJson(
				runtime(async () => ({ response: '{"ok":true}' })),
				[{ role: 'user', content: 'return json' }],
				z.object({ ok: z.boolean() })
			)
		).resolves.toEqual({ ok: true });
	});

	it('times out slow JSON generation', async () => {
		expect.assertions(1);

		await expect(
			runWorkersAiJson(
				runtime(() => new Promise(() => {})),
				[{ role: 'user', content: 'return json' }],
				z.object({ ok: z.boolean() }),
				{ timeoutMs: 1 }
			)
		).rejects.toBeInstanceOf(AiProviderTimeoutError);
	});
});
