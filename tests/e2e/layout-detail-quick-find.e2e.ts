import { expect, test } from './fixtures/test';
import { LAYOUT_DETAIL_VERSION, layoutDetailFileId } from '../../src/lib/layoutDetails';
import { lela } from './fixtures/catalog-data';

test.use({ catalogVariant: 'core' });

test('loads Quick Find names and highlighted layout details on demand', async ({ page }) => {
	await page.route(`**/layout-details/${layoutDetailFileId('lela')}.json`, async (route) => {
		await route.fulfill({
			json: {
				version: LAYOUT_DETAIL_VERSION,
				layout: lela,
				authorName: 'lelazsq',
				likeCount: 0,
				stats: {
					cmini: {
						monkeyracer: [
							1923, 2032, 1766, 106, 127, 578, 38, 641, 593, 597, 5448, 4552, 2044, 1857, 711, 792,
							2041, 948, 1331, 275, 0, 0, 0
						]
					}
				}
			}
		});
	});
	const requestedPaths: string[] = [];
	page.on('request', (request) => requestedPaths.push(new URL(request.url()).pathname));
	await page.goto('/layouts/QWERTY');

	await page.getByRole('button', { name: 'Quick find layouts' }).click();
	const quickFind = page.getByRole('dialog', { name: 'Quick find' });
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).fill('lela');

	const previewCard = quickFind.locator('[data-layout-name="lela"]');
	await expect(previewCard).toBeVisible();
	await expect(previewCard.getByText('SFB', { exact: true })).toBeVisible();
	await expect(previewCard.getByRole('checkbox', { name: 'Select lela' })).toHaveCount(0);
	await expect(
		previewCard.getByRole('button', { name: /Open .*Same-finger bigrams filter/ })
	).toHaveCount(0);
	await expect(
		previewCard.getByRole('button', { name: /Open Left pinky usage filter/ })
	).toHaveCount(0);
	await expect(previewCard.getByRole('button', { name: /Left pinky:/ })).toBeVisible();
	expect(requestedPaths).toContain('/layout-names.json');
	expect(requestedPaths.filter((path) => path.startsWith('/layout-details/')).length).toBe(2);
	expect(requestedPaths).not.toContain('/all-layouts.json');
});

test('debounces Quick Find detail fetches while the highlight moves', async ({ page }) => {
	const requestedDetails: string[] = [];
	page.on('request', (request) => {
		const path = new URL(request.url()).pathname;
		if (path.startsWith('/layout-details/')) requestedDetails.push(path);
	});
	await page.goto('/layouts/QWERTY');

	await page.getByRole('button', { name: 'Quick find layouts' }).click();
	const quickFind = page.getByRole('dialog', { name: 'Quick find' });
	const search = quickFind.getByRole('combobox', { name: 'Search layout names' });
	await search.fill('l');
	await search.press('ArrowDown');
	await search.press('ArrowUp');

	await expect(quickFind.locator('[data-layout-name="lela"]')).toBeVisible();
	expect(requestedDetails.filter((path) => path.includes(layoutDetailFileId('lela')))).toHaveLength(
		1
	);
	expect(
		requestedDetails.filter((path) => path.includes(layoutDetailFileId('Colemak-DH')))
	).toHaveLength(0);
});

test('reuses the loaded index catalog for Quick Find without detail fetches', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'lela', exact: true })).toBeVisible();

	const requestedPaths: string[] = [];
	page.on('request', (request) => requestedPaths.push(new URL(request.url()).pathname));

	await page.getByRole('button', { name: 'Quick find layouts' }).click();
	const quickFind = page.getByRole('dialog', { name: 'Quick find' });
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).fill('l');

	await expect(quickFind.locator('[data-layout-name="lela"]')).toBeVisible();
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).press('ArrowDown');
	await expect(quickFind.locator('[data-layout-name="Colemak-DH"]')).toBeVisible();

	expect(requestedPaths).not.toContain('/layout-names.json');
	expect(requestedPaths.filter((path) => path.startsWith('/layout-details/'))).toEqual([]);
});

