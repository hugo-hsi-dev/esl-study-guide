import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('practice listening playback evidence', () => {
	it('does not count preload GET requests and records only the explicit playback POST', () => {
		expect.assertions(6);
		const source = readFileSync(
			new URL('./audio/[practiceId]/+server.ts', import.meta.url),
			'utf8'
		);
		const page = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');
		const getHandler = source.slice(
			source.indexOf('export const GET'),
			source.indexOf('export const POST')
		);
		const postHandler = source.slice(source.indexOf('export const POST'));

		expect(getHandler).not.toContain('markPracticeListeningAudioDelivered');
		expect(postHandler).toContain('getPracticeListeningAudioSource(db, learner.id, practiceId)');
		expect(postHandler).toContain(
			'markPracticeListeningAudioDelivered(db, learner.id, practiceId)'
		);
		expect(page).toContain('onended={() =>');
		expect(page).not.toContain('onplay={() =>');
		expect(page).toContain('>Play full recording</button');
	});
});
