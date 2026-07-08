import {
	ORIGIN,
	BETTER_AUTH_SECRET,
	GITHUB_CLIENT_ID,
	GITHUB_CLIENT_SECRET,
	ADMIN_EMAILS
} from '$app/env/private';

import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { getRequestEvent } from '$app/server';
import { getDb, type Db } from '$lib/server/db';
import { roleForEmail } from '$lib/server/roles';

const createAuth = (db: Db) =>
	betterAuth({
		baseURL: ORIGIN,
		secret: BETTER_AUTH_SECRET,
		database: drizzleAdapter(db, { provider: 'sqlite' }),
		emailAndPassword: { enabled: true },
		user: {
			additionalFields: {
				role: { type: 'string', required: false, input: false }
			}
		},
		databaseHooks: {
			user: {
				create: {
					before: async (user) => ({
						data: { ...user, role: roleForEmail(user.email, ADMIN_EMAILS) }
					})
				}
			}
		},
		socialProviders: {
			github: {
				clientId: GITHUB_CLIENT_ID,
				clientSecret: GITHUB_CLIENT_SECRET
			}
		},
		plugins: [sveltekitCookies(getRequestEvent)] // make sure this is the last plugin in the array
	});

export const getAuth = () => createAuth(getDb());
