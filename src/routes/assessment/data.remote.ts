import { BETTER_AUTH_SECRET } from '$app/env/private';
import { form, query } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { z } from 'zod';
import {
	AssessmentAttemptInputError,
	assessmentIntakeSchema,
	authorizeAssessmentResponse,
	buildAssessmentResponseDraft,
	completeAssessment as completeAssessmentAttempt,
	getAssessmentState as readAssessmentState,
	placementTestDateSchema,
	placementTestKindSchema,
	saveAssessmentResponse as persistAssessmentResponse,
	startAssessment as createAssessment
} from '$lib/server/assessment-attempts';
import { getPracticeProgress } from '$lib/server/adaptive-practice';
import { getDb } from '$lib/server/db';
import { verifyAssessmentListeningAcknowledgement } from '$lib/server/listening-evidence';
import { requireRole } from '$lib/server/roles';
import { AiOutputValidationError } from '$lib/server/workers-ai';

const startSchema = z.object({
	goal: z.string().trim().min(1, 'Tell us what you want to do in English.').max(500),
	speakingRating: z.enum(['1', '2', '3', '4', '5']),
	readingRating: z.enum(['1', '2', '3', '4', '5']),
	writingRating: z.enum(['1', '2', '3', '4', '5']),
	placementTestKind: placementTestKindSchema.default('not_sure'),
	institution: z.string().trim().max(200).default(''),
	targetOutcome: z.string().trim().max(300).default(''),
	knownSections: z.string().trim().max(500).default(''),
	testDate: placementTestDateSchema.default(''),
	timeZone: z.string().trim().min(1).max(100)
});

const responseSchema = z.object({
	attemptId: z.string().uuid(),
	itemId: z.string().trim().min(1).max(100),
	answer: z.string().max(5000).optional(),
	speakingSeconds: z
		.string()
		.regex(/^\d{1,3}$/)
		.optional(),
	speakingTranscript: z.string().trim().max(5000).optional(),
	speakingAudio: z.file().optional(),
	listeningAcknowledgement: z.string().trim().max(2000).optional()
});

const completionSchema = z.object({ attemptId: z.string().uuid() });

const handleInputError = (error: unknown): never => {
	if (error instanceof z.ZodError) {
		invalid(error.issues[0]?.message ?? 'Check this response and try again.');
	}
	if (error instanceof AssessmentAttemptInputError) invalid(error.message);
	if (error instanceof AiOutputValidationError) invalid(error.message);
	throw error;
};

const readPublicAssessmentState = async (db: ReturnType<typeof getDb>, learnerUserId: string) => {
	const practiceProgress = await getPracticeProgress(db, learnerUserId);
	return await readAssessmentState(db, learnerUserId, {
		reassessmentContext: practiceProgress?.reassessmentContext
	});
};

export const getAssessmentState = query(async () => {
	const user = requireRole('learner');
	const db = getDb();
	return {
		learnerName: user.name,
		state: await readPublicAssessmentState(db, user.id)
	};
});

export const startAssessment = form(startSchema, async (data) => {
	const user = requireRole('learner');
	try {
		const db = getDb();
		const intake = assessmentIntakeSchema.parse({
			goal: data.goal,
			selfRatings: {
				speaking: Number(data.speakingRating),
				reading: Number(data.readingRating),
				writing: Number(data.writingRating)
			},
			placementTest: {
				kind: data.placementTestKind,
				institution: data.institution,
				targetOutcome: data.targetOutcome,
				knownSections: data.knownSections,
				...(data.testDate ? { testDate: data.testDate } : {})
			},
			timeZone: data.timeZone
		});
		const practiceProgress = await getPracticeProgress(db, user.id);
		return {
			state: await createAssessment(db, user.id, intake, {
				reassessmentContext: practiceProgress?.reassessmentContext
			})
		};
	} catch (error) {
		return handleInputError(error);
	}
});

export const saveAssessmentResponse = form(responseSchema, async (data) => {
	const user = requireRole('learner');
	const db = getDb();
	try {
		const authorization = await authorizeAssessmentResponse(db, user.id, {
			attemptId: data.attemptId,
			itemId: data.itemId
		});
		if (authorization.completedState) {
			return { state: await readPublicAssessmentState(db, user.id) };
		}
		if (authorization.item.area === 'listening') {
			const secret = BETTER_AUTH_SECRET;
			if (!secret) invalid('Listening playback confirmation is temporarily unavailable.');
			if (
				!(await verifyAssessmentListeningAcknowledgement(
					data.listeningAcknowledgement ?? '',
					{
						learnerUserId: user.id,
						attemptId: data.attemptId,
						itemId: data.itemId,
						itemVersion: authorization.item.version
					},
					secret
				))
			) {
				invalid('Play the listening audio before saving this response.');
			}
		}

		const formData = new FormData();
		if (data.answer !== undefined) formData.set(`answer:${data.itemId}`, data.answer);
		if (data.speakingSeconds !== undefined) {
			formData.set(`speakingSeconds:${data.itemId}`, data.speakingSeconds);
		}
		if (data.speakingTranscript) {
			formData.set(`speakingTranscript:${data.itemId}`, data.speakingTranscript);
		}
		if (data.speakingAudio) {
			formData.set(`speakingAudio:${data.itemId}`, data.speakingAudio);
		}
		const response = await buildAssessmentResponseDraft(data.itemId, formData);
		const state = await persistAssessmentResponse(db, user.id, {
			attemptId: data.attemptId,
			itemId: data.itemId,
			response
		});
		return {
			state: state.status === 'completed' ? await readPublicAssessmentState(db, user.id) : state
		};
	} catch (error) {
		return handleInputError(error);
	}
});

export const completeAssessment = form(completionSchema, async (data) => {
	const user = requireRole('learner');
	const db = getDb();
	try {
		await completeAssessmentAttempt(db, user.id, {
			attemptId: data.attemptId
		});
		return {
			state: await readPublicAssessmentState(db, user.id)
		};
	} catch (error) {
		return handleInputError(error);
	}
});
