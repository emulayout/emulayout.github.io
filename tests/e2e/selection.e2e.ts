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
	const allLayoutsTab = page.getByRole('tab', { name: 'All layouts' });
	await expect(emptySelectedTab).toHaveCount(0);
	await expect(clearSelectedLayouts).toHaveCount(0);
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

	await expect(page.getByRole('tab', { name: 'Selected layouts (0)' })).toHaveCount(0);
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
	await expect(
		page.getByRole('button', { name: 'Save (2) selected as view', exact: true })
	).toBeVisible();
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

	await expect(selectedActions.getByRole('button')).toHaveCount(2);
	await expect(
		selectedActions.getByRole('button', { name: 'Save (2) selected as view' })
	).toBeVisible();
	await expect(
		selectedActions.getByRole('button', { name: 'Selected layout options' })
	).toHaveCount(0);
	await expect(clearSelectedLayouts).toBeVisible();

	await clearSelectedLayouts.click();

	await expect(allLayoutsTab).toHaveAttribute('aria-selected', 'true');
	await expect(emptySelectedTab).toHaveCount(0);
	await expect(colemakSelection).not.toBeChecked();

	await expect(clearSelectedLayouts).toHaveCount(0);
	await expect(page).not.toHaveURL(/(?:\?|&)selected=/);
});

test('navigates layout-view tabs with roving focus and exposes their panel relationship', async ({
	page
}) => {
	await page.goto('/');
	await page.getByRole('checkbox', { name: 'Select Colemak-DH' }).check();

	const selectedTab = page.getByRole('tab', { name: 'Selected layouts (1)' });
	const allTab = page.getByRole('tab', { name: 'All layouts' });
	await expect(selectedTab).toHaveAttribute('aria-controls', 'layout-view-panel');
	await expect(page.getByRole('tabpanel', { name: 'Layout results' })).toBeVisible();

	await selectedTab.focus();
	await selectedTab.press('ArrowLeft');
	await expect(allTab).toBeFocused();
	await expect(allTab).toHaveAttribute('aria-selected', 'true');

	await allTab.press('ArrowRight');
	await expect(selectedTab).toBeFocused();
	await expect(selectedTab).toHaveAttribute('aria-selected', 'true');
});

test('shows selected layouts outside a saved source and keeps the toggle across views', async ({
	page
}) => {
	await page.goto('/');
	await page.getByRole('checkbox', { name: 'Select Colemak-DH' }).check();
	const options = page.getByRole('button', { name: 'Selected layout options' });
	await expect(options).toHaveCount(0);
	await page.getByRole('button', { name: 'Save (1) selected as view' }).click();
	const dialog = page.getByRole('dialog', { name: 'Save selected as view' });
	await dialog.getByRole('textbox', { name: 'Name' }).fill('Saved subset');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	const savedTab = page.getByRole('tab', { name: /^Saved subset/ });
	await expect(savedTab).toHaveAttribute('aria-selected', 'true');

	const allTab = page.getByRole('tab', { name: 'All layouts' });
	await allTab.click();
	await page.getByRole('checkbox', { name: 'Select lela' }).check();
	await savedTab.click();
	const outsideLayout = page.locator('[data-layout-name="lela"]');
	await expect(outsideLayout).toHaveCount(0);
	await options.press('ArrowUp');
	const saveItem = page.getByRole('menuitem', { name: 'Save selected (2) layouts as view' });
	await expect(saveItem).toBeFocused();
	await saveItem.press('Escape');
	await expect(options).toBeFocused();

	await page.getByRole('button', { name: 'Always show selected layouts', pressed: false }).click();
	await expect(outsideLayout).toHaveClass(/layout-card--force-included/);
	await expect(page.locator('[data-layout-name="Colemak-DH"]')).not.toHaveClass(
		/layout-card--force-included/
	);
	await page.reload();
	await expect(outsideLayout).toHaveClass(/layout-card--force-included/);
	await allTab.click();
	await expect(page.getByRole('button', { name: 'Save (2) selected as view' })).toBeVisible();
	await expect(options).toHaveCount(0);
	await expect(outsideLayout).not.toHaveClass(/layout-card--force-included/);
	await savedTab.click();
	await expect(outsideLayout).toHaveClass(/layout-card--force-included/);

	await page.getByRole('button', { name: 'Always show selected layouts', pressed: true }).click();
	await expect(outsideLayout).toHaveCount(0);
});
