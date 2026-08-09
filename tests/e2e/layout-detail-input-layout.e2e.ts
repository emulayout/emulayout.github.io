import { expect, test } from './fixtures/test';
import { KEYBOARD_INPUT_CONFIG_STORAGE_KEY } from '../../src/lib/keyboardInputConfig';
import type { CompactLayout } from '../../src/lib/layoutCodec';
import { qwerty } from './fixtures/catalog-data';

test.use({ catalogVariant: 'core' });

const sparseIndexTarget: CompactLayout = [
	'sparse-index-target',
	qwerty[1],
	2,
	'2026-08-09T00:00:00Z',
	2,
	['q', 'a', 'z', '.', 'l'],
	[0, 1, 2, 2, 2],
	[0, 0, 0, 2, 3]
];

test('uses slot-aware configured input mapping and exposes its control in the index header', async ({
	page
}) => {
	await page.route('**/all-layouts.json', async (route) => {
		await route.fulfill({ json: [sparseIndexTarget] });
	});
	await page.goto('/?name=sparse-index-target&likes=0&newIndicator=0');

	const testArea = page
		.locator('[data-layout-name="sparse-index-target"]')
		.getByPlaceholder('Layout test area');
	const inputLayoutButton = page.getByRole('button', { name: 'Input layout: QWERTY' });
	const settingsButton = page.getByRole('button', { name: 'Settings' });
	const allLayoutsTab = page.getByRole('tab', { name: 'All layouts' });
	await expect(inputLayoutButton).toBeVisible();
	await expect(settingsButton).toBeVisible();
	const inputLayoutButtonBox = await inputLayoutButton.boundingBox();
	const settingsButtonBox = await settingsButton.boundingBox();
	const allLayoutsTabBox = await allLayoutsTab.boundingBox();
	expect(inputLayoutButtonBox).not.toBeNull();
	expect(settingsButtonBox).not.toBeNull();
	expect(allLayoutsTabBox).not.toBeNull();
	expect(inputLayoutButtonBox!.x + inputLayoutButtonBox!.width).toBeLessThanOrEqual(
		settingsButtonBox!.x
	);
	expect(
		Math.abs(
			inputLayoutButtonBox!.y +
				inputLayoutButtonBox!.height / 2 -
				(allLayoutsTabBox!.y + allLayoutsTabBox!.height / 2)
		)
	).toBeLessThanOrEqual(1);
	await testArea.press('x');
	await expect(testArea).toHaveValue('');
	await testArea.press('c');
	await testArea.press('v');
	await expect(testArea).toHaveValue('.l');
	await inputLayoutButton.click();
	await expect(page.getByRole('dialog', { name: 'Configure input layout' })).toBeVisible();
	await page.keyboard.press('Escape');

	await page.setViewportSize({ width: 600, height: 900 });
	await expect(inputLayoutButton.locator('.keyboard-input-config-label')).toBeHidden();
	await inputLayoutButton.hover();
	await expect(page.getByRole('tooltip')).toHaveText('Input layout: QWERTY');
});

