import { form, getRequestEvent, query } from '$app/server';
import { invalid } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getAuth } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { getAccountRole, redirectForRole } from '$lib/server/roles';

const usernameAuthSchema = z.object({
	username: z.string().min(1),
	password: z.string().min(1)
});

export const getLoginPage = query(() => {
	const event = getRequestEvent();

	if (event.locals.user) {
		return {
			redirectTo: redirectForRole(getAccountRole(event.locals.user) ?? 'learner')
		};
	}

	return { redirectTo: undefined };
});

export const signInUsername = form(usernameAuthSchema, async (data) => {
	let signedIn;
	try {
		signedIn = await getAuth().api.signInUsername({
			body: { username: data.username, password: data.password }
		});
	} catch (error) {
		if (error instanceof APIError) invalid(error.message || 'Sign in failed');
		invalid('Unexpected error');
	}
	if (!signedIn) invalid('Sign in failed');

	const [account] = await getDb()
		.select({ role: user.role })
		.from(user)
		.where(eq(user.id, signedIn.user.id))
		.limit(1);
	const role = getAccountRole(account ?? {});
	if (!role) invalid('This account is not allowed to use the study tool.');
	return { redirectTo: redirectForRole(role) };
});
