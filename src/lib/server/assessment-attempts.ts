import { assessmentAttempt, type AttemptResponse, type AttemptSelectedItem } from './db/schema';
import type { Db } from './db';
import { getLearnerAssessmentItems, type AssessmentArea } from './assessment-items';

const requiredAreas = new Set<AssessmentArea>([
	'listening',
	'reading',
	'grammar_usage',
	'vocabulary',
	'writing',
	'speaking'
]);

export class AssessmentAttemptInputError extends Error {}

const stringField = (formData: FormData, name: string) => {
	const value = formData.get(name);
	return typeof value === 'string' ? value.trim() : '';
};

export function buildAssessmentAttemptPayload(formData: FormData) {
	const items = getLearnerAssessmentItems();
	const seenAreas = new Set<AssessmentArea>();
	const selectedItems: AttemptSelectedItem[] = [];
	const responses: AttemptResponse[] = [];

	for (const item of items) {
		seenAreas.add(item.area);
		selectedItems.push({ id: item.id, version: item.version, area: item.area });

		if (item.area === 'writing') {
			const answer = stringField(formData, `answer:${item.id}`);
			if (!answer) throw new AssessmentAttemptInputError('Writing response is required.');
			responses.push({
				area: item.area,
				itemId: item.id,
				itemVersion: item.version,
				kind: 'writing_text',
				answer
			});
			continue;
		}

		if (item.area === 'speaking') {
			const responseSeconds = Number(stringField(formData, `speakingSeconds:${item.id}`));
			if (!Number.isInteger(responseSeconds) || responseSeconds < 1) {
				throw new AssessmentAttemptInputError('Speaking response metadata is required.');
			}
			responses.push({
				area: item.area,
				itemId: item.id,
				itemVersion: item.version,
				kind: 'speaking_metadata',
				metadata: { representedBy: 'temporary_metadata', responseSeconds }
			});
			continue;
		}

		const answer = stringField(formData, `answer:${item.id}`);
		if (!item.learnerTask.choices?.some((choice) => choice.id === answer)) {
			throw new AssessmentAttemptInputError(`Answer is required for ${item.area}.`);
		}
		responses.push({
			area: item.area,
			itemId: item.id,
			itemVersion: item.version,
			kind: 'objective',
			answer
		});
	}

	for (const area of requiredAreas) {
		if (!seenAreas.has(area)) throw new Error(`Assessment Item bank missing ${area}.`);
	}

	return { selectedItems, responses };
}

export async function saveAssessmentAttempt(
	db: Pick<Db, 'insert'>,
	learnerUserId: string,
	formData: FormData
) {
	const id = crypto.randomUUID();
	const payload = buildAssessmentAttemptPayload(formData);

	await db.insert(assessmentAttempt).values({
		id,
		learnerUserId,
		status: 'pending_skill_diagnosis',
		selectedItemsJson: payload.selectedItems,
		responsesJson: payload.responses
	});

	return { id, status: 'pending_skill_diagnosis' as const, ...payload };
}
