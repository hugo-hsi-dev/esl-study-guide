import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page) {
	await page.getByLabel('Username').fill(process.env.LEARNER_USERNAME ?? 'learner');
	await page.getByLabel('Password').fill(process.env.LEARNER_PASSWORD ?? 'learner-password');
	await page.getByRole('button', { name: 'Sign in' }).click();
}

test('learner can use the placement test guide on a mobile viewport', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 720 });
	await page.goto('/guide');
	await expect(page).toHaveURL(/\/login\?redirectTo=/);
	await signIn(page);

	await expect(page).toHaveURL(/\/guide$/);
	await expect(
		page.getByRole('heading', { name: 'Know what your placement test expects' })
	).toBeVisible();
	for (const profile of ['ACCUPLACER ESL', 'Cambridge CEPT', 'School-specific or unknown']) {
		await expect(page.getByRole('heading', { name: profile })).toBeVisible();
	}
	const accuplacerCard = page
		.getByRole('article')
		.filter({ has: page.getByRole('heading', { name: 'ACCUPLACER ESL' }) });
	const ceptCard = page
		.getByRole('article')
		.filter({ has: page.getByRole('heading', { name: 'Cambridge CEPT' }) });
	await expect(page.getByText('Two official components: Reading and Listening.')).toBeVisible();
	await expect(
		page.getByText(/Language knowledge is tested through\s+question types within Reading/)
	).toBeVisible();
	await expect(
		page.getByText(/Extended reading and listening tasks use\s+linked question series/)
	).toBeVisible();
	await expect(
		ceptCard.getByText(/Daily practice names a single-question CEPT format only when/)
	).toBeVisible();
	await expect(
		accuplacerCard.getByText(/Daily practice names a single-question CEPT format only when/)
	).toHaveCount(0);
	await expect(
		page.getByText('This app gives study guidance and shows practice evidence.')
	).toBeVisible();
	await expect(page.getByText(/does not issue an official\s+ACCUPLACER/)).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Practical pre-test checklist' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Test guide' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(page.getByRole('link', { name: 'Cambridge CEPT question types' })).toHaveAttribute(
		'href',
		'https://support.cambridgeenglish.org/hc/en-gb/articles/360000241043-Cambridge-English-Placement-Test-CEPT-Types-of-CEPT-Questions'
	);
	expect(
		await page
			.locator('main a[href^="https://"]')
			.evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href))
	).toEqual([
		'https://accuplacer.collegeboard.org/accuplacer/pdf/accuplacer-esl-tests-sample-questions.pdf',
		'https://accuplacer.collegeboard.org/accuplacer/pdf/guide-to-next-generation-standard-setting.pdf',
		'https://accuplacer.collegeboard.org/accuplacer/pdf/accuplacer-writeplacer-esl-sample-essays.pdf',
		'https://support.cambridgeenglish.org/hc/en-gb/articles/360000241043-Cambridge-English-Placement-Test-CEPT-Types-of-CEPT-Questions',
		'https://support.cambridgeenglish.org/hc/en-gb/articles/210044206-Cambridge-English-Placement-Test-CEPT-FAQs'
	]);
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= document.documentElement.clientWidth
		)
	).toBe(true);
});
