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
			.toHaveTextContent('Build the ESL placement skills your target test may require');
		await expect
			.element(page.getByRole('link', { name: 'Start studying' }))
			.toHaveAttribute('href', '/login');
		await expect
			.element(page.getByText(/does not issue an official placement score/))
			.toBeInTheDocument();
	});
});
