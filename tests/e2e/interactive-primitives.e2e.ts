import { expect, test } from './fixtures/test';

test('opens and navigates a dropdown menu from the keyboard', async ({ page }) => {
	await page.goto('/?stats=0&testArea=0&likes=0&newIndicator=0');

	const trigger = page.getByRole('button', { name: 'External links' }).first();
	await trigger.focus();
	await trigger.press('ArrowDown');

	const menu = page.getByRole('menu', { name: 'External links' });
	await expect(menu).toBeVisible();
	const enabledItems = menu.getByRole('menuitem').filter({ hasNot: page.locator('[disabled]') });
	await expect(enabledItems.first()).toBeFocused();

	await page.keyboard.press('End');
	await expect(enabledItems.last()).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(menu).toHaveCount(0);
	await expect(trigger).toBeFocused();
});

test('uses the shared focusable listbox for finger-workload presets', async ({ page }) => {
	await page.goto('/?stats=0&testArea=0&likes=0&newIndicator=0');

	await page.getByRole('button', { name: 'Finger workload', exact: true }).click();
	const trigger = page.locator('.finger-workload-preset-trigger');
	await trigger.click();

	const listbox = page.getByRole('listbox', { name: 'Quick finger workload presets' });
	await expect(listbox).toBeFocused();
	await listbox.press('End');
	await expect(listbox).toHaveAttribute(
		'aria-activedescendant',
		'finger-workload-presets-cmini-option-5'
	);
	await listbox.press('Enter');
	await expect(listbox).toHaveCount(0);
	await expect(trigger).toBeFocused();
	await expect(trigger).toContainText('Low pinkies');
});

test('links tooltips to their trigger and dismisses them with Escape', async ({ page }) => {
	await page.goto('/?stats=0&testArea=0&likes=0&newIndicator=0');
	await page.getByRole('button', { name: 'Show help hints' }).click();

	const trigger = page.getByRole('button', { name: 'Help', exact: true }).first();
	await trigger.click();
	await expect(trigger).toBeFocused();
	await expect(trigger).toHaveAttribute('aria-describedby', /^tooltip-/);
	const tooltip = page.getByRole('tooltip');
	await expect(tooltip).toBeVisible();
	const tooltipId = await tooltip.getAttribute('id');
	expect(tooltipId).not.toBeNull();
	await expect(trigger).toHaveAttribute('aria-describedby', tooltipId!);

	await trigger.press('Escape');
	await expect(tooltip).toHaveCount(0);
	await expect(trigger).toBeFocused();
});
