import { expect, test } from '../fixtures/test';

const lightweightView = '/?stats=0&testArea=0&likes=0&newIndicator=0';

test('filters the catalog by name and restores the URL-backed filter', async ({ page }) => {
	await page.goto(lightweightView);

	const nameFilter = page.getByRole('textbox', { name: 'Layout name' });
	await expect(nameFilter).toHaveAttribute('autocomplete', 'off');
	await nameFilter.fill('QWERTY');

	await expect(page.locator('#results-status')).toContainText('Showing 1 layout');
	await expect(page.locator('[data-layout-name]')).toHaveCount(1);
	await expect(page.getByRole('heading', { name: 'QWERTY', exact: true })).toBeVisible();
	await expect(page).toHaveURL(/(?:\?|&)name=QWERTY(?:&|$)/);

	await page.reload();

	await expect(nameFilter).toHaveValue('QWERTY');
	await expect(page.locator('#results-status')).toContainText('Showing 1 layout');
	await expect(page.locator('[data-layout-name]')).toHaveCount(1);
	await expect(page.getByRole('heading', { name: 'QWERTY', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Clear layout name' }).click();

	await expect(nameFilter).toBeFocused();
	await expect(nameFilter).toHaveValue('');
	await expect(page.locator('#results-status')).toContainText('Showing 11 layouts');
	await expect(page).not.toHaveURL(/(?:\?|&)name=/);
});
