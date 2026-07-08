import { form, getRequestEvent, query } from '$app/server';
import { ADMIN_EMAILS } from '$app/env/private';
import { invalid, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { getAuth } from '$lib/server/auth';
import { redirectForRole, roleForEmail } from '$lib/server/roles';

type EmailAuthInput = {
	email?: string;
	password?: string;
	name?: string;
};

const stringValue = (value: unknown) => (typeof value === 'string' ? value : '');

const redirectTarget = (url: URL, email: string) =>
	url.searchParams.get('redirectTo') ?? redirectForRole(roleForEmail(email, ADMIN_EMAILS));

export const getLoginPage = query(() => {
	const event = getRequestEvent();

	if (event.locals.user) {
		return redirect(302, redirectForRole(event.locals.user.role === 'admin' ? 'admin' : 'learner'));
	}

	return {};
});

export const signInEmail = form('unchecked', async (data: EmailAuthInput) => {
	const event = getRequestEvent();
	const email = stringValue(data.email);
	const password = stringValue(data.password);

	try {
		await getAuth().api.signInEmail({ body: { email, password } });
	} catch (error) {
		if (error instanceof APIError) invalid(error.message || 'Sign in failed');
		invalid('Unexpected error');
	}

	return redirect(302, redirectTarget(event.url, email));
});

export const signUpEmail = form('unchecked', async (data: EmailAuthInput) => {
	const event = getRequestEvent();
	const email = stringValue(data.email);
	const password = stringValue(data.password);
	const name = stringValue(data.name) || email;

	try {
		await getAuth().api.signUpEmail({ body: { email, password, name } });
	} catch (error) {
		if (error instanceof APIError) invalid(error.message || 'Registration failed');
		invalid('Unexpected error');
	}

	return redirect(302, redirectTarget(event.url, email));
});
