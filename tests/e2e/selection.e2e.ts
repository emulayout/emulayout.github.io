import { expect, test } from './fixtures/test';

test.use({ catalogVariant: 'core' });

test('selects, restores, and clears layouts from All and Selected views', async ({ page }) => {
	await page.goto('/?source=selected');

	const cards = page.locator('[data-layout-name]');
	const resultsStatus = page.locator('#results-status');
	const clearSelectedLayouts = page.getByRole('button', {
		name: 'Clear selected layouts',
		exact: true
	});
	const colemakSelection = page.getByRole('checkbox', { name: 'Select Colemak-DH' });
	const lelaSelection = page.getByRole('checkbox', { name: 'Select lela' });

	const emptySelectedTab = page.getByRole('tab', { name: 'Selected layouts (0)' });
	await expect(emptySelectedTab).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByText('No layouts selected', { exact: true })).toBeVisible();
	await expect(resultsStatus).toContainText('Showing 0 selected layouts');
	await expect(cards).toHaveCount(0);
	await expect(clearSelectedLayouts).toHaveCount(0);

	const allLayoutsTab = page.getByRole('tab', { name: 'All layouts' });
	await allLayoutsTab.click();
	await expect(allLayoutsTab).toHaveAttribute('aria-selected', 'true');

	await colemakSelection.check();
	await lelaSelection.check();

	await expect(clearSelectedLayouts).toBeVisible();
	await expect(colemakSelection).toBeChecked();
	await expect(lelaSelection).toBeChecked();
	await expect(page.getByRole('tab', { name: 'Selected layouts (2)' })).toBeVisible();
	await expect(page).toHaveURL(/(?:\?|&)selected=[^&]*(?:%2C|,)[^&]+(?:&|$)/);

	await page.reload();

	await expect(allLayoutsTab).toHaveAttribute('aria-selected', 'true');
	await expect(colemakSelection).toBeChecked();
	await expect(lelaSelection).toBeChecked();
	await expect(page.getByRole('tab', { name: 'Selected layouts (2)' })).toBeVisible();
	await expect(clearSelectedLayouts).toBeVisible();

	await clearSelectedLayouts.click();

	await expect(page.getByRole('tab', { name: 'Selected layouts (0)' })).toBeVisible();
	await expect(colemakSelection).not.toBeChecked();
	await expect(lelaSelection).not.toBeChecked();
	await expect(clearSelectedLayouts).toHaveCount(0);
	await expect(page).not.toHaveURL(/(?:\?|&)selected=/);

	await colemakSelection.check();
	await lelaSelection.check();

	const selectedTab = page.getByRole('tab', { name: 'Selected layouts (2)' });
	await expect(selectedTab).toBeVisible();
	await selectedTab.click();

	await expect(selectedTab).toHaveAttribute('aria-selected', 'true');
	await expect(resultsStatus).toContainText('Showing 2 selected layouts');
	await expect(cards).toHaveCount(2);
	await expect(page.getByRole('heading', { name: 'Colemak-DH', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'lela', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'QWERTY', exact: true })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Save as view', exact: true })).toBeVisible();
	await expect(clearSelectedLayouts).toBeVisible();
	await expect(page).toHaveURL(/(?:\?|&)source=selected(?:&|$)/);
	await expect(page).toHaveURL(/(?:\?|&)selected=[^&]*(?:%2C|,)[^&]+(?:&|$)/);

	await page.reload();

	await expect(selectedTab).toHaveAttribute('aria-selected', 'true');
	await expect(resultsStatus).toContainText('Showing 2 selected layouts');
	await expect(cards).toHaveCount(2);
	await expect(colemakSelection).toBeChecked();
	await expect(lelaSelection).toBeChecked();
	await expect(page.getByRole('heading', { name: 'Colemak-DH', exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'lela', exact: true })).toBeVisible();
	await expect(clearSelectedLayouts).toBeVisible();

	const selectedActions = page.locator('.selected-layout-actions-group');
	const nameFilter = page.getByRole('textbox', { name: 'Layout name' });
	await nameFilter.fill('Colemak');

	await expect(selectedActions.getByRole('button')).toHaveCount(1);
	await expect(
		selectedActions.getByRole('button', { name: 'Save as view', exact: true })
	).toHaveCount(0);
	await expect(clearSelectedLayouts).toHaveText('Clear selected layouts');

	await page.getByRole('button', { name: 'Clear layout name' }).click();

	await expect(selectedActions.getByRole('button')).toHaveCount(2);
	await expect(
		selectedActions.getByRole('button', { name: 'Save as view', exact: true })
	).toBeVisible();

	await clearSelectedLayouts.click();

	await expect(page.getByRole('tab', { name: 'Selected layouts (0)' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(resultsStatus).toContainText('Showing 0 selected layouts');
	await expect(page.getByText('No layouts selected', { exact: true })).toBeVisible();
	await expect(cards).toHaveCount(0);
	await expect(clearSelectedLayouts).toHaveCount(0);
	await expect(page).not.toHaveURL(/(?:\?|&)selected=/);
});
