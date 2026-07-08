import { describe, expect, it } from 'vitest';
import { getAccountRole, hasRole, redirectForRole, roleForEmail } from './roles';

describe('account roles', () => {
	it('assigns admin only for configured emails', () => {
		expect(roleForEmail('ADMIN@example.com', 'admin@example.com, owner@example.com')).toBe('admin');
		expect(roleForEmail('learner@example.com', 'admin@example.com')).toBe('learner');
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
		expect(redirectForRole('learner')).toBe('/assessment');
	});
});
