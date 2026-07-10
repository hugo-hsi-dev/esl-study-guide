import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
	assessmentAttempt,
	type AssessmentIntake,
	type AttemptResponse,
	type AttemptSelectedItem
} from './db/schema';
import type { Db } from './db';
import {
	diagnoseAssessmentAttempt,
	validateDiagnosisMetadata,
	validateSkillProfile,
	validateStudyPlan
} from './assessment-diagnosis';
import {
	assessmentDefinitionVersion,
	getAssessmentItemVersion,
	getLearnerAssessmentItemVersion,
	getLearnerAssessmentItems
} from './assessment-items';
import { transcribeSpeakingAudio } from './workers-ai';

const objectiveAreas = ['listening', 'reading', 'grammar_usage', 'vocabulary'] as const;
const assessmentAreas = [...objectiveAreas, 'writing', 'speaking'] as const;
const ratingSchema = z.union([
	z.literal(1),
	z.literal(2),
	z.literal(3),
	z.literal(4),
	z.literal(5)
]);
export const assessmentIntakeSchema = z.object({
	goal: z.string().trim().min(1).max(500),
	selfRatings: z.object({
		speaking: ratingSchema,
		reading: ratingSchema,
		writing: ratingSchema
	}),
	timeZone: z.string().trim().min(1).max(100)
});
const selectedItemSchema = z.object({
	id: z.string().trim().min(1).max(100),
	version: z.number().int().min(1),
	area: z.enum(assessmentAreas)
});
const transcriptionMetadataSchema = z.object({
	provider: z.literal('workers-ai'),
	modelId: z.string().trim().min(1),
	promptVersion: z.literal('assessment-asr-v1'),
	schemaVersion: z.literal(1),
	generatedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)))
});
const responseSchema = z.discriminatedUnion('kind', [
	z.object({
		area: z.enum(objectiveAreas),
		itemId: z.string().trim().min(1).max(100),
		itemVersion: z.number().int().min(1),
		kind: z.literal('objective'),
		answer: z.string().trim().min(1).max(80)
	}),
	z.object({
		area: z.literal('writing'),
		itemId: z.string().trim().min(1).max(100),
		itemVersion: z.number().int().min(1),
		kind: z.literal('writing_text'),
		answer: z.string().trim().min(1).max(5000)
	}),
	z.object({
		area: z.literal('speaking'),
		itemId: z.string().trim().min(1).max(100),
		itemVersion: z.number().int().min(1),
		kind: z.literal('speaking_metadata'),
		metadata: z.object({
			representedBy: z.literal('temporary_metadata'),
			responseSeconds: z.number().int().min(1).max(300),
			transcript: z.string().trim().min(1).max(5000).optional(),
			transcriptSource: z.enum(['workers_ai_asr', 'submitted']).optional(),
			transcriptionMetadata: transcriptionMetadataSchema.optional()
		})
	})
]);
const responsesSchema = z
	.array(responseSchema)
	.max(14)
	.superRefine((responses, context) => {
		const keys = new Set<string>();
		for (const response of responses) {
			const key = `${response.itemId}:${response.itemVersion}`;
			if (keys.has(key))
				context.addIssue({ code: 'custom', message: `Duplicate response ${key}.` });
			keys.add(key);
		}
	});
const responseDraftSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('objective'), answer: z.string().trim().min(1).max(80) }),
	z.object({ kind: z.literal('writing_text'), answer: z.string().trim().min(1).max(5000) }),
	z.object({
		kind: z.literal('speaking_metadata'),
		metadata: z.object({
			representedBy: z.literal('temporary_metadata'),
			responseSeconds: z.number().int().min(1).max(300),
			transcript: z.string().trim().min(1).max(5000).optional(),
			transcriptSource: z.enum(['workers_ai_asr', 'submitted']).optional(),
			transcriptionMetadata: transcriptionMetadataSchema.optional()
		})
	})
]);

export type AssessmentResponseDraft = z.infer<typeof responseDraftSchema>;
export type SaveAssessmentResponseInput = {
	attemptId: string;
	itemId: string;
	response: AssessmentResponseDraft;
};

