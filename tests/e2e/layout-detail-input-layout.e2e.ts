import { expect, test } from './fixtures/test';
import { KEYBOARD_INPUT_CONFIG_STORAGE_KEY } from '../../src/lib/keyboardInputConfig';

test.use({ catalogVariant: 'core' });

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
		await expect(
			practicePanel.getByRole('button', { name: 'Input layout: Colemak-DH' })
		).toBeVisible();
		expect(
			await page.evaluate((key) => localStorage.getItem(key), KEYBOARD_INPUT_CONFIG_STORAGE_KEY)
		).not.toBeNull();

		await practiceInput.press('f');
		await expect(practicePanel.getByText('Press esc to restart')).toBeVisible();
		await page.reload();
		await expect(
			page
				.getByRole('tabpanel', { name: 'Typing practice' })
				.getByRole('button', { name: 'Input layout: Colemak-DH' })
		).toBeVisible();
		await page
			.getByRole('tabpanel', { name: 'Typing practice' })
			.getByRole('textbox', { name: 'Typing practice input' })
			.press('f');
		await expect(page.getByText('Press esc to restart')).toBeVisible();

		await page.getByRole('tab', { name: 'Layout test area' }).click();
		const testPanel = page.getByRole('tabpanel', { name: 'Layout test area' });
		await expect(testPanel.getByRole('button', { name: 'Input layout: Colemak-DH' })).toBeVisible();
		const testInput = testPanel.getByRole('textbox', { name: 'Layout test area' });
		await testInput.press('f');
		await expect(testInput).toHaveValue('e');
	});
});
