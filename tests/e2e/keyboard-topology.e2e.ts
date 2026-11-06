import { expect, test } from './fixtures/test';
import { easyHarlot } from '../fixtures/topologyLayouts';
import { LAYOUT_DETAIL_VERSION } from '../../src/lib/layoutDetails';

test.beforeEach(async ({ page }) => {
	await page.route('**/layout-details/*.json', (route) =>
		route.fulfill({
			json: {
				version: LAYOUT_DETAIL_VERSION,
				layout: easyHarlot('iso'),
				authorName: 'Test author',
				likeCount: 0,
				stats: {}
			}
		})
	);
	await page.route('**/all-layouts.json', (route) =>
		route.fulfill({ json: [easyHarlot('iso'), easyHarlot('ansi')] })
	);
});

test('preserves ISO positions or shifts to ANSI with consistent typing, preview, Feel and persistence', async ({
	page
}) => {
	await page.goto('/layouts/easy-harlot-iso?tab=test');
	const field = page.getByPlaceholder('Layout test area');
	const q = page.locator('.keyboard-preview__key[data-key-char="q"]');
	await expect(q).toHaveAttribute('data-key-unreachable', 'true');
	await expect(q).toHaveAttribute('title', /no counterpart on your ANSI keyboard/);
	await field.press('q');
	await field.press('a');
	await field.press('z');
	await expect(field).toHaveValue('bnx');

	await page.getByRole('button', { name: 'Input layout: QWERTY (ANSI)' }).click();
	const dialog = page.getByRole('dialog', { name: 'Configure input layout' });
	await dialog.getByLabel('ISO layouts on ANSI hardware').selectOption('shift');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(q).not.toHaveAttribute('data-key-unreachable');
	await field.press('Escape');
	await field.press('q');
	await field.press('a');
	await field.press('z');
	await expect(field).toHaveValue('bnq');
	await page.reload();
	await expect(q).not.toHaveAttribute('data-key-unreachable');
	await field.press('z');
	await expect(field).toHaveValue('q');

	await page.goto('/layouts/easy-harlot-iso?tab=feel&text=q');
	// The remapped prompt uses Z, which is now the physical input for the ISO extra key.
	await expect(page.getByLabel('Layout feel words', { exact: true })).toHaveText('z');
	await page.getByRole('button', { name: 'Input layout: QWERTY (ANSI)' }).click();
	await dialog
		.getByRole('combobox', { name: 'Keyboard topology', exact: true })
		.selectOption('iso');
	await dialog.getByLabel('Row 3, key 1', { exact: true }).fill('§');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(q).not.toHaveAttribute('data-key-unreachable');
	await page.goto('/layouts/easy-harlot-iso?tab=test');
	await field.press('z');
	await field.dispatchEvent('keydown', { key: '§', code: 'IntlBackslash' });
	await expect(field).toHaveValue('xq');
});