export class AssessmentAttemptInputError extends Error {}

const selectedItems = (): AttemptSelectedItem[] =>
	getLearnerAssessmentItems().map(({ id, version, area }) => ({ id, version, area }));

const stringField = (formData: FormData, name: string) => {
	const value = formData.get(name);
	return typeof value === 'string' ? value.trim() : '';
};

const fileField = (formData: FormData, name: string) => {
	const value = formData.get(name);
	return value instanceof File && value.size > 0 ? value : null;
};

export async function buildAssessmentResponseDraft(itemId: string, formData: FormData) {
	const item = getLearnerAssessmentItems().find((candidate) => candidate.id === itemId);
	if (!item) throw new AssessmentAttemptInputError('Assessment Item is not available.');

	if (item.area === 'writing') {
		return responseDraftSchema.parse({
			kind: 'writing_text',
			answer: stringField(formData, `answer:${item.id}`)
		});
	}
	if (item.area === 'speaking') {
		const submittedTranscript = stringField(formData, `speakingTranscript:${item.id}`);
		const audio = fileField(formData, `speakingAudio:${item.id}`);
		const transcribed = audio ? await transcribeSpeakingAudio(audio) : null;
		const transcript = transcribed?.text ?? (submittedTranscript || undefined);
		return responseDraftSchema.parse({
			kind: 'speaking_metadata',
			metadata: {
				representedBy: 'temporary_metadata',
				responseSeconds: Number(stringField(formData, `speakingSeconds:${item.id}`)),
				...(transcript
					? {
							transcript,
							transcriptSource: transcribed ? 'workers_ai_asr' : 'submitted'
						}
					: {}),
				...(transcribed?.metadata
					? {
							transcriptionMetadata: {
								provider: 'workers-ai',
								modelId: transcribed.metadata.model,
								promptVersion: 'assessment-asr-v1',
								schemaVersion: 1,
								generatedAt: new Date().toISOString()
							}
						}
					: {})
			}
		});
	}

	return responseDraftSchema.parse({
		kind: 'objective',
		answer: stringField(formData, `answer:${item.id}`)
	});
}

const completeResponse = (
	selectedItem: AttemptSelectedItem,
	draft: AssessmentResponseDraft
): AttemptResponse => {
	const item = getAssessmentItemVersion(selectedItem.id, selectedItem.version);
	if (!item || item.area !== selectedItem.area) {
		throw new AssessmentAttemptInputError('Assessment Item version is not available.');
	}

	if (item.area === 'writing' && draft.kind === 'writing_text') {
		return { area: 'writing', itemId: item.id, itemVersion: item.version, ...draft };
	}
	if (item.area === 'speaking' && draft.kind === 'speaking_metadata') {
		return { area: 'speaking', itemId: item.id, itemVersion: item.version, ...draft };
	}
	if (
		objectiveAreas.includes(item.area as (typeof objectiveAreas)[number]) &&
		draft.kind === 'objective' &&
		item.choices?.some((choice) => choice.id === draft.answer)
	) {
		return {
			area: item.area as (typeof objectiveAreas)[number],
			itemId: item.id,
			itemVersion: item.version,
			...draft
		};
	}
	throw new AssessmentAttemptInputError(`Response does not match the ${item.area} task.`);
};

export async function buildAssessmentAttemptPayload(formData: FormData) {
	const selected = selectedItems();
	const responses: AttemptResponse[] = [];
	for (const item of selected) {
		try {
			responses.push(completeResponse(item, await buildAssessmentResponseDraft(item.id, formData)));
		} catch (error) {
			if (error instanceof z.ZodError) {
				throw new AssessmentAttemptInputError(`A valid ${item.area} response is required.`);
			}
			throw error;
		}
	}
	return { selectedItems: selected, responses: responsesSchema.parse(responses) };
}

type AssessmentRow = typeof assessmentAttempt.$inferSelect;

