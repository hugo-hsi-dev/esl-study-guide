import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
	generatePracticeProblem,
	inferPlacementTestProfile,
	practiceDifficulties
} from './adaptive-practice';
import type { SkillProfile, StudyPlan } from './assessment-diagnosis';
import {
	generateAssessmentAudio,
	getReviewedAssessmentAudioFixture,
	getWorkersAiTtsModelId,
	loadReviewedAssessmentAudio,
	reviewedAssessmentAudioFixtures
} from './assessment-audio';
import { getAssessmentItemAudioSource, getSeedAssessmentItems } from './assessment-items';

describe('generateAssessmentAudio', () => {
	it('ships non-empty versioned speech files for every reviewed fixture', async () => {
		expect.assertions(Object.keys(reviewedAssessmentAudioFixtures).length * 3);

		for (const fixture of Object.values(reviewedAssessmentAudioFixtures)) {
			const bytes = await readFile(resolve('static', fixture.path.slice(1)));
			expect(bytes.subarray(0, 4).toString('ascii')).toBe('RIFF');
			expect(bytes.subarray(8, 12).toString('ascii')).toBe('WAVE');
			expect(bytes.byteLength).toBeGreaterThan(100_000);
		}
	});

	it('loads a version-matched spoken fixture before TTS', async () => {
		expect.assertions(5);

		const source = getAssessmentItemAudioSource('listen-mei-coworker-time');
		if (!source) throw new Error('missing test audio source');
		const wav = new Uint8Array(48);
		wav.set(new TextEncoder().encode('RIFF'));
		const audio = await loadReviewedAssessmentAudio(
			source,
			new URL('https://study.example/assessment/audio/item'),
			async (input) => {
				expect(String(input)).toBe(
					'https://study.example/assessment-audio/listen-mei-coworker-time.wav'
				);
				return new Response(wav);
			}
		);

		expect(audio?.provider).toBe('reviewed-fixture');
		expect(audio?.contentType).toBe('audio/wav');
		expect(audio?.bytes).toHaveLength(48);
		expect(audio?.itemVersion).toBe(1);
	});

	it('maps every reviewed assessment listening script to a version-matched fixture', () => {
		const listeningItems = getSeedAssessmentItems().filter(
			(item) => item.serverOnlyAudioScript !== undefined
		);

		for (const item of listeningItems) {
			const source = getAssessmentItemAudioSource(item.id, item.version);
			expect(source).toBeDefined();
			expect(getReviewedAssessmentAudioFixture(source!)).toBeDefined();
		}
	});

	it('maps every reachable deterministic listening fallback to a version-matched RIFF fixture', async () => {
		const skillProfile = {
			skillBands: {
				listening: 'developing',
				reading: 'developing',
				grammar_usage: 'developing',
				vocabulary: 'developing',
				writing: 'developing',
				speaking: 'developing'
			}
		} as SkillProfile;
		const studyPlan = {
			targets: [],
			targetSignals: [],
			reassessAfterPracticeCount: 20
		} as StudyPlan;
		const placementProfile = inferPlacementTestProfile('', {
			kind: 'not_sure',
			institution: '',
			targetOutcome: ''
		});
		const reachedIds = new Set<string>();

		for (const targetSignal of ['main_idea', 'detail'] as const) {
			for (const difficulty of practiceDifficulties) {
				const selection = {
					targetArea: 'listening' as const,
					targetSignal,
					difficulty,
					adaptiveReason: 'plan_balance' as const
				};
				const first = await generatePracticeProblem({
					skillProfile,
					studyPlan,
					placementProfile,
					selection,
					runtime: null
				});
				const second = await generatePracticeProblem({
					skillProfile,
					studyPlan,
					placementProfile,
					selection: { ...selection, excludeContentId: first.problem.id },
					runtime: null
				});

				for (const generated of [first, second]) {
					const problem = generated.problem;
					expect(problem.kind).toBe('listening_choice');
					if (problem.kind !== 'listening_choice') throw new Error('Expected listening fallback.');
					reachedIds.add(problem.id);
					const fixture = getReviewedAssessmentAudioFixture({
						itemId: problem.id,
						itemVersion: 1,
						script: problem.audioScript,
						metadata: {
							provider: 'workers-ai',
							model: '@cf/deepgram/aura-2-en',
							schemaVersion: 1
						}
					});
					expect(fixture?.itemVersion, problem.id).toBe(1);
					const bytes = await readFile(resolve('static', fixture!.path.slice(1)));
					expect(bytes.subarray(0, 4).toString('ascii'), problem.id).toBe('RIFF');
					expect(bytes.subarray(8, 12).toString('ascii'), problem.id).toBe('WAVE');
					expect(bytes.byteLength, problem.id).toBeGreaterThan(100_000);
				}
			}
		}

		expect(reachedIds).toEqual(
			new Set(
				['main_idea', 'detail'].flatMap((signal) =>
					practiceDifficulties.flatMap((difficulty) => [
						`listening-${signal}-${difficulty}-1`,
						`listening-${signal}-${difficulty}-2`
					])
				)
			)
		);
	});

	it.each([
		['cept-listen-tutorial-change.wav', 'cept-listen-bicycle-study.wav'],
		['cept-listen-lab-change-b.wav', 'cept-listen-part-time-study-b.wav']
	])('ships byte-identical audio for each CEPT paired-stimulus set', async (first, second) => {
		const [firstBytes, secondBytes] = await Promise.all([
			readFile(resolve('static', 'assessment-audio', first)),
			readFile(resolve('static', 'assessment-audio', second))
		]);

		expect(firstBytes.equals(secondBytes)).toBe(true);
	});

	it('fails closed without a Workers AI binding', async () => {
		expect.assertions(1);

		const source = getAssessmentItemAudioSource('listen-mei-coworker-time');
		if (!source) throw new Error('missing test audio source');

		await expect(generateAssessmentAudio(source, {})).rejects.toThrow(
			'Listening audio is temporarily unavailable'
		);
	});

	it('reads the configured TTS model from the runtime env', () => {
		expect.assertions(1);

		expect(getWorkersAiTtsModelId({ WORKERS_AI_TTS_MODEL_ID: '@cf/example/tts' })).toBe(
			'@cf/example/tts'
		);
	});

	it('uses Aura text input and base64 output when configured', async () => {
		expect.assertions(4);

		const source = getAssessmentItemAudioSource('listen-mei-coworker-time');
		if (!source) throw new Error('missing test audio source');

		let call: { model: string; inputs: Record<string, unknown> } | undefined;
		const audio = await generateAssessmentAudio(source, {
			WORKERS_AI_TTS_MODEL_ID: '@cf/deepgram/aura-2-en',
			AI: {
				run: async (model, inputs) => {
					call = { model, inputs };
					return btoa('mp3');
				}
			}
		});

		expect(call?.model).toBe('@cf/deepgram/aura-2-en');
		expect(call?.inputs).toEqual({ text: source.script, encoding: 'mp3' });
		expect(audio.provider).toBe('workers-ai');
		expect(new TextDecoder().decode(audio.bytes)).toBe('mp3');
	});

	it('fails closed when Workers AI TTS fails', async () => {
		expect.assertions(1);

		const source = getAssessmentItemAudioSource('listen-mei-coworker-time');
		if (!source) throw new Error('missing test audio source');

		await expect(
			generateAssessmentAudio(source, {
				AI: {
					run: async () => {
						throw new Error('TTS failed');
					}
				}
			})
		).rejects.toThrow('Listening audio is temporarily unavailable');
	});
});