test('opens the layout show page from Quick Find with Enter', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'lela', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Quick find layouts' }).click();
	const quickFind = page.getByRole('dialog', { name: 'Quick find' });
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).fill('lela');
	await expect(quickFind.getByRole('option', { name: 'lela' })).toBeVisible();
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).press('Enter');

	await expect(page).toHaveURL('/layouts/lela?tab=practice');
	await expect(quickFind).toHaveCount(0);
});

test('opens the show page in a new tab with Cmd/Ctrl activation and keeps Quick Find open', async ({
	page
}) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'lela', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Quick find layouts' }).click();
	const quickFind = page.getByRole('dialog', { name: 'Quick find' });
	const search = quickFind.getByRole('combobox', { name: 'Search layout names' });
	await search.fill('lela');
	await expect(quickFind.getByRole('option', { name: 'lela' })).toBeVisible();

	const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';

	const [enterTab] = await Promise.all([
		page.context().waitForEvent('page'),
		search.press(`${modifier}+Enter`)
	]);
	await expect(enterTab).toHaveURL('/layouts/lela?tab=practice');
	await expect(page).toHaveURL('/');
	await expect(quickFind).toBeVisible();

	const [clickTab] = await Promise.all([
		page.context().waitForEvent('page'),
		quickFind.getByRole('option', { name: 'lela' }).click({ modifiers: [modifier] })
	]);
	await expect(clickTab).toHaveURL('/layouts/lela?tab=practice');
	await expect(page).toHaveURL('/');
	await expect(quickFind).toBeVisible();
});

test('returns to the preserved index view after Quick Find detail-to-detail navigation', async ({
	page
}) => {
	await page.goto('/');

	const colemakSelection = page.getByRole('checkbox', { name: 'Select Colemak-DH' });
	await colemakSelection.check();
	await expect(page).toHaveURL(/(?:\?|&)selected=/);
	const indexUrl = page.url();

	await page
		.locator('[data-layout-name="Colemak-DH"]')
		.getByRole('link', { name: 'View Colemak-DH layout details' })
		.click();
	await expect(page).toHaveURL('/layouts/Colemak-DH?tab=practice');

	await page.getByRole('button', { name: 'Quick find layouts' }).click();
	const quickFind = page.getByRole('dialog', { name: 'Quick find' });
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).fill('lela');
	await expect(quickFind.getByRole('option', { name: 'lela' })).toBeVisible();
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).press('Enter');
	await expect(page).toHaveURL('/layouts/lela?tab=practice');

	await page.goBack();
	await expect(page).toHaveURL('/layouts/Colemak-DH?tab=practice');
	await page.goBack();
	await expect(page).toHaveURL(indexUrl);
	await expect(colemakSelection).toBeChecked();
});

test('browser Back returns to the previous detail page after Quick Find from a direct visit', async ({
	page
}) => {
	await page.goto('/layouts/QWERTY');
	await expect(page.getByRole('article', { name: 'QWERTY details' })).toBeVisible();

	await page.getByRole('button', { name: 'Quick find layouts' }).click();
	const quickFind = page.getByRole('dialog', { name: 'Quick find' });
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).fill('lela');
	await expect(quickFind.getByRole('option', { name: 'lela' })).toBeVisible();
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).press('Enter');
	await expect(page).toHaveURL('/layouts/lela?tab=practice');

	await page.goBack();
	await expect(page).toHaveURL('/layouts/QWERTY?tab=practice');
});

test('dismisses Quick Find when opening layout details from the preview', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'lela', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Quick find layouts' }).click();
	const quickFind = page.getByRole('dialog', { name: 'Quick find' });
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).fill('lela');

	const previewCard = quickFind.locator('[data-layout-name="lela"]');
	await expect(previewCard).toBeVisible();
	await previewCard.getByRole('link', { name: 'View lela layout details' }).click();

	await expect(page).toHaveURL('/layouts/lela?tab=practice');
	await expect(quickFind).toHaveCount(0);
});
