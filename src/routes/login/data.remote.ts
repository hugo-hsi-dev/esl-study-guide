import { form, getRequestEvent, query } from '$app/server';
import { ADMIN_EMAILS } from '$app/env/private';
import { invalid, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { z } from 'zod';
import { getAuth } from '$lib/server/auth';
import { redirectForRole, roleForEmail } from '$lib/server/roles';

const emailAuthSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
	name: z.string().optional()
});

const redirectTarget = (url: URL, email: string) =>
	url.searchParams.get('redirectTo') ?? redirectForRole(roleForEmail(email, ADMIN_EMAILS ?? ''));

export const getLoginPage = query(() => {
	const event = getRequestEvent();

	if (event.locals.user) {
		return redirect(302, redirectForRole(event.locals.user.role === 'admin' ? 'admin' : 'learner'));
	}

	return {};
});

export const signInEmail = form(emailAuthSchema, async (data) => {
	const event = getRequestEvent();

	try {
		await getAuth().api.signInEmail({ body: { email: data.email, password: data.password } });
	} catch (error) {
		if (error instanceof APIError) invalid(error.message || 'Sign in failed');
		invalid('Unexpected error');
	}

	return redirect(302, redirectTarget(event.url, data.email));
});

export const signUpEmail = form(emailAuthSchema, async (data) => {
	const event = getRequestEvent();
	const name = data.name || data.email;

	try {
		await getAuth().api.signUpEmail({ body: { email: data.email, password: data.password, name } });
	} catch (error) {
		if (error instanceof APIError) invalid(error.message || 'Registration failed');
		invalid('Unexpected error');
	}

	return redirect(302, redirectTarget(event.url, data.email));
});
