import { getRequestEvent } from '$app/server';
import { error, type RequestEvent } from '@sveltejs/kit';
// @ts-expect-error SvelteKit next exports this runtime class without module types.
import { Redirect } from '@sveltejs/kit/internal';

export const accountRoles = ['learner', 'admin'] as const;
export type AccountRole = (typeof accountRoles)[number];
export type FixedAccounts = { adminUsername: string; learnerUsername: string };

export const normalizeUsername = (username: string) => username.trim().toLowerCase();

export const roleForUsername = (
	username: string,
	accounts: FixedAccounts
): AccountRole | undefined => {
	const normalized = normalizeUsername(username);
	if (normalized === normalizeUsername(accounts.adminUsername)) return 'admin';
	if (normalized === normalizeUsername(accounts.learnerUsername)) return 'learner';
};

export const isAllowedAccountUsername = (username: string, accounts: FixedAccounts) =>
	roleForUsername(username, accounts) !== undefined;

export const getAccountRole = (user: { role?: string | null }): AccountRole | undefined => {
	if (user.role === 'admin' || user.role === 'learner') return user.role;
};

export const hasRole = (user: { role?: string | null }, role: AccountRole) =>
	getAccountRole(user) === role;

export const redirectForRole = (role: AccountRole) => (role === 'admin' ? '/admin' : '/study');

const allowedRedirectPaths: Record<AccountRole, readonly string[]> = {
	admin: ['/admin'],
	learner: ['/study', '/assessment', '/practice', '/progress', '/guide']
};

export const redirectForRoleRequest = (role: AccountRole, requested?: string | null) => {
	const fallback = redirectForRole(role);
	const candidate = requested?.trim();
	if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) return fallback;

	try {
		const base = new URL('https://study-guide.invalid');
		const destination = new URL(candidate, base);
		if (destination.origin !== base.origin) return fallback;
		const allowed = allowedRedirectPaths[role].some(
			(path) => destination.pathname === path || destination.pathname.startsWith(`${path}/`)
		);
		return allowed ? `${destination.pathname}${destination.search}${destination.hash}` : fallback;
	} catch {
		return fallback;
	}
};

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
		throw new Redirect(
			302,
			event.url.pathname === '/login'
				? '/login'
				: `/login?redirectTo=${encodeURIComponent(redirectTo)}`
		);
	}

	if (!hasRole(user, role)) {
		return error(403, 'This account cannot access that area.');
	}

	return user;
}
