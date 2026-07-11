import { expect, test, type Page } from '@playwright/test';

async function signIn(page: Page, username: string, password: string) {
	await page.goto('/login');
	await page.getByLabel('Username').fill(username);
	await page.getByLabel('Password').fill(password);
	await page.getByRole('button', { name: 'Sign in' }).click();
}

async function answerAssessmentTask(page: Page) {
	const choices = page.locator('input[type="radio"][name="answer"]');
	if (await choices.count()) {
		await choices.first().check();
	} else if (await page.locator('textarea[name="answer"]').count()) {
		await page
			.locator('textarea[name="answer"]')
			.fill('I use English at work. I ask clear questions, and I write short messages every day.');
	} else {
		await page
			.locator('textarea[name="speakingTranscript"]')
			.fill('I had a problem at work, so I asked a coworker for help. We solved it together.');
		await page.locator('input[name="speakingSeconds"]').fill('28');
	}
	await page.getByRole('button', { name: /Save (and continue|final response)/ }).click();
}

async function answerPracticeProblem(page: Page) {
	const choices = page.locator('input[type="radio"][name="answer"]');
	if (await choices.count()) {
		await choices.first().check();
	} else if (await page.locator('input[name="answer"]').count()) {
		await page.locator('input[name="answer"]').fill('works');
	} else if (await page.locator('textarea[name="text"]').count()) {
		await page
			.locator('textarea[name="text"]')
			.fill('I called the clinic yesterday. I asked a clear question and wrote down the answer.');
	} else {
		await page
			.locator('textarea[name="transcript"]')
			.fill('I called the clinic yesterday and asked a clear question about my appointment.');
		await page.locator('input[name="responseSeconds"]').fill('25');
	}
	await page.getByRole('button', { name: 'Check response' }).click();
}

test('Learner study journey persists and Admin remains read-only', async ({ page }) => {
	test.setTimeout(120_000);
	const learnerUsername = process.env.LEARNER_USERNAME ?? 'learner';
	const learnerPassword = process.env.LEARNER_PASSWORD ?? 'learner-password';
	const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
	const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin-password';
	const learnerName = process.env.LEARNER_NAME ?? 'Test Learner';
	const health = await page.request.get('/health');
	expect(health.status()).toBe(200);
	expect(await health.json()).toMatchObject({
		status: 'ok',
		checks: {
			d1: 'ok',
			workersAi: process.env.PLAYWRIGHT_BASE_URL ? 'configured' : 'unavailable'
		}
	});
	expect(health.headers()['x-robots-tag']).toBe('noindex, nofollow');
	await signIn(page, learnerUsername, learnerPassword);
	await expect(page).toHaveURL(/\/study$/);
	await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible();

	const forbidden = await page.goto('/admin');
	expect(forbidden?.status()).toBe(403);
	await page.goto('/assessment');

	await page
		.getByLabel('What do you most want to do in English?')
		.fill('Speak with customers and write clearer work messages.');
	for (const area of ['speaking', 'reading', 'writing']) {
		await page.locator(`input[name="${area}Rating"][value="3"]`).check({ force: true });
	}
	await page.getByRole('button', { name: 'Start Skill Diagnosis' }).click();
	await expect(page.getByText('Task 1 of 14')).toBeVisible();

	await answerAssessmentTask(page);
	await expect(page.getByText('Task 2 of 14')).toBeVisible();
	await page.reload();
	await expect(page.getByText('Task 2 of 14')).toBeVisible();

	for (let task = 2; task <= 14; task += 1) {
		await answerAssessmentTask(page);
		if (task < 14) await expect(page.getByText(`Task ${task + 1} of 14`)).toBeVisible();
	}
	await expect(page.getByText('All 14 responses are saved.')).toBeVisible();
	await page.getByRole('button', { name: 'Complete diagnosis' }).click();
	await expect(page.getByRole('heading', { name: 'Your Skill Profile is ready' })).toBeVisible({
		timeout: 20_000
	});

	await page.reload();
	await expect(page.getByRole('heading', { name: 'Your Skill Profile is ready' })).toBeVisible();
	await page.getByRole('link', { name: 'Start today’s practice' }).click();
	await page.getByRole('button', { name: 'Start five problems' }).click();

	for (let problem = 1; problem <= 5; problem += 1) {
		await expect(page.getByText(`Problem ${problem} of 5`)).toBeVisible({ timeout: 15_000 });
		expect(await page.content()).not.toContain('answerKey');
		await answerPracticeProblem(page);
		const next = page.getByRole('link', {
			name: problem === 5 ? 'View session recap' : 'Continue'
		});
		await expect(next).toBeVisible({ timeout: 15_000 });
		await next.click();
	}
	await expect(page.getByRole('heading', { name: 'Nice work — all five are done' })).toBeVisible();

	await page.getByRole('link', { name: 'Today' }).click();
	await expect(page.getByText('1 / 5')).toBeVisible();
	await page.getByRole('button', { name: 'Sign out' }).click();
	await expect(page).toHaveURL(/\/login$/);

	await signIn(page, adminUsername, adminPassword);
	await expect(page).toHaveURL(/\/admin$/);
	await expect(page.getByRole('heading', { name: 'Learner study overview' })).toBeVisible();
	await expect(page.getByText(learnerName).first()).toBeVisible();
	await expect(page.getByText('Assessment audit details')).toBeVisible();
	const learnerRoute = await page.goto('/study');
	expect(learnerRoute?.status()).toBe(403);
});
