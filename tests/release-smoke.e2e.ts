import { expect, test, type Page } from '@playwright/test';

test.skip(!process.env.RELEASE_SMOKE, 'Run explicitly against staging or production.');

async function signIn(page: Page, username: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
}

test('Release smoke: health, Learner, Admin, and sign-out are available', async ({ page }) => {
	const required = (name: string) => {
		const value = process.env[name];
		if (!value) throw new Error(`${name} is required for release smoke testing.`);
		return value;
	};

	const health = await page.request.get('/health');
	expect(health.status()).toBe(200);
	expect(await health.json()).toMatchObject({
		status: 'ok',
		checks: { d1: 'ok', workersAi: 'configured' }
	});

	await signIn(page, required('LEARNER_USERNAME'), required('LEARNER_PASSWORD'));
	await expect(page).toHaveURL(/\/study$/);
	await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();
	for (const path of ['/assessment', '/practice', '/progress']) {
		const response = await page.goto(path);
		expect(response?.status()).toBe(200);
		await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
	}
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/login(?:\?|$)/);

	await signIn(page, required('ADMIN_USERNAME'), required('ADMIN_PASSWORD'));
	await expect(page).toHaveURL(/\/admin$/);
	await expect(page.getByRole('heading', { name: 'Learner study overview' })).toBeVisible();
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/login(?:\?|$)/);
});
