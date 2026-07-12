import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assessmentChoiceControlId, assessmentItemDomKey } from './form-identity';

describe('assessment form identity', () => {
	it('keeps DOM keys stable for one item and distinct across items and versions', () => {
		expect.assertions(4);

		const first = { id: 'listen-time', version: 1 };
		const second = { id: 'read-detail', version: 1 };

		expect(assessmentItemDomKey(first)).toBe('listen-time:1');
		expect(assessmentItemDomKey(first)).not.toBe(assessmentItemDomKey(second));
		expect(assessmentItemDomKey(first)).not.toBe(
			assessmentItemDomKey({ ...first, version: first.version + 1 })
		);
		expect(assessmentChoiceControlId(first, 'a')).not.toBe(assessmentChoiceControlId(second, 'a'));
	});

	it('keeps item forms keyed and multipart in the assessment page', () => {
		expect.assertions(12);

		const source = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');

		expect(source).toContain('{#key assessmentItemDomKey(currentItem)}');
		expect(source.indexOf('{#key assessmentItemDomKey(currentItem)}')).toBeLessThan(
			source.indexOf('{const stepForm = saveAssessmentResponse.for(currentItem.id)}')
		);
		expect(source).toContain(
			'const savedResponse = $derived(currentItem ? responseFor(currentItem.id) : undefined);'
		);
		expect(source).toContain('(`${itemDomKey}:${choice.id}`)');
		expect(source).toContain('enctype="multipart/form-data"');
		expect(source).toContain('onended={() => acknowledgeListeningPlayback');
		expect(source).not.toContain('onplay={() => acknowledgeListeningPlayback');
		expect(source).toContain('name="listeningAcknowledgement"');
		expect(source).toContain("searchParams.get('new') === '1'");
		expect(source).toContain('>Play full recording</button');
		expect(source).toContain("currentItem?.taskType === 'writeplacer_esl_readiness_essay'");
		expect(source).not.toContain("currentItem?.id === 'accu-writeplacer-community-change'");
	});

	it('shows another-baseline controls only when an undisclosed option exists', () => {
		const source = readFileSync(new URL('./+page.svelte', import.meta.url), 'utf8');
		const remoteSource = readFileSync(new URL('./data.remote.ts', import.meta.url), 'utf8');

		expect(source).toContain('When to use another baseline');
		expect(source).toContain('{#if assessment.reassessment?.anyBaselineAvailable}');
		expect(source).toContain('Keep practicing this target until');
		expect(source).toContain(
			'A changed test profile or section subset can start only when every task'
		);
		expect(source).toContain(
			'Every reviewed baseline option contains a task you have already seen'
		);
		expect(source).not.toContain('>Start a new baseline</button');
		expect(remoteSource).toContain(
			"import { getPracticeProgress } from '$lib/server/adaptive-practice';"
		);
		expect(remoteSource).toContain('reassessmentContext: practiceProgress?.reassessmentContext');
	});
});
