import { error, type RequestHandler } from '@sveltejs/kit';
import {
	assessmentAudioCacheKey,
	assessmentAudioResponse,
	generateAssessmentAudio,
	getWorkersAiTtsModelId
} from '$lib/server/assessment-audio';
import { getAssessmentItemAudioSource } from '$lib/server/assessment-items';
import { requireRole } from '$lib/server/roles';

type WebCache = {
	match(request: RequestInfo | URL): Promise<Response | undefined>;
	put(request: RequestInfo | URL, response: Response): Promise<void>;
};

export const GET: RequestHandler = async (event) => {
	requireRole(event, 'learner');

	if (!event.params.itemId) error(404, 'Listening audio was not found.');

	const requestedVersion = Number(event.url.searchParams.get('version')) || undefined;
	const source = getAssessmentItemAudioSource(event.params.itemId, requestedVersion);
	if (!source) error(404, 'Listening audio was not found.');

	const cache = event.platform?.caches?.default as WebCache | undefined;
	const model = getWorkersAiTtsModelId(event.platform?.env);
	const cacheKey = assessmentAudioCacheKey(event.request.url, source, model);
	const cached = await cache?.match(cacheKey);
	if (cached) return cached;

	const response = assessmentAudioResponse(
		await generateAssessmentAudio(source, event.platform?.env)
	);
	if (cache) event.platform?.ctx.waitUntil(cache.put(cacheKey, response.clone()));

	return response;
};
