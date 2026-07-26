import { expect, test } from '../fixtures/test';

const lightweightView = '/?stats=0&testArea=0&likes=0&newIndicator=0';

test('filters by multiple authors, restores them, and clears the selection', async ({ page }) => {
	await page.goto(lightweightView);

	const authorSelect = page.locator('.author-select');
	await authorSelect.getByRole('button', { name: 'All authors', exact: true }).click();

	let authorSearch = page.getByPlaceholder('Search authors...');
	await authorSearch.fill('stronglytyped');
	await authorSelect.getByRole('button', { name: /stronglytyped/ }).click();
	await authorSearch.press('Escape');

	await expect(
		authorSelect.getByRole('button', { name: 'stronglytyped', exact: true })
	).toBeVisible();
	await expect(page.locator('#results-status')).toContainText('Showing 2 layouts');
	await expect(page.locator('[data-layout-name]')).toHaveCount(2);
	await expect(page.getByRole('heading', { name: 'nokwts', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'graphite', exact: true })).toBeVisible();
	await expect(page).toHaveURL(/(?:\?|&)authors=[^&]+(?:&|$)/);

	await page.reload();

	await expect(
		authorSelect.getByRole('button', { name: 'stronglytyped', exact: true })
	).toBeVisible();
	await expect(page.locator('#results-status')).toContainText('Showing 2 layouts');
	await expect(page.locator('[data-layout-name]')).toHaveCount(2);
	await expect(page.getByRole('heading', { name: 'nokwts', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'graphite', exact: true })).toBeVisible();

	await authorSelect.getByRole('button', { name: 'stronglytyped', exact: true }).click();
	authorSearch = page.getByPlaceholder('Search authors...');
	await authorSearch.fill('lelazsq');
	await authorSelect.getByRole('button', { name: /lelazsq/ }).click();
	await authorSearch.press('Escape');

	await expect(
		authorSelect.getByRole('button', { name: 'lelazsq, stronglytyped', exact: true })
	).toBeVisible();
	await expect(page.locator('#results-status')).toContainText('Showing 3 layouts');
	await expect(page.locator('[data-layout-name]')).toHaveCount(3);
	await expect(page.getByRole('heading', { name: 'lela', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'nokwts', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'graphite', exact: true })).toBeVisible();
	await expect(page).toHaveURL(/(?:\?|&)authors=[^&]*(?:%2C|,)[^&]+(?:&|$)/);

	await page.reload();

	await expect(
		authorSelect.getByRole('button', { name: 'lelazsq, stronglytyped', exact: true })
	).toBeVisible();
	await expect(page.locator('#results-status')).toContainText('Showing 3 layouts');
	await expect(page.locator('[data-layout-name]')).toHaveCount(3);
	await expect(page.getByRole('heading', { name: 'lela', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'nokwts', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'graphite', exact: true })).toBeVisible();

	await authorSelect.getByRole('button', { name: 'Clear author selection' }).click();

	await expect(
		authorSelect.getByRole('button', { name: 'All authors', exact: true })
	).toBeVisible();
	await expect(page.locator('#results-status')).toContainText('Showing 11 layouts');
	await expect(page).not.toHaveURL(/(?:\?|&)authors=/);

	await page.reload();

	await expect(
		authorSelect.getByRole('button', { name: 'All authors', exact: true })
	).toBeVisible();
	await expect(page.locator('#results-status')).toContainText('Showing 11 layouts');
});
