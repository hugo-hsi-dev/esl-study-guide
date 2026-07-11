import { describe, expect, it } from 'vitest';
import {
	getAccountRole,
	hasRole,
	isAllowedAccountUsername,
	redirectForRole,
	roleForUsername
} from './roles';

const accounts = { adminUsername: 'admin', learnerUsername: 'learner' };

describe('account roles', () => {
	it('assigns only configured fixed account usernames', () => {
		expect(roleForUsername('ADMIN', accounts)).toBe('admin');
		expect(roleForUsername('learner', accounts)).toBe('learner');
		expect(roleForUsername('old', accounts)).toBeUndefined();
	});

	it('allows sign-in only for configured fixed account usernames', () => {
		expect(isAllowedAccountUsername('admin', accounts)).toBe(true);
		expect(isAllowedAccountUsername('learner', accounts)).toBe(true);
		expect(isAllowedAccountUsername('old', accounts)).toBe(false);
	});

	it('accepts only shell roles', () => {
		expect(getAccountRole({ role: 'admin' })).toBe('admin');
		expect(getAccountRole({ role: 'learner' })).toBe('learner');
		expect(getAccountRole({ role: 'teacher' })).toBeUndefined();
	});

	it('rejects the wrong shell role', () => {
		expect(hasRole({ role: 'learner' }, 'admin')).toBe(false);
		expect(hasRole({ role: 'admin' }, 'admin')).toBe(true);
	});

	it('routes each role to its shell', () => {
		expect(redirectForRole('admin')).toBe('/admin');
		expect(redirectForRole('learner')).toBe('/study');
	});
});