test.describe('typing-practice input layout', () => {
	test.use({ catalogVariant: 'full' });

	test('shows catalog loading inside the base-layout field without shifting the form', async ({
		page
	}) => {
		let releaseCatalog!: () => void;
		const catalogGate = new Promise<void>((resolve) => {
			releaseCatalog = resolve;
		});
		await page.route('**/all-layouts.json', async (route) => {
			await catalogGate;
			await route.fallback();
		});

		await page.goto('/layouts/QWERTY');
		await page.getByRole('button', { name: 'Input layout: QWERTY' }).click();
		const dialog = page.getByRole('dialog', { name: 'Configure input layout' });
		const baseLayout = dialog.getByRole('combobox', { name: 'Base layout' });
		const fields = dialog.locator('.keyboard-input-config-fields');
		const loadingIndicator = dialog.locator('[data-layout-autocomplete-loading]');
		const loadingHeight = await fields.evaluate(
			(element) => element.getBoundingClientRect().height
		);
		await expect(baseLayout).toHaveAttribute('aria-busy', 'true');
		await expect(loadingIndicator).toBeVisible();
		await expect(loadingIndicator).toHaveAttribute('role', 'status');
		await expect(loadingIndicator).toContainText('Loading layouts…');
		await expect(dialog.locator('p').filter({ hasText: 'Loading layouts…' })).toHaveCount(0);
		const animationStart = await loadingIndicator.evaluate((element) => {
			const currentTime = element.getAnimations()[0]?.currentTime;
			return typeof currentTime === 'number' ? currentTime : 0;
		});
		await page.waitForTimeout(200);
		const animationEnd = await loadingIndicator.evaluate((element) => {
			const currentTime = element.getAnimations()[0]?.currentTime;
			return typeof currentTime === 'number' ? currentTime : 0;
		});
		expect(animationEnd).toBeGreaterThan(animationStart);

		releaseCatalog();
		await expect(baseLayout).toHaveAttribute('aria-busy', 'false');
		await expect(loadingIndicator).toHaveCount(0);
		const loadedHeight = await fields.evaluate((element) => element.getBoundingClientRect().height);
		expect(loadedHeight).toBeCloseTo(loadingHeight, 0);
	});

	test('configures, edits, applies, and restores a catalog-backed input layout', async ({
		page
	}) => {
		await page.goto('/layouts/QWERTY?text=e');
		const practicePanel = page.getByRole('tabpanel', { name: 'Typing practice' });
		const practiceInput = practicePanel.getByRole('textbox', { name: 'Typing practice input' });
		await expect(practicePanel.locator('[data-practice-word]')).toHaveText('e');

		const inputLayoutButton = practicePanel.getByRole('button', {
			name: 'Input layout: QWERTY'
		});
		await inputLayoutButton.click();
		const dialog = page.getByRole('dialog', { name: 'Configure input layout' });
		const baseLayout = dialog.getByRole('combobox', { name: 'Base layout' });
		const keyboardType = dialog.getByRole('combobox', { name: 'Keyboard type' });
		await expect(baseLayout).toHaveValue('QWERTY');
		await expect(baseLayout).toBeFocused();
		await expect(baseLayout).toHaveAttribute('aria-expanded', 'false');
		await expect(keyboardType).toHaveValue('staggered');
		await expect(dialog.locator('[data-keyboard-input-slot]')).toHaveCount(36);
		await expect(
			dialog.locator('[data-keyboard-input-row="3"] [data-keyboard-input-slot]')
		).toHaveCount(2);
		await expect(dialog.locator('[data-keyboard-input-slot="3,0"]')).toHaveValue('');
		await expect(dialog.locator('[data-keyboard-input-slot="3,1"]')).toHaveValue('');
		await expect(
			dialog.locator('[data-keyboard-input-row="1"] .keyboard-input-editor__key--home')
		).toHaveCount(8);
		await expect(
			dialog.locator('[data-keyboard-input-row="0"] .keyboard-input-editor__hand-gap')
		).toHaveCount(0);
		await dialog.getByRole('button', { name: 'Show layout options' }).click();
		await expect(baseLayout).toHaveAttribute('aria-expanded', 'true');
		await dialog.getByRole('button', { name: 'Hide layout options' }).click();
		await expect(baseLayout).toHaveAttribute('aria-expanded', 'false');
		await dialog.getByRole('button', { name: 'Clear selected layout' }).click();
		await expect(baseLayout).toHaveValue('');
		await expect(dialog.locator('[data-keyboard-input-slot="0,0"]')).toHaveValue('');
		await expect(dialog.locator('[data-keyboard-input-slot="0,0"]')).toHaveAttribute(
			'placeholder',
			'q'
		);
		await expect(dialog.getByRole('button', { name: 'Save' })).toBeEnabled();
		await dialog.getByRole('button', { name: 'Reset' }).click();
		await expect(baseLayout).toHaveValue('QWERTY');
		await expect(keyboardType).toHaveValue('staggered');
		await expect(dialog.locator('[data-keyboard-input-slot="0,0"]')).toHaveValue('q');
		await expect(dialog.locator('[data-keyboard-input-missing-ansi]')).toHaveCount(0);

		await baseLayout.fill('night');
		await expect(baseLayout).toHaveAttribute('aria-expanded', 'true');
		await dialog.getByRole('option', { name: 'night', exact: true }).click();
		await expect(baseLayout).toBeFocused();
		await expect(baseLayout).toHaveAttribute('aria-expanded', 'false');
		await expect(keyboardType).toHaveValue('ortho');
		await expect(
			dialog.locator('[data-keyboard-input-row="3"] [data-keyboard-input-slot]')
		).toHaveCount(2);
		await keyboardType.focus();
		await baseLayout.focus();
		await expect(baseLayout).toHaveAttribute('aria-expanded', 'true');
		await baseLayout.press('Escape');
		await expect(baseLayout).toBeFocused();
		await expect(baseLayout).toHaveAttribute('aria-expanded', 'false');

		await baseLayout.fill('Colemak-DH');
		await dialog.getByRole('option', { name: 'Colemak-DH', exact: true }).click();
		const omittedSymbolKey = dialog.locator('[data-keyboard-input-slot="0,10"]');
		await expect(omittedSymbolKey).toHaveValue('');
		await expect(omittedSymbolKey).toHaveAttribute('placeholder', '');
		await expect(omittedSymbolKey).toHaveAttribute('data-keyboard-input-inert', 'true');
		await expect(dialog.getByRole('button', { name: 'Save' })).toBeEnabled();
		const firstKey = dialog.getByRole('textbox', { name: 'Row 1, key 1', exact: true });
		const secondKey = dialog.getByRole('textbox', { name: 'Row 1, key 2', exact: true });
		await firstKey.focus();
		await firstKey.press('1');
		await expect(firstKey).toHaveValue('1');
		await expect(secondKey).toBeFocused();
		await secondKey.press('ArrowLeft');
		await expect(firstKey).toBeFocused();
		await firstKey.press('q');
		await expect(secondKey).toBeFocused();
		await firstKey.focus();
		await firstKey.press('w');
		await expect(firstKey).toHaveAttribute('aria-invalid', 'true');
		await expect(secondKey).toHaveAttribute('aria-invalid', 'true');
		await expect(dialog.getByText('Each key value must be unique.')).toBeVisible();
		await expect(dialog.locator('[data-keyboard-input-missing-ansi] kbd')).toHaveText([
			'q',
			'[',
			']',
			'\\'
		]);
		await expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled();
		await firstKey.focus();
		await firstKey.press('q');
		await expect(firstKey).not.toHaveAttribute('aria-invalid', 'true');
		await expect(secondKey).not.toHaveAttribute('aria-invalid', 'true');
		await expect(dialog.locator('[data-keyboard-input-missing-ansi] kbd')).toHaveText([
			'[',
			']',
			'\\'
		]);

		await dialog.locator('[data-keyboard-input-slot="0,12"]').press('ArrowRight');
		await expect(dialog.locator('[data-keyboard-input-slot="1,0"]')).toBeFocused();
		await dialog.locator('[data-keyboard-input-slot="0,2"]').press('ArrowDown');
		await expect(dialog.locator('[data-keyboard-input-slot="1,2"]')).toBeFocused();

		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(dialog).toHaveCount(0);
		await expect(practicePanel.getByRole('button', { name: 'Input layout: Custom' })).toBeVisible();
		expect(
			await page.evaluate((key) => localStorage.getItem(key), KEYBOARD_INPUT_CONFIG_STORAGE_KEY)
		).not.toBeNull();

		await practiceInput.press('f');
		await expect(practicePanel.getByText('Press esc to restart')).toBeVisible();
		await page.reload();
		await expect(
			page
				.getByRole('tabpanel', { name: 'Typing practice' })
				.getByRole('button', { name: 'Input layout: Custom' })
		).toBeVisible();
		await page
			.getByRole('tabpanel', { name: 'Typing practice' })
			.getByRole('textbox', { name: 'Typing practice input' })
			.press('f');
		await expect(page.getByText('Press esc to restart')).toBeVisible();

		await page.getByRole('tab', { name: 'Layout test area' }).click();
		const testPanel = page.getByRole('tabpanel', { name: 'Layout test area' });
		await expect(testPanel.getByRole('button', { name: 'Input layout: Custom' })).toBeVisible();
		const testInput = testPanel.getByRole('textbox', { name: 'Layout test area' });
		await testInput.press('f');
		await expect(testInput).toHaveValue('e');

		await page.goto('/?name=QWERTY&likes=0&newIndicator=0');
		const indexTestInput = page
			.locator('[data-layout-name="QWERTY"]')
			.getByPlaceholder('Layout test area');
		await indexTestInput.press('f');
		await expect(indexTestInput).toHaveValue('e');
		await expect(page.getByRole('button', { name: 'Input layout: Custom' })).toBeVisible();
	});

	test('switches between an assigned real thumb key and Space simulation', async ({ page }) => {
		await page.goto('/layouts/night?text=r');
		const practicePanel = page.getByRole('tabpanel', { name: 'Typing practice' });
		const practiceInput = practicePanel.getByRole('textbox', { name: 'Typing practice input' });
		await practicePanel.getByRole('button', { name: 'Input layout: QWERTY' }).click();

		const dialog = page.getByRole('dialog', { name: 'Configure input layout' });
		const leftThumb = dialog.locator('[data-keyboard-input-slot="3,0"]');
		const rightThumb = dialog.locator('[data-keyboard-input-slot="3,1"]');
		await expect(leftThumb).toHaveValue('');
		await expect(leftThumb).toHaveAttribute('placeholder', '');
		await expect(rightThumb).toHaveValue('');
		await expect(rightThumb).toHaveAttribute('placeholder', '');

		await leftThumb.press('1');
		await expect(leftThumb).toHaveValue('1');
		await dialog.getByRole('button', { name: 'Save' }).click();

		await practiceInput.press('1');
		await expect(practicePanel.getByText('Press esc to restart')).toBeVisible();
		await practiceInput.press('Escape');

		const simulateOption = practicePanel.locator('[data-simulate-thumb-keys-option]');
		const simulateThumbKeys = simulateOption.getByRole('switch', {
			name: 'Simulate thumb keys'
		});
		await expect(simulateThumbKeys).not.toBeChecked();
		const hint = simulateOption.getByRole('button', { name: 'Help' });
		await expect(hint).toBeVisible();
		await hint.hover();
		await expect(page.getByRole('tooltip')).toContainText(
			'When enabled, Space simulates whichever thumb key produces the next required character'
		);

		await simulateThumbKeys.check();
		await practiceInput.focus();
		await practiceInput.press('1');
		await expect(practiceInput).toHaveValue('1');
		await practiceInput.press('Backspace');
		await practiceInput.press('Space');
		await expect(practicePanel.getByText('Press esc to restart')).toBeVisible();
	});
});
