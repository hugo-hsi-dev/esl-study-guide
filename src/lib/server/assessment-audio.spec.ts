import { describe, expect, it } from 'vitest';
import {
	assessmentAudioResponse,
	generateAssessmentAudio,
	getWorkersAiTtsModelId
} from './assessment-audio';
import { getAssessmentItemAudioSource } from './assessment-items';

describe('generateAssessmentAudio', () => {
	it('uses deterministic audio without a Workers AI binding', async () => {
		expect.assertions(6);

		const source = getAssessmentItemAudioSource('listen-mei-coworker-time');
		if (!source) throw new Error('missing test audio source');

		const audio = await generateAssessmentAudio(source, {});
		const response = assessmentAudioResponse(audio);

		expect(String.fromCharCode(...audio.bytes.slice(0, 4))).toBe('RIFF');
		expect(audio.provider).toBe('deterministic-fixture');
		expect(audio.model).toBe('@cf/myshell-ai/melotts');
		expect(response.headers.get('content-type')).toBe('audio/wav');
		expect(response.headers.get('x-audio-schema-version')).toBe('1');
		expect(response.headers.get('x-audio-item-version')).toBe('1');
	});

	it('reads the configured TTS model from the runtime env', () => {
		expect.assertions(1);

		expect(getWorkersAiTtsModelId({ WORKERS_AI_TTS_MODEL_ID: '@cf/example/tts' })).toBe(
			'@cf/example/tts'
		);
	});
});
