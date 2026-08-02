import { expect, test } from './fixtures/test';
import { validateLayoutSupplemental } from '../../src/lib/layoutSupplemental';
import {
	combinedInputBehaviors,
	magicSturdy,
	qwerty,
	repeatKey,
	vylet
} from './fixtures/catalog-data';

const mappedLayoutName = vylet[0];
const mappedLayoutView = `/?name=${encodeURIComponent(mappedLayoutName)}&likes=0&newIndicator=0`;

test('shows mappings in a floating window', async ({ page }) => {
	await page.goto(mappedLayoutView);

	const card = page.locator(`[data-layout-name="${mappedLayoutName}"]`);
	const keyboardRow = card.locator('.layout-keyboard-row');
	const indicatorRail = keyboardRow.locator('.input-mappings-indicators');
	const mappingsToggle = indicatorRail.locator('button[data-input-feature="magic"]');
	await expect(indicatorRail).toHaveCSS('flex-direction', 'column');
	await expect(mappingsToggle).toHaveAccessibleName('Show magic key mappings');
	await expect(mappingsToggle).toHaveCSS('width', '32px');
	await expect(mappingsToggle).toHaveCSS('height', '32px');
	await mappingsToggle.click();
	await expect(mappingsToggle).toHaveAttribute('aria-pressed', 'true');
	await expect(mappingsToggle).toHaveAccessibleName('Close magic key mappings');

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

	await mappingsWindow.getByRole('button', { name: 'Close magic key mappings' }).click();
	await card.getByRole('button', { name: 'Expand layout' }).click();
	const expandedLayout = page.getByRole('dialog', { name: mappedLayoutName, exact: true });
	const expandedMagicStatus = expandedLayout.locator('[data-input-feature="magic"]');
	await expect(expandedMagicStatus).toHaveAttribute('role', 'img');
	await expect(expandedMagicStatus).toHaveAccessibleName('Magic key mappings enabled');
	await expect(expandedLayout.getByRole('button', { name: 'Show magic key mappings' })).toHaveCount(
		0
	);
});

