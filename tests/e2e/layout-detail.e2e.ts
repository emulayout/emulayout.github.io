import { expect, test } from './fixtures/test';

test.use({ catalogVariant: 'core' });

test('opens a layout on its own route and returns to the preserved index view', async ({
	page
}) => {
	await page.goto('/?name=Colemak-DH&likes=0&newIndicator=0');

	const card = page.locator('[data-layout-name="Colemak-DH"]');
	await card.getByRole('link', { name: 'View layout details' }).click();

	await expect(page).toHaveURL('/layouts/Colemak-DH?name=Colemak-DH&likes=0&newIndicator=0');
	await expect(page.getByRole('heading', { name: 'Emulayout', exact: true })).toBeVisible();
	await expect(page.locator('[data-layout-detail]')).toBeVisible();
	await expect(page.locator('.layout-detail-title')).toHaveText('Colemak-DH');
	await expect(page.getByRole('tabpanel', { name: 'Layout results' })).toHaveCount(0);

	await page.getByRole('link', { name: 'Back to layouts' }).click();

	await expect(page).toHaveURL('/?name=Colemak-DH&likes=0&newIndicator=0');
	await expect(page.locator('[data-layout-name="Colemak-DH"]')).toBeVisible();
});

test('loads direct detail links from the full catalog payload and keeps app-bar actions working', async ({
	page
}) => {
	const catalogRequest = page.waitForRequest('**/all-layouts.json');
	await page.goto('/layouts/QWERTY?likes=0');
	await catalogRequest;

	await expect(page.locator('[data-layout-detail]')).toBeVisible();
	await expect(page.locator('.layout-detail-title')).toHaveText('QWERTY');

	await page.getByRole('button', { name: 'Compare layouts' }).click();
	await expect(page.getByRole('dialog', { name: 'Compare' })).toBeVisible();
});

test('shows a recoverable not-found page for an unknown layout URL', async ({ page }) => {
	await page.goto('/layouts/does-not-exist?likes=0');

	await expect(page.getByRole('heading', { name: 'Layout not found' })).toBeVisible();
	await expect(
		page.getByText('No layout named “does-not-exist” is in the current catalog.')
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Back to layouts' })).toHaveAttribute(
		'href',
		'/?likes=0'
	);
});
