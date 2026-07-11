import { expect, test } from '@playwright/test';

test('sets an honest first-check expectation before the learner signs in', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { name: 'Know what to practice next' })).toBeVisible();
	await expect(page.getByText('not a grade or a full language-level result')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});
