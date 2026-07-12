import { describe, expect, it } from 'vitest';
import {
	getAccountRole,
	hasRole,
	isAllowedAccountUsername,
	redirectForRole,
	redirectForRoleRequest,
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

	it('preserves safe role-appropriate deep links', () => {
		expect(redirectForRoleRequest('learner', '/practice?from=today')).toBe('/practice?from=today');
		expect(redirectForRoleRequest('learner', '/guide#before-test-day')).toBe(
			'/guide#before-test-day'
		);
		expect(redirectForRoleRequest('learner', '/assessment/review#writing')).toBe(
			'/assessment/review#writing'
		);
		expect(redirectForRoleRequest('admin', '/admin?section=activity')).toBe(
			'/admin?section=activity'
		);
	});

	it('rejects external and cross-role redirect destinations', () => {
		expect(redirectForRoleRequest('learner', 'https://example.com/practice')).toBe('/study');
		expect(redirectForRoleRequest('learner', '//example.com/practice')).toBe('/study');
		expect(redirectForRoleRequest('learner', '/admin')).toBe('/study');
		expect(redirectForRoleRequest('admin', '/practice')).toBe('/admin');
		expect(redirectForRoleRequest('learner', '/practice/../admin')).toBe('/study');
	});
});
