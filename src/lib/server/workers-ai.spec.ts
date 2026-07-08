import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AiProviderTimeoutError, runWorkersAiJson, type WorkersAiRuntime } from './workers-ai';

const runtime = (run: WorkersAiRuntime['ai']['run']): WorkersAiRuntime => ({
	provider: 'workers-ai',
	ai: { run },
	textModelId: '@cf/meta/llama-3.1-8b-instruct-fp8',
	transcriptionModelId: '@cf/openai/whisper-large-v3-turbo'
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
