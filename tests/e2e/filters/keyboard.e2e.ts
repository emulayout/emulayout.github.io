import { expect, test } from '../fixtures/test';

const lightweightView = '/?stats=0&testArea=0&likes=0&newIndicator=0';

test('combines thumb, magic key, and board type filters', async ({ page }) => {
	await page.goto(lightweightView);

	await page.getByRole('button', { name: 'Keyboard filters', exact: true }).click();

	const keyboardFilters = page.getByRole('region', { name: 'Keyboard filters' });
	const thumbKeys = keyboardFilters.getByLabel('Thumb keys');
	const magicKey = keyboardFilters.getByLabel('Magic key');
	const boardType = keyboardFilters.getByLabel('Board type');

	await thumbKeys.selectOption('required');
	await magicKey.selectOption('required');

	await expect(page.locator('#results-status')).toContainText('Showing 1 layout');
	await expect(page.locator('[data-layout-name]')).toHaveCount(1);
	await expect(page.getByRole('heading', { name: 'magic_sturdy', exact: true })).toBeVisible();
	await expect(page).toHaveURL(/(?:\?|&)thumbKeys=required(?:&|$)/);
	await expect(page).toHaveURL(/(?:\?|&)magicKey=required(?:&|$)/);

	await page.reload();
	await page.getByRole('button', { name: /^Keyboard filters/ }).click();

	await expect(thumbKeys).toHaveValue('required');
	await expect(magicKey).toHaveValue('required');
	await expect(page.locator('#results-status')).toContainText('Showing 1 layout');
	await expect(page.locator('[data-layout-name]')).toHaveCount(1);
	await expect(page.getByRole('heading', { name: 'magic_sturdy', exact: true })).toBeVisible();

	await boardType.selectOption('angle');

	await expect(page.locator('#results-status')).toContainText('Showing 0 layouts');
	await expect(page.locator('[data-layout-name]')).toHaveCount(0);

	await magicKey.selectOption('excluded');

	await expect(page.locator('#results-status')).toContainText('Showing 1 layout');
	await expect(page.locator('[data-layout-name]')).toHaveCount(1);
	await expect(page.getByRole('heading', { name: 'turnip', exact: true })).toBeVisible();
});
