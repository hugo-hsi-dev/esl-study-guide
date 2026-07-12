import { form, query } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { z } from 'zod';
import {
	PracticeConflictError,
	PracticeDataError,
	PracticeInputError,
	PracticeNotFoundError,
	getPracticeSession as readPracticeSession,
	startPracticeSession as createPracticeSession,
	submitPracticeResponse,
	validatePracticeResponse
} from '$lib/server/adaptive-practice';
import { getDb } from '$lib/server/db';
import { requireRole } from '$lib/server/roles';
import {
	AiOutputValidationError,
	transcribeSpeakingAudio,
	validateSpeakingAudio
} from '$lib/server/workers-ai';

const startSchema = z.object({ intent: z.string().optional() });
const submitSchema = z.object({
	practiceId: z.string().uuid(),
	kind: z.enum(['choice', 'listening_choice', 'fill', 'short_text', 'speaking']),
	answer: z.string().max(160).optional(),
	text: z.string().max(2000).optional(),
	transcript: z.string().max(2400).optional(),
	responseSeconds: z
		.string()
		.regex(/^\d{1,3}$/)
		.optional(),
	audio: z.file().optional()
});

const handlePracticeError = (error: unknown): never => {
	if (
		error instanceof PracticeInputError ||
		error instanceof PracticeNotFoundError ||
		error instanceof PracticeConflictError ||
		error instanceof PracticeDataError ||
		error instanceof AiOutputValidationError
	) {
		invalid(error.message);
	}
	if (error instanceof z.ZodError) {
		invalid(error.issues[0]?.message ?? 'Check your response and try again.');
	}
	throw error;
};

export const getPracticeSession = query(async () => {
	const user = requireRole('learner');
	return {
		learnerName: user.name,
		state: await readPracticeSession(getDb(), user.id)
	};
});

export const startPracticeSession = form(startSchema, async () => {
	const user = requireRole('learner');
	try {
		return { state: await createPracticeSession(getDb(), user.id) };
	} catch (error) {
		return handlePracticeError(error);
	}
});

export const submitPractice = form(submitSchema, async (data) => {
	const user = requireRole('learner');
	try {
		const transcript = data.transcript?.trim() || undefined;
		const audio = data.kind === 'speaking' && data.audio?.size ? data.audio : undefined;
		if (audio) validateSpeakingAudio(audio);
		const response = validatePracticeResponse(
			data.kind === 'choice' || data.kind === 'listening_choice' || data.kind === 'fill'
				? { kind: data.kind, answer: data.answer }
				: data.kind === 'short_text'
					? { kind: data.kind, text: data.text }
					: {
							kind: data.kind,
							responseSeconds: Number(data.responseSeconds),
							...(transcript ? { transcript, transcriptSource: 'submitted' as const } : {})
						}
		);
		const result = await submitPracticeResponse(
			getDb(),
			user.id,
			{
				practiceId: data.practiceId,
				response
			},
			{
				resolveSpeakingResponse: audio
					? async (authorizedResponse) => {
							let transcribed: Awaited<ReturnType<typeof transcribeSpeakingAudio>>;
							try {
								transcribed = await transcribeSpeakingAudio(audio);
							} catch (error) {
								if (!authorizedResponse.transcript) throw error;
								transcribed = null;
							}
							const authorizedTranscript = transcribed?.text ?? authorizedResponse.transcript;
							return {
								...authorizedResponse,
								...(authorizedTranscript
									? {
											transcript: authorizedTranscript,
											transcriptSource: transcribed
												? ('workers_ai_asr' as const)
												: ('submitted' as const)
										}
									: {})
							};
						}
					: undefined
			}
		);
		const state = result.completed
			? await readPracticeSession(getDb(), user.id)
			: await createPracticeSession(getDb(), user.id);
		return { result, state };
	} catch (error) {
		return handlePracticeError(error);
	}
});