const parseRow = (row: AssessmentRow) => ({
	...row,
	intakeJson: assessmentIntakeSchema.parse(row.intakeJson),
	selectedItemsJson: z.array(selectedItemSchema).parse(row.selectedItemsJson),
	responsesJson: responsesSchema.parse(row.responsesJson),
	skillProfileJson: row.skillProfileJson ? validateSkillProfile(row.skillProfileJson) : null,
	studyPlanJson: row.studyPlanJson ? validateStudyPlan(row.studyPlanJson) : null,
	diagnosisMetadataJson: row.diagnosisMetadataJson
		? validateDiagnosisMetadata(row.diagnosisMetadataJson)
		: null
});

const publicState = (rawRow: AssessmentRow) => {
	const row = parseRow(rawRow);
	const responseKeys = new Set(
		row.responsesJson.map((response) => `${response.itemId}:${response.itemVersion}`)
	);
	return {
		attemptId: row.id,
		status: row.status,
		definitionVersion: row.definitionVersion,
		intake: row.intakeJson,
		items: row.selectedItemsJson
			.map((item) => getLearnerAssessmentItemVersion(item.id, item.version))
			.filter((item) => item !== undefined),
		responses: row.responsesJson,
		nextItemId:
			row.status === 'in_progress'
				? (row.selectedItemsJson.find((item) => !responseKeys.has(`${item.id}:${item.version}`))
						?.id ?? null)
				: null,
		skillProfile: row.skillProfileJson,
		studyPlan: row.studyPlanJson,
		diagnosisMetadata: row.diagnosisMetadataJson,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		completedAt: row.completedAt
	};
};

const getOwnedAttempt = async (db: Db, learnerUserId: string, attemptId: string) => {
	const [attempt] = await db
		.select()
		.from(assessmentAttempt)
		.where(
			and(eq(assessmentAttempt.id, attemptId), eq(assessmentAttempt.learnerUserId, learnerUserId))
		)
		.limit(1);
	return attempt;
};

const getActiveAttempt = async (db: Db, learnerUserId: string) => {
	const [attempt] = await db
		.select()
		.from(assessmentAttempt)
		.where(
			and(
				eq(assessmentAttempt.learnerUserId, learnerUserId),
				eq(assessmentAttempt.status, 'in_progress')
			)
		)
		.orderBy(desc(assessmentAttempt.updatedAt))
		.limit(1);
	return attempt;
};

export async function getAssessmentState(db: Db, learnerUserId: string) {
	const active = await getActiveAttempt(db, learnerUserId);
	if (active) return publicState(active);
	const [latest] = await db
		.select()
		.from(assessmentAttempt)
		.where(eq(assessmentAttempt.learnerUserId, learnerUserId))
		.orderBy(desc(assessmentAttempt.createdAt))
		.limit(1);
	return latest ? publicState(latest) : null;
}

export async function startAssessment(db: Db, learnerUserId: string, intake: AssessmentIntake) {
	const parsedIntake = assessmentIntakeSchema.parse(intake);
	const active = await getActiveAttempt(db, learnerUserId);
	if (active) return publicState(active);

	const id = crypto.randomUUID();
	try {
		await db.insert(assessmentAttempt).values({
			id,
			learnerUserId,
			status: 'in_progress',
			definitionVersion: assessmentDefinitionVersion,
			intakeJson: parsedIntake,
			selectedItemsJson: selectedItems(),
			responsesJson: []
		});
	} catch (error) {
		const concurrent = await getActiveAttempt(db, learnerUserId);
		if (concurrent) return publicState(concurrent);
		throw error;
	}

	const created = await getOwnedAttempt(db, learnerUserId, id);
	if (!created) throw new Error('Assessment attempt was not created.');
	return publicState(created);
}

