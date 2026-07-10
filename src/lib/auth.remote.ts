import { form, getRequestEvent } from '$app/server';
import { z } from 'zod';
import { getAuth } from '$lib/server/auth';
// Remote forms in this prerelease runtime do not provide the request store public redirect() needs.
// @ts-expect-error SvelteKit next exports this runtime class without module types.
import { Redirect } from '@sveltejs/kit/internal';

export const signOut = form(z.object({ intent: z.string().optional() }), async () => {
	const event = getRequestEvent();
	await getAuth().api.signOut({ headers: event.request.headers });
	throw new Redirect(303, '/login');
});
