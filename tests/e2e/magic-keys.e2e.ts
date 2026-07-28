import { expect, test } from './fixtures/test';
import { magicSturdy, qwerty, vylet } from './fixtures/catalog-data';

const mappedLayoutName = vylet[0];
const mappedLayoutView = `/?name=${encodeURIComponent(mappedLayoutName)}&likes=0&newIndicator=0`;

test('shows mappings inline with stats and in a floating window without stats', async ({
	page
}) => {
	await page.goto(mappedLayoutView);

	const card = page.locator(`[data-layout-name="${mappedLayoutName}"]`);
	const mappingsToggle = card.locator('button.magic-key-indicator');
	await expect(mappingsToggle).toHaveAccessibleName('Show magic key mappings');
	await mappingsToggle.click();
	await expect(mappingsToggle).toHaveAttribute('aria-pressed', 'true');
	await expect(mappingsToggle).toHaveAccessibleName('Show layout stats');
	await expect(card.getByRole('region', { name: 'Magic key mappings' })).toBeVisible();

	await page.getByRole('button', { name: 'Display settings' }).click();
	const displaySettings = page.getByRole('dialog', { name: 'Display settings' });
	await displaySettings.getByRole('checkbox', { name: 'Show stats' }).uncheck();
	await displaySettings.getByRole('button', { name: 'Close' }).click();

	await expect(card.getByRole('region', { name: 'Magic key mappings' })).toHaveCount(0);
	await expect(mappingsToggle).toHaveAccessibleName('Show magic key mappings');
	await mappingsToggle.click();

	const mappingsWindow = page.getByRole('dialog', {
		name: `${mappedLayoutName} magic key mappings`
	});
	await expect(mappingsWindow).toBeVisible();
	await expect(mappingsWindow.getByRole('region', { name: 'Magic key mappings' })).toBeVisible();
	await expect(page.locator('.modal-backdrop')).toHaveCount(0);

	const dragHandle = mappingsWindow.getByRole('button', {
		name: `Drag ${mappedLayoutName} magic key mappings window`
	});
	const beforeDrag = await mappingsWindow.boundingBox();
	const handleBox = await dragHandle.boundingBox();
	expect(beforeDrag).not.toBeNull();
	expect(handleBox).not.toBeNull();
	await page.mouse.move(handleBox!.x + 40, handleBox!.y + handleBox!.height / 2);
	await page.mouse.down();
	await page.mouse.move(handleBox!.x + 100, handleBox!.y + handleBox!.height / 2 + 40);
	await page.mouse.up();
	const afterDrag = await mappingsWindow.boundingBox();
	expect(afterDrag).not.toBeNull();
	expect(afterDrag!.x).toBeGreaterThan(beforeDrag!.x + 40);
	expect(afterDrag!.y).toBeGreaterThan(beforeDrag!.y + 20);
});

test('keeps the mappings indicator noninteractive when the sidecar is unavailable', async ({
	page
}) => {
	await page.route('**/magic-key-mappings.json', async (route) => {
		await route.fulfill({ json: {} });
	});
	await page.goto(mappedLayoutView);

	const card = page.locator(`[data-layout-name="${mappedLayoutName}"]`);
	await expect(card.getByLabel('Magic key mappings unavailable')).toBeVisible();
	await expect(card.getByRole('button', { name: 'Show magic key mappings' })).toHaveCount(0);
});

test('filters to layouts with known magic-key mappings and applies their rules', async ({
	page
}) => {
	await page.route('**/all-layouts.json', async (route) => {
		await route.fulfill({ json: [qwerty, magicSturdy, vylet] });
	});
	await page.goto('/?likes=0&newIndicator=0');

	const cards = page.locator('[data-layout-name]');
	await expect(cards).toHaveCount(3);

	await page.getByRole('button', { name: 'Keyboard filters', exact: true }).click();
	const magicKeyFilter = page
		.getByRole('region', { name: 'Keyboard filters' })
		.getByLabel('Magic key');
	await magicKeyFilter.selectOption({ label: 'Require with known mappings' });

	await expect(page.locator('#results-status')).toContainText('Showing 1 layout');
	await expect(cards).toHaveCount(1);

	const card = page.locator(`[data-layout-name="${mappedLayoutName}"]`);
	await expect(card).toBeVisible();
	const mappingsToggle = card.locator('button.magic-key-indicator');
	await expect(mappingsToggle).toBeVisible();

	const textarea = card.getByPlaceholder('Layout test area');
	await textarea.focus();

	// Physical QWERTY keys produce logical `cloc*ing out af*er wor*`,
	// exercising c* → ck, f* → ft, and r* → rk.
	for (const key of [
		'w',
		'u',
		'i',
		'w',
		'm',
		';',
		'j',
		'c',
		'Space',
		'i',
		'o',
		'd',
		'Space',
		'k',
		'g',
		'm',
		'l',
		'a',
		'Space',
		'q',
		'i',
		'a',
		'm'
	]) {
		await page.keyboard.press(key);
	}
	await expect(textarea).toHaveValue('clocking out after work');
});
