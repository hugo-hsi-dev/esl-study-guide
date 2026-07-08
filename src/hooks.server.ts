import type { Handle } from '@sveltejs/kit';
import { building } from '$app/env';
import { getAuth } from '$lib/server/auth';
import { isConfiguredAccountUsername } from '$lib/server/fixed-accounts';
import { svelteKitHandler } from 'better-auth/svelte-kit';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	const auth = getAuth();
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session && session.user.username && isConfiguredAccountUsername(session.user.username)) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

export const handle: Handle = handleBetterAuth;
