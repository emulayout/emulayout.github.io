import { expect, test } from './fixtures/test';
import { qwerty } from './fixtures/catalog-data';
import { LAYOUT_DETAIL_VERSION } from '../../src/lib/layoutDetails';

test('finger colors use authored positions and can be toggled by keyboard and restored', async ({
	page
}) => {
	const layout = structuredClone(qwerty) as unknown[];
	const chars = layout[5] as string[];
	const fingers = chars.map(() => 'LP');
	fingers[chars.indexOf('a')] = 'LM';
	layout[9] = { fingers };
	await page.route('**/layout-details/*.json', (route) =>
		route.fulfill({
			json: { version: LAYOUT_DETAIL_VERSION, layout, authorName: 'Test', likeCount: 0, stats: {} }
		})
	);
	await page.goto('/layouts/QWERTY?tab=test');
	const panel = page.getByRole('tabpanel', { name: 'Layout test area', exact: true });
	const colors = panel.getByRole('switch', { name: 'Finger assignments' });
	const a = panel.locator('[data-key-char="a"]');
	await expect(colors).not.toBeChecked();
	await expect(a).not.toHaveAttribute('data-assigned-finger');
	await colors.focus();
	await page.keyboard.press('Space');
	await expect(colors).toBeChecked();
	await expect(a).toHaveAttribute('data-assigned-finger', 'LM');
	await expect(a).toHaveAttribute('title', /Left middle/);
	await expect(a).toHaveCSS('background-color', 'color(srgb 0 0.305882 0.336471)');
	await expect(panel.locator('[data-key-char="q"]')).toHaveCSS(
		'background-color',
		'rgb(156, 22, 31)'
	);
	const homeColors = panel.getByRole('switch', { name: 'Color home keys' });
	await homeColors.uncheck();
	await expect(a).toHaveCSS('background-color', 'rgb(0, 120, 132)');
	await homeColors.check();
	await expect(a).toHaveCSS('background-color', 'color(srgb 0 0.305882 0.336471)');
	await expect(a).toHaveCSS('color', 'rgb(255, 255, 255)');
	await expect(panel.getByLabel('Finger color legend')).toHaveCount(0);
	await expect(panel.getByRole('switch', { name: 'Color home keys' })).toBeChecked();
	await page.reload();
	await expect(a).toHaveAttribute('data-assigned-finger', 'LM');
	await colors.click();
	await expect(a).not.toHaveAttribute('data-assigned-finger');
	await page.getByRole('tab', { name: 'Typing practice', exact: true }).click();
	await page.getByRole('switch', { name: 'Finger assignments' }).click();
	await expect(
		page
			.getByRole('tabpanel', { name: 'Typing practice', exact: true })
			.locator('[data-key-char="a"]')
	).toHaveAttribute('data-assigned-finger', 'LM');
	await page.getByRole('tab', { name: 'Layout feel', exact: true }).click();
	await expect(page.getByRole('switch', { name: 'Finger assignments' })).toBeChecked();
});
