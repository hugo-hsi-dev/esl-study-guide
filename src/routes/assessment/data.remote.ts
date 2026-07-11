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
	saveAssessmentResponse as persistAssessmentResponse,
	startAssessment as createAssessment
} from '$lib/server/assessment-attempts';
import { getDb } from '$lib/server/db';
import { requireRole } from '$lib/server/roles';
import { AiOutputValidationError } from '$lib/server/workers-ai';

const startSchema = z.object({
	goal: z.string().trim().min(1, 'Tell us what you want to do in English.').max(500),
	speakingRating: z.enum(['1', '2', '3', '4', '5']),
	readingRating: z.enum(['1', '2', '3', '4', '5']),
	writingRating: z.enum(['1', '2', '3', '4', '5']),
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
	speakingAudio: z.file().optional()
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

export const getAssessmentState = query(async () => {
	const user = requireRole('learner');
	return {
		learnerName: user.name,
		state: await readAssessmentState(getDb(), user.id)
	};
});

export const startAssessment = form(startSchema, async (data) => {
	const user = requireRole('learner');
	try {
		const intake = assessmentIntakeSchema.parse({
			goal: data.goal,
			selfRatings: {
				speaking: Number(data.speakingRating),
				reading: Number(data.readingRating),
				writing: Number(data.writingRating)
			},
			timeZone: data.timeZone
		});
		return { state: await createAssessment(getDb(), user.id, intake) };
	} catch (error) {
		return handleInputError(error);
	}
});

export const saveAssessmentResponse = form(responseSchema, async (data) => {
	const user = requireRole('learner');
	try {
		const authorization = await authorizeAssessmentResponse(getDb(), user.id, {
			attemptId: data.attemptId,
			itemId: data.itemId
		});
		if (authorization.completedState) return { state: authorization.completedState };

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
		return {
			state: await persistAssessmentResponse(getDb(), user.id, {
				attemptId: data.attemptId,
				itemId: data.itemId,
				response
			})
		};
	} catch (error) {
		return handleInputError(error);
	}
});

export const completeAssessment = form(completionSchema, async (data) => {
	const user = requireRole('learner');
	try {
		return {
			state: await completeAssessmentAttempt(getDb(), user.id, {
				attemptId: data.attemptId
			})
		};
	} catch (error) {
		return handleInputError(error);
	}
});
