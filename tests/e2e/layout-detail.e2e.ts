import { expect, test } from './fixtures/test';

test.use({ catalogVariant: 'core' });

test('opens a layout on its own route and returns to the preserved index view', async ({
	page
}) => {
	await page.goto('/');

	const colemakSelection = page.getByRole('checkbox', { name: 'Select Colemak-DH' });
	const lelaSelection = page.getByRole('checkbox', { name: 'Select lela' });
	await colemakSelection.check();
	await lelaSelection.check();
	await expect(page).toHaveURL(/(?:\?|&)selected=[^&]*(?:%2C|,)[^&]+(?:&|$)/);
	const indexUrl = page.url();

	const card = page.locator('[data-layout-name="Colemak-DH"]');
	await card.getByRole('link', { name: 'View layout details' }).click();

	await expect(page).toHaveURL('/layouts/Colemak-DH');
	await expect(page.getByRole('heading', { name: 'Emulayout', exact: true })).toBeVisible();
	await expect(page.locator('[data-layout-detail]')).toBeVisible();
	await expect(page.locator('.layout-detail-title')).toHaveText('Colemak-DH');
	await expect(page.getByRole('checkbox', { name: 'Select Colemak-DH' })).toHaveCount(0);
	await expect(page.getByRole('tabpanel', { name: 'Layout results' })).toHaveCount(0);

	await page.getByRole('link', { name: 'Back to layouts' }).click();

	await expect(page).toHaveURL(indexUrl);
	await expect(colemakSelection).toBeChecked();
	await expect(lelaSelection).toBeChecked();

	await page.reload();
	await expect(colemakSelection).toBeChecked();
	await expect(lelaSelection).toBeChecked();
});

test('loads a direct detail file before fetching the full catalog for Compare', async ({
	page
}) => {
	const requestedPaths: string[] = [];
	page.on('request', (request) => requestedPaths.push(new URL(request.url()).pathname));
	await page.goto('/layouts/QWERTY?selected=lela&likes=0');

	await expect(page).toHaveURL('/layouts/QWERTY');
	await expect(page.locator('[data-layout-detail]')).toBeVisible();
	await expect(page.locator('.layout-detail-title')).toHaveText('QWERTY');
	expect(requestedPaths.some((path) => path.startsWith('/layout-details/'))).toBe(true);
	expect(requestedPaths).not.toContain('/all-layouts.json');

	await page.getByRole('button', { name: 'Compare layouts' }).click();
	await expect(page.getByRole('dialog', { name: 'Compare' })).toBeVisible();
	expect(requestedPaths).toContain('/all-layouts.json');
});

test('loads Quick Find names and highlighted layout details on demand', async ({ page }) => {
	const requestedPaths: string[] = [];
	page.on('request', (request) => requestedPaths.push(new URL(request.url()).pathname));
	await page.goto('/layouts/QWERTY');

	await page.getByRole('button', { name: 'Quick find layouts' }).click();
	const quickFind = page.getByRole('dialog', { name: 'Quick find' });
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).fill('lela');

	await expect(quickFind.locator('[data-layout-name="lela"]')).toBeVisible();
	expect(requestedPaths).toContain('/layout-names.json');
	expect(requestedPaths.filter((path) => path.startsWith('/layout-details/')).length).toBe(2);
	expect(requestedPaths).not.toContain('/all-layouts.json');
});

test('shows a recoverable not-found page for an unknown layout URL', async ({ page }) => {
	await page.goto('/layouts/does-not-exist?selected=lela');

	await expect(page).toHaveURL('/layouts/does-not-exist');
	await expect(page.getByRole('heading', { name: 'Layout not found' })).toBeVisible();
	await expect(
		page.getByText('No layout named “does-not-exist” is in the current catalog.')
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Back to layouts' })).toHaveAttribute('href', '/');
});
