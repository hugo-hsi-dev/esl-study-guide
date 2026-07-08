import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { ADMIN_EMAILS } from '$app/env/private';
import { getAuth } from '$lib/server/auth';
import { redirectForRole, roleForEmail } from '$lib/server/roles';
import type { Actions, PageServerLoad } from './$types';

const redirectTarget = (url: URL, email: string) =>
	url.searchParams.get('redirectTo') ?? redirectForRole(roleForEmail(email, ADMIN_EMAILS));

export const load: PageServerLoad = (event) => {
	if (event.locals.user) {
		return redirect(302, redirectForRole(event.locals.user.role === 'admin' ? 'admin' : 'learner'));
	}

	return {};
};

export const actions: Actions = {
	signInEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';

		try {
			await getAuth().api.signInEmail({ body: { email, password } });
		} catch (error) {
			if (error instanceof APIError)
				return fail(400, { message: error.message || 'Sign in failed' });
			return fail(500, { message: 'Unexpected error' });
		}

		return redirect(302, redirectTarget(event.url, email));
	},
	signUpEmail: async (event) => {
		const formData = await event.request.formData();
		const email = formData.get('email')?.toString() ?? '';
		const password = formData.get('password')?.toString() ?? '';
		const name = formData.get('name')?.toString() || email;

		try {
			await getAuth().api.signUpEmail({ body: { email, password, name } });
		} catch (error) {
			if (error instanceof APIError)
				return fail(400, { message: error.message || 'Registration failed' });
			return fail(500, { message: 'Unexpected error' });
		}

		return redirect(302, redirectTarget(event.url, email));
	}
};