test('ortholinear hardware hides ANSI/ISO options and suffixes and preserves hardware when selecting a base', async ({
	page
}) => {
	await page.goto('/layouts/easy-harlot-iso?tab=test');
	await page.getByRole('button', { name: 'Input layout: QWERTY (ANSI)', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Configure input layout' });
	const geometry = dialog.getByRole('combobox', { name: 'Keyboard geometry' });
	await dialog
		.getByRole('combobox', { name: 'Keyboard topology', exact: true })
		.selectOption('iso');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await page.getByRole('button', { name: 'Input layout: QWERTY UK (ISO)', exact: true }).click();
	await geometry.selectOption({ label: 'Ortholinear' });
	await expect(dialog.getByRole('combobox', { name: 'Keyboard topology' })).toHaveCount(0);
	await expect(dialog.getByRole('combobox', { name: 'ISO layouts on ANSI hardware' })).toHaveCount(
		0
	);
	await expect(dialog.getByText('Potentially missing ANSI keys:')).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await page.reload();
	await page.getByRole('button', { name: 'Input layout: QWERTY', exact: true }).click();
	await expect(geometry).toHaveValue('ortho');
	await dialog.getByRole('combobox', { name: 'Base layout' }).fill('easy-harlot-iso');
	await dialog.getByRole('option', { name: 'easy-harlot-iso', exact: true }).click();
	await expect(geometry).toHaveValue('ortho');
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(
		page.getByRole('button', { name: 'Input layout: easy-harlot-iso', exact: true })
	).toBeVisible();
	const field = page.getByPlaceholder('Layout test area');
	await field.press('b');
	await expect(field).toHaveValue('b');
});

test('QWERTY ISO defaults populate UK keys and persist without becoming Custom', async ({
	page
}) => {
	await page.goto('/layouts/easy-harlot-iso?tab=test');
	await page.getByRole('button', { name: 'Input layout: QWERTY (ANSI)', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Configure input layout' });
	await dialog
		.getByRole('combobox', { name: 'Keyboard topology', exact: true })
		.selectOption('iso');
	await expect(dialog.getByRole('textbox', { name: 'Row 3, key 1', exact: true })).toHaveValue(
		'\\'
	);
	await expect(dialog.locator('[data-keyboard-input-slot="0,12"]')).toHaveValue('#');
	await expect(dialog.getByText(/QWERTY uses UK defaults/)).toHaveCount(0);
	await expect(dialog.getByRole('button', { name: 'Save', exact: true })).toBeEnabled();
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(
		page.getByRole('button', { name: 'Input layout: QWERTY UK (ISO)', exact: true })
	).toBeVisible();
	await page.reload();
	const field = page.getByPlaceholder('Layout test area');
	await field.press('Backslash');
	await expect(field).toHaveValue('q');
	await page.getByRole('button', { name: 'Input layout: QWERTY UK (ISO)', exact: true }).click();
	await expect(dialog.getByRole('textbox', { name: 'Row 3, key 1', exact: true })).toHaveValue(
		'\\'
	);
});

test('pins independent UK and US presets and expands hardware controls above Base layout', async ({
	page
}) => {
	await page.goto('/layouts/easy-harlot-iso?tab=test');
	await page.getByRole('button', { name: 'Input layout: QWERTY (ANSI)', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Configure input layout' });
	const geometry = dialog.getByRole('combobox', { name: 'Keyboard geometry' });
	const topology = dialog.getByRole('combobox', { name: 'Keyboard topology', exact: true });
	const fit = dialog.getByRole('combobox', { name: 'ISO layouts on ANSI hardware' });
	const base = dialog.getByRole('combobox', { name: 'Base layout' });
	const initial = await Promise.all(
		[geometry, topology, fit, base].map((locator) => locator.boundingBox())
	);
	expect(initial.every(Boolean)).toBe(true);
	expect(Math.abs(initial[0]!.y - initial[1]!.y)).toBeLessThan(2);
	expect(Math.abs(initial[0]!.y - initial[2]!.y)).toBeLessThan(2);
	expect(initial[3]!.y).toBeGreaterThan(initial[0]!.y + initial[0]!.height);
	await topology.selectOption('iso');
	await expect(base).toHaveValue('QWERTY UK (ISO)');
	await expect(fit).toHaveCount(0);
	const expanded = await geometry.boundingBox();
	expect(expanded!.width).toBeGreaterThan(initial[0]!.width * 1.3);
	await dialog.getByRole('button', { name: 'Show layout options' }).click();
	await expect(dialog.getByRole('listbox').getByRole('option').nth(0)).toHaveText(
		'QWERTY UK (ISO)'
	);
	await expect(dialog.getByRole('listbox').getByRole('option').nth(1)).toHaveText('QWERTY');
	await dialog.getByRole('option', { name: 'QWERTY', exact: true }).click();
	await expect(base).toHaveValue('QWERTY');
	await expect(dialog.getByRole('textbox', { name: 'Row 3, key 1', exact: true })).toHaveValue('');
	await dialog.getByRole('button', { name: 'Show layout options' }).click();
	await expect(dialog.getByRole('listbox').getByRole('option').nth(0)).toHaveText(
		'QWERTY UK (ISO)'
	);
	await dialog.getByRole('option', { name: 'QWERTY UK (ISO)', exact: true }).click();
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(
		page.getByRole('button', { name: 'Input layout: QWERTY UK (ISO)', exact: true })
	).toBeVisible();
});
