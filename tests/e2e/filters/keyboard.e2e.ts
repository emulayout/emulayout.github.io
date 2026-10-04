import { expect, test } from '../fixtures/test';

const lightweightView = '/?stats=0&testArea=0&likes=0&newIndicator=0';

test('combines thumb and magic key filters', async ({ page }) => {
	await page.goto(lightweightView);

	await page.getByRole('button', { name: 'Keyboard filters', exact: true }).click();

	const keyboardFilters = page.getByRole('region', { name: 'Keyboard filters' });
	const thumbKeys = keyboardFilters.getByLabel('Thumb keys');
	const magicKey = keyboardFilters.getByLabel('Magic key');

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

	await magicKey.selectOption('excluded');
	await expect(page.getByRole('heading', { name: 'magic_sturdy', exact: true })).toHaveCount(0);
});

for (const [param, label] of [
	['magicKey', 'Magic key'],
	['adaptiveSwap', 'Adaptive swap']
]) {
	test(`migrates legacy ${param} URLs to the simplified filter`, async ({ page }) => {
		await page.goto(`${lightweightView}&${param}=required-mapped`);
		await page.getByRole('button', { name: /^Keyboard filters/ }).click();
		const filter = page.getByRole('region', { name: 'Keyboard filters' }).getByLabel(label);
		await expect(filter).toHaveValue('required');
		await expect(filter.locator('option')).toHaveCount(3);
		await page.reload();
		await page.getByRole('button', { name: /^Keyboard filters/ }).click();
		await expect(filter).toHaveValue('required');
		await filter.selectOption('excluded');
		await expect(page).toHaveURL(new RegExp(`[?&]${param}=excluded(?:&|$)`));
		await filter.selectOption('required');
		await expect(page).toHaveURL(new RegExp(`[?&]${param}=required(?:&|$)`));
	});
}
