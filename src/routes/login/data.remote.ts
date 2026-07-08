import { form, getRequestEvent, query } from '$app/server';
import { invalid, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { z } from 'zod';
import { getAuth } from '$lib/server/auth';
import { fixedAccountRoleForUsername } from '$lib/server/fixed-accounts';
import { redirectForRole } from '$lib/server/roles';

const usernameAuthSchema = z.object({
	username: z.string().min(1),
	password: z.string().min(1)
});

export const getLoginPage = query(() => {
	const event = getRequestEvent();

	if (event.locals.user) {
		return redirect(
			302,
			redirectForRole(fixedAccountRoleForUsername(event.locals.user.username ?? '') ?? 'learner')
		);
	}

	return {};
});

export const signInUsername = form(usernameAuthSchema, async (data) => {
	const role = fixedAccountRoleForUsername(data.username);

	if (!role) invalid('Use one of the configured test accounts.');

	try {
		await getAuth().api.signInUsername({
			body: { username: data.username, password: data.password }
		});
	} catch (error) {
		if (error instanceof APIError) invalid(error.message || 'Sign in failed');
		invalid('Unexpected error');
	}

	return redirect(302, redirectForRole(role));
});