export async function saveAssessmentResponse(
	db: Db,
	learnerUserId: string,
	input: SaveAssessmentResponseInput
) {
	const parsedInput = z
		.object({
			attemptId: z.string().trim().min(1),
			itemId: z.string().trim().min(1),
			response: responseDraftSchema
		})
		.parse(input);
	const attempt = await getOwnedAttempt(db, learnerUserId, parsedInput.attemptId);
	if (!attempt) throw new AssessmentAttemptInputError('Assessment attempt was not found.');
	if (attempt.status === 'completed') return publicState(attempt);
	if (attempt.status !== 'in_progress') {
		throw new AssessmentAttemptInputError('Assessment attempt cannot be changed.');
	}

	const row = parseRow(attempt);
	const selectedItem = row.selectedItemsJson.find((item) => item.id === parsedInput.itemId);
	if (!selectedItem)
		throw new AssessmentAttemptInputError('Assessment Item is not in this attempt.');
	const response = completeResponse(selectedItem, parsedInput.response);
	const responses = responsesSchema.parse([
		...row.responsesJson.filter((saved) => saved.itemId !== selectedItem.id),
		response
	]);
	await db
		.update(assessmentAttempt)
		.set({ responsesJson: responses, updatedAt: new Date() })
		.where(
			and(
				eq(assessmentAttempt.id, attempt.id),
				eq(assessmentAttempt.learnerUserId, learnerUserId),
				eq(assessmentAttempt.status, 'in_progress')
			)
		);
	const saved = await getOwnedAttempt(db, learnerUserId, attempt.id);
	if (!saved) throw new Error('Assessment response was not saved.');
	return publicState(saved);
}

export async function completeAssessment(
	db: Db,
	learnerUserId: string,
	input: { attemptId: string }
) {
	const { attemptId } = z.object({ attemptId: z.string().trim().min(1) }).parse(input);
	const attempt = await getOwnedAttempt(db, learnerUserId, attemptId);
	if (!attempt) throw new AssessmentAttemptInputError('Assessment attempt was not found.');
	if (attempt.status === 'completed') return publicState(attempt);
	if (attempt.status !== 'in_progress') {
		throw new AssessmentAttemptInputError('Assessment attempt cannot be completed.');
	}

	const row = parseRow(attempt);
	const responseKeys = new Set(
		row.responsesJson.map((response) => `${response.itemId}:${response.itemVersion}`)
	);
	if (
		row.selectedItemsJson.length !== 14 ||
		row.selectedItemsJson.some((item) => !responseKeys.has(`${item.id}:${item.version}`))
	) {
		throw new AssessmentAttemptInputError('Complete every assessment task before finishing.');
	}

	const diagnosis = await diagnoseAssessmentAttempt({
		selectedItems: row.selectedItemsJson,
		responses: row.responsesJson
	});
	const completedAt = new Date();
	await db
		.update(assessmentAttempt)
		.set({
			status: 'completed',
			skillProfileJson: diagnosis.skillProfile,
			studyPlanJson: diagnosis.studyPlan,
			diagnosisMetadataJson: diagnosis.diagnosisMetadata,
			updatedAt: completedAt,
			completedAt
		})
		.where(
			and(
				eq(assessmentAttempt.id, attempt.id),
				eq(assessmentAttempt.learnerUserId, learnerUserId),
				eq(assessmentAttempt.status, 'in_progress')
			)
		);
	const completed = await getOwnedAttempt(db, learnerUserId, attempt.id);
	if (!completed) throw new Error('Assessment attempt was not completed.');
	return publicState(completed);
}

// Compatibility for the original one-shot form while callers migrate to the lifecycle functions.
export async function saveAssessmentAttempt(
	db: Pick<Db, 'insert'>,
	learnerUserId: string,
	formData: FormData
) {
	const id = crypto.randomUUID();
	const payload = await buildAssessmentAttemptPayload(formData);
	const diagnosis = await diagnoseAssessmentAttempt(payload);
	const completedAt = new Date();
	await db.insert(assessmentAttempt).values({
		id,
		learnerUserId,
		status: 'completed',
		definitionVersion: assessmentDefinitionVersion,
		intakeJson: {
			goal: 'Build confidence using English in daily life.',
			selfRatings: { speaking: 3, reading: 3, writing: 3 },
			timeZone: 'UTC'
		},
		selectedItemsJson: payload.selectedItems,
		responsesJson: payload.responses,
		skillProfileJson: diagnosis.skillProfile,
		studyPlanJson: diagnosis.studyPlan,
		diagnosisMetadataJson: diagnosis.diagnosisMetadata,
		updatedAt: completedAt,
		completedAt
	});
	return { id, status: 'completed' as const, ...payload, ...diagnosis };
}