test('shows a toggle for an emitting fallback and a plain note for a no-op', async ({ page }) => {
	await page.route('**/layout-supplemental.json', async (route) => {
		await route.fulfill({
			json: {
				[mappedLayoutName]: validateLayoutSupplemental({
					schema: 1,
					magicKeys: {
						mappings: {
							'*': { rules: { c: 'k' }, fallback: { emit: 'the' } },
							'#': { rules: { c: 'v' }, fallback: 'no-op' }
						}
					}
				})
			}
		});
	});
	await page.goto(mappedLayoutView);

	const card = page.locator(`[data-layout-name="${mappedLayoutName}"]`);
	await card.locator('button[data-input-feature="magic"]').click();
	const mappingsWindow = page.getByRole('dialog', {
		name: `${mappedLayoutName} magic key mappings`
	});

	const emitRow = mappingsWindow.getByRole('checkbox', { name: 'otherwise * the' });
	await expect(emitRow).toBeChecked();
	await emitRow.uncheck();
	await expect(emitRow).not.toBeChecked();

	// A no-op emits nothing, so it is described rather than made toggleable.
	await expect(mappingsWindow.getByText(/otherwise\s*#\s*→\s*nothing/)).toBeVisible();
	await expect(mappingsWindow.getByRole('checkbox', { name: /otherwise #/ })).toHaveCount(0);
});

test('keeps the mappings indicator noninteractive when the sidecar is unavailable', async ({
	page
}) => {
	await page.route('**/layout-supplemental.json', async (route) => {
		await route.fulfill({ json: {} });
	});
	await page.goto(mappedLayoutView);

	const card = page.locator(`[data-layout-name="${mappedLayoutName}"]`);
	const unavailableMagic = card.getByLabel('Magic key "*" mappings unavailable');
	await expect(unavailableMagic).toBeVisible();
	await expect(unavailableMagic).toHaveCSS('width', '32px');
	await expect(unavailableMagic).toHaveCSS('height', '32px');
	await expect(card.getByRole('button', { name: 'Show magic key mappings' })).toHaveCount(0);
});

test('toggles default @ repeat behavior directly from its lightweight icon', async ({ page }) => {
	await page.route('**/all-layouts.json', async (route) => {
		await route.fulfill({ json: [repeatKey] });
	});
	await page.goto(`/?name=${encodeURIComponent(repeatKey[0])}&likes=0&newIndicator=0`);

	const card = page.locator(`[data-layout-name="${repeatKey[0]}"]`);
	const repeatToggle = card.locator('button[data-input-feature="repeat"]');
	const repeatGlyph = repeatToggle.locator('.input-feature-control__glyph');
	await expect(repeatToggle).toBeVisible();
	await expect(repeatToggle).toHaveAccessibleName('Disable repeat key');
	await expect(repeatToggle).toHaveAttribute('aria-pressed', 'true');
	await expect(repeatToggle).toHaveCSS('width', '32px');
	await expect(repeatToggle).toHaveCSS('height', '32px');
	await expect(repeatToggle).toHaveCSS('border-top-width', '0px');
	await expect(repeatToggle).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await expect(page.getByRole('dialog')).toHaveCount(0);

	await repeatToggle.click();
	await expect(repeatToggle).toHaveAccessibleName('Enable repeat key');
	await expect(repeatToggle).toHaveAttribute('aria-pressed', 'false');
	await expect(repeatToggle).toHaveAttribute('data-feature-state', 'off');
	expect(
		await repeatGlyph.evaluate((element) => getComputedStyle(element, '::after').content)
	).toBe('""');
	const repeatOffColors = await repeatGlyph.evaluate((element) => {
		const probe = document.createElement('span');
		document.body.append(probe);
		probe.style.color = 'var(--text-secondary)';
		const secondary = getComputedStyle(probe).color;
		probe.style.color = 'var(--text-primary)';
		const primary = getComputedStyle(probe).color;
		probe.remove();
		const svg = element.querySelector('svg');
		return {
			icon: svg ? getComputedStyle(svg).color : '',
			strike: getComputedStyle(element, '::after').backgroundColor,
			secondary,
			primary
		};
	});
	expect(repeatOffColors.icon).toBe(repeatOffColors.secondary);
	expect(repeatOffColors.strike).toBe(repeatOffColors.primary);

	const textarea = card.getByPlaceholder('Layout test area');
	await textarea.focus();
	await page.keyboard.press('a');
	await page.keyboard.press('/');
	await page.keyboard.press('/');
	await expect(textarea).toHaveValue('a@@');

	await repeatToggle.click();
	await expect(repeatToggle).toHaveAccessibleName('Disable repeat key');
	await textarea.focus();
	await page.keyboard.press('Escape');
	await page.keyboard.press('a');
	await page.keyboard.press('/');
	await page.keyboard.press('/');
	await expect(textarea).toHaveValue('aaa');
	await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('uses one hover and off-state treatment for Repeat, Adaptive, and Magic', async ({ page }) => {
	await page.route('**/all-layouts.json', async (route) => {
		await route.fulfill({ json: [combinedInputBehaviors] });
	});
	await page.route('**/layout-supplemental.json', async (route) => {
		await route.fulfill({
			json: {
				[combinedInputBehaviors[0]]: validateLayoutSupplemental({
					schema: 1,
					magicKeys: { mappings: { '#': { v: 'm' } } },
					adaptiveSwaps: { mappings: { v: { m: 'l' } } }
				})
			}
		});
	});
	await page.goto(`/?name=${encodeURIComponent(combinedInputBehaviors[0])}&likes=0&newIndicator=0`);

	const card = page.locator(`[data-layout-name="${combinedInputBehaviors[0]}"]`);
	const repeatToggle = card.locator('button[data-input-feature="repeat"]');
	const repeatGlyph = repeatToggle.locator('.input-feature-control__glyph');
	const adaptiveToggle = card.locator('button[data-input-feature="adaptive"]');
	const adaptiveIcon = adaptiveToggle.locator('.input-feature-control__glyph');
	const magicToggle = card.locator('button[data-input-feature="magic"]');
	const magicIcon = magicToggle.locator('.input-feature-control__glyph');
	await expect(card.locator('[data-input-feature="magic"]')).toHaveCount(1);
	await expect(adaptiveToggle).toHaveCSS('border-top-width', '0px');
	await expect(adaptiveToggle).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await expect(adaptiveToggle).toHaveAttribute('data-feature-state', 'on');
	const hoverStyles: { color: string; opacity: string; background: string; border: string }[] = [];
	for (const control of [repeatToggle, adaptiveToggle, magicToggle]) {
		await control.hover();
		await expect(control).toHaveCSS('opacity', '1');
		hoverStyles.push(
			await control.evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					color: style.color,
					opacity: style.opacity,
					background: style.backgroundColor,
					border: style.borderTopWidth
				};
			})
		);
	}
	expect(hoverStyles[1]).toEqual(hoverStyles[0]);
	expect(hoverStyles[2]).toEqual(hoverStyles[0]);

	await adaptiveToggle.click();
	const mappingsWindow = page.getByRole('dialog', {
		name: `${combinedInputBehaviors[0]} input mappings`
	});
	await mappingsWindow.getByRole('checkbox', { name: 'Adaptive swap mappings' }).uncheck();
	await mappingsWindow.getByRole('checkbox', { name: 'Magic key mappings' }).uncheck();

	await expect(adaptiveToggle).toHaveAttribute('data-feature-state', 'off');
	await expect(magicToggle).toHaveAttribute('data-feature-state', 'off');
	await mappingsWindow.getByRole('button', { name: 'Close input mappings' }).click();
	await expect(adaptiveToggle).toHaveAttribute('aria-pressed', 'false');
	await expect(magicToggle).toHaveAttribute('aria-pressed', 'false');
	await repeatToggle.click();
	await page.mouse.move(0, 0);
	await expect
		.poll(async () => {
			const colors = await Promise.all(
				[repeatToggle, adaptiveToggle, magicToggle].map((control) =>
					control.evaluate((element) => getComputedStyle(element).color)
				)
			);
			return new Set(colors).size;
		})
		.toBe(1);
	const offStyles: {
		glyphColor: string;
		strikeColor: string;
		strikeTransform: string;
	}[] = [];
	for (const glyph of [repeatGlyph, adaptiveIcon, magicIcon]) {
		offStyles.push(
			await glyph.evaluate((element) => {
				const strike = getComputedStyle(element, '::after');
				const svg = element.querySelector('svg');
				return {
					glyphColor: svg ? getComputedStyle(svg).color : '',
					strikeColor: strike.backgroundColor,
					strikeTransform: strike.transform
				};
			})
		);
	}
	expect(offStyles[1]).toEqual(offStyles[0]);
	expect(offStyles[2]).toEqual(offStyles[0]);
	expect(offStyles[0]).toMatchObject({
		strikeTransform: expect.stringMatching(/^matrix\(0\.707107, 0\.707107,/)
	});
	expect(offStyles[0].glyphColor).not.toBe(offStyles[0].strikeColor);
});

test('uses uniform no-data styling for unavailable Magic and Adaptive mappings', async ({
	page
}) => {
	await page.route('**/all-layouts.json', async (route) => {
		await route.fulfill({ json: [combinedInputBehaviors] });
	});
	await page.route('**/layout-supplemental.json', async (route) => {
		await route.fulfill({ json: {} });
	});
	await page.goto(`/?name=${encodeURIComponent(combinedInputBehaviors[0])}&likes=0&newIndicator=0`);

	const unavailable = page
		.locator(`[data-layout-name="${combinedInputBehaviors[0]}"]`)
		.locator('[data-feature-state="unavailable"]');
	await expect(unavailable).toHaveCount(2);
	const firstStyle = await unavailable.nth(0).evaluate((element) => {
		const style = getComputedStyle(element);
		return { color: style.color, opacity: style.opacity };
	});
	const secondStyle = await unavailable.nth(1).evaluate((element) => {
		const style = getComputedStyle(element);
		return { color: style.color, opacity: style.opacity };
	});
	expect(secondStyle).toEqual(firstStyle);
});

test('filters Repeat keys independently from Magic keys', async ({ page }) => {
	await page.route('**/all-layouts.json', async (route) => {
		await route.fulfill({ json: [qwerty, repeatKey, vylet] });
	});
	await page.goto('/?likes=0&newIndicator=0');

	await page.getByRole('button', { name: 'Keyboard filters', exact: true }).click();
	const keyboardFilters = page.getByRole('region', { name: 'Keyboard filters' });
	await keyboardFilters.getByLabel('Repeat key').selectOption('required');

	await expect(page.locator('#results-status')).toContainText('Showing 1 layout');
	await expect(page.getByRole('heading', { name: repeatKey[0], exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: mappedLayoutName, exact: true })).toHaveCount(0);
	await expect(page).toHaveURL(/(?:\?|&)repeatKey=required(?:&|$)/);
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
	const mappingsToggle = card
		.locator('.layout-keyboard-row .input-mappings-indicators')
		.locator('button[data-input-feature="magic"]');
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
