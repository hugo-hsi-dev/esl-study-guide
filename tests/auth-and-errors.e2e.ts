import { expect, test, type Page } from '@playwright/test';

const learnerUsername = process.env.LEARNER_USERNAME ?? 'learner';
const learnerPassword = process.env.LEARNER_PASSWORD ?? 'learner-password';

async function signIn(page: Page, username = learnerUsername, password = learnerPassword) {
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
}

test('preserves a safe protected learner destination through sign-in', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 720 });
	await page.goto('/practice?from=deep-link');
	await expect(page).toHaveURL(/\/login\?redirectTo=/);

	await signIn(page);
	await expect(page).toHaveURL(/\/practice\?from=deep-link$/);
	await expect(page.getByRole('link', { name: 'Practice', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
		)
	).toBe(true);
});

test('rejects external and cross-role post-login redirects', async ({ page }) => {
	await page.goto('/login?redirectTo=https%3A%2F%2Fexample.com%2Fpractice');
	await signIn(page);
	await expect(page).toHaveURL(/\/study$/);
});

test('announces sign-in errors and associates them with the fields', async ({ page }) => {
	await page.goto('/login');
	await signIn(page, learnerUsername, 'incorrect-password');

	const alert = page.getByRole('alert');
	await expect(alert).toBeVisible();
	await expect(alert).not.toBeEmpty();
	await expect(page.getByLabel('Username')).toHaveAttribute('aria-describedby', 'sign-in-errors');
	await expect(page.getByLabel('Password')).toHaveAttribute('aria-invalid', 'true');
});

test('shows a friendly recovery page for unknown routes', async ({ page }) => {
	const response = await page.goto('/this-route-does-not-exist');

	expect(response?.status()).toBe(404);
	await expect(page.getByRole('heading', { name: 'We couldn’t find that page' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Return home' })).toHaveAttribute('href', '/');
});
