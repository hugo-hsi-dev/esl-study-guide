import { getRequestEvent } from '$app/server';
import { error, redirect, type RequestEvent } from '@sveltejs/kit';

export const accountRoles = ['learner', 'admin'] as const;
export type AccountRole = (typeof accountRoles)[number];

export const roleForEmail = (email: string, adminEmails: string): AccountRole => {
	const normalized = email.trim().toLowerCase();
	const admins = adminEmails
		.split(',')
		.map((value) => value.trim().toLowerCase())
		.filter(Boolean);

	return admins.includes(normalized) ? 'admin' : 'learner';
};

export const getAccountRole = (user: { role?: string | null }): AccountRole | undefined => {
	if (user.role === 'admin' || user.role === 'learner') return user.role;
};

export const hasRole = (user: { role?: string | null }, role: AccountRole) =>
	getAccountRole(user) === role;

export const redirectForRole = (role: AccountRole) => (role === 'admin' ? '/admin' : '/assessment');

export function requireRole(
	event: RequestEvent,
	role: AccountRole
): NonNullable<App.Locals['user']>;
export function requireRole(role: AccountRole): NonNullable<App.Locals['user']>;
export function requireRole(
	eventOrRole: RequestEvent | AccountRole,
	maybeRole?: AccountRole
): NonNullable<App.Locals['user']> {
	const event = typeof eventOrRole === 'string' ? getRequestEvent() : eventOrRole;
	const role = typeof eventOrRole === 'string' ? eventOrRole : maybeRole;

	if (!role) {
		throw new Error('Role is required.');
	}

	const { user } = event.locals;

	if (!user) {
		const redirectTo = `${event.url.pathname}${event.url.search}`;
		return redirect(302, `/login?redirectTo=${encodeURIComponent(redirectTo)}`);
	}

	if (!hasRole(user, role)) {
		return error(403, 'This account cannot access that area.');
	}

	return user;
}
