import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Home from './+page.svelte';

describe('public home', () => {
	it('presents the private study product with sign-in as its only action', async () => {
		expect.assertions(3);
		render(Home);

		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Know what to practice next');
		await expect
			.element(page.getByRole('link', { name: 'Sign in' }))
			.toHaveAttribute('href', '/login');
		await expect.element(page.getByText(/Build a clear Skill Profile/)).toBeInTheDocument();
	});
});
