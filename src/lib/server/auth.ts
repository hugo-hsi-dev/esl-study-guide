import { ORIGIN, BETTER_AUTH_SECRET } from '$app/env/private';

import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { username } from 'better-auth/plugins';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { getDb, type Db } from '$lib/server/db';

const createAuth = (db: Db) =>
	betterAuth({
		baseURL: ORIGIN,
		secret: BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, { provider: 'sqlite' }),
		disabledPaths: ['/sign-in/email', '/sign-up/email', '/is-username-available'],
		emailAndPassword: { enabled: true, disableSignUp: true },
		user: {
			additionalFields: {
				role: { type: 'string', required: false, input: false }
			}
		},
		plugins: [username(), sveltekitCookies(getRequestEvent)] // make sure cookies is the last plugin in the array
	});

export const getAuth = () => createAuth(getDb());
