import type { Handle } from '@sveltejs/kit';
import { building } from '$app/env';
import { getAuth } from '$lib/server/auth';
import { getAccountRole } from '$lib/server/roles';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const secureResponse = (response: Response, requestId: string) => {
	const headers = new Headers(response.headers);
	headers.set('x-content-type-options', 'nosniff');
	headers.set('x-frame-options', 'DENY');
	headers.set('referrer-policy', 'same-origin');
	headers.set('permissions-policy', 'microphone=(self)');
	headers.set(
		'content-security-policy',
		"base-uri 'self'; object-src 'none'; frame-ancestors 'none'"
	);
	headers.set('cross-origin-opener-policy', 'same-origin');
	headers.set('x-robots-tag', 'noindex, nofollow');
	headers.set('x-request-id', requestId);
	headers.set('cache-control', 'private, no-store');
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers
	});
};

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const requestId = event.request.headers.get('cf-ray') ?? crypto.randomUUID();
	const startedAt = Date.now();

	try {
		if (event.url.pathname === '/health') {
			const response = secureResponse(await resolve(event), requestId);
			console.log({
				event: 'request_complete',
				requestId,
				method: event.request.method,
				path: '/health',
				status: response.status,
				durationMs: Date.now() - startedAt,
				role: 'public'
			});
			return response;
		}

		const auth = getAuth();
		const session = await auth.api.getSession({ headers: event.request.headers });

		if (session && getAccountRole(session.user)) {
			event.locals.session = session.session;
			event.locals.user = session.user;
		}

		const response = secureResponse(
			await svelteKitHandler({ event, resolve, auth, building }),
			requestId
		);
		console.log({
			event: 'request_complete',
			requestId,
			method: event.request.method,
			path: event.url.pathname,
			status: response.status,
			durationMs: Date.now() - startedAt,
			role: getAccountRole(event.locals.user ?? {}) ?? 'public'
		});
		return response;
	} catch (error) {
		console.error({
			event: 'request_failed',
			requestId,
			method: event.request.method,
			path: event.url.pathname,
			durationMs: Date.now() - startedAt,
			error: error instanceof Error ? error.name : 'UnknownError'
		});
		throw error;
	}
};

export const handle: Handle = handleBetterAuth;
