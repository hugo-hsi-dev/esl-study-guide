import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Home from './+page.svelte';

describe('public home', () => {
	it('presents a bounded ESL placement study product with one start action', async () => {
		expect.assertions(3);
		render(Home);

		await expect
			.element(page.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Know what to practice next for your ESL placement test');
		await expect
			.element(page.getByRole('link', { name: 'Sign in and start studying' }))
			.toHaveAttribute('href', '/login');
		await expect
			.element(page.getByText(/does not issue an official placement score/))
			.toBeInTheDocument();
	});
});
