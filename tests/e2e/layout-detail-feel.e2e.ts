import { expect, test } from './fixtures/test';

test.use({ catalogVariant: 'core' });

test('remaps a custom lesson onto the known layout and ignores wrong key presses', async ({
	page
}) => {
	await page.goto('/layouts/Colemak-DH?tab=feel&text=hello%20world');

	const feelPanel = page.getByRole('tabpanel', { name: 'Layout feel' });
	const feelInput = feelPanel.getByRole('textbox', { name: 'Layout feel input' });
	const sourceWords = feelPanel.getByLabel('Original words');
	const feelWords = feelPanel.getByLabel('Layout feel words');
	await expect(page).toHaveURL('/layouts/Colemak-DH?tab=feel&text=hello+world');
	await expect(feelInput).toBeFocused();
	await expect(sourceWords.locator('[data-source-word-role="active"]')).toHaveText('hello');
	await expect(sourceWords.locator('[data-source-word-role="next"]')).toHaveText('world');
	await expect(feelWords.locator('[data-practice-word]')).toHaveText(['mkuu;', 'w;suv']);
	await expect(feelPanel.getByRole('switch', { name: 'Ignore wrong key presses' })).toBeChecked();
	await expect(feelPanel.getByLabel('0 of 2 words complete')).toHaveText('0/2');

	await page.keyboard.type('mkx');
	await expect(feelInput).toHaveValue('mk');
	await expect(
		sourceWords.locator('[data-source-word-role="active"] .layout-feel-source-character--revealed')
	).toHaveText(['h', 'e']);

	await page.keyboard.type('uu;');
	await expect(feelInput).toHaveValue('mkuu;');
	await expect(
		feelWords.locator('[data-current-word="true"] [data-character-status="correct"]')
	).toHaveCount(5);
	await page.keyboard.press('Space');
	await expect(feelInput).toHaveValue('');
	await expect(feelPanel.getByLabel('1 of 2 words complete')).toHaveText('1/2');
	await expect(sourceWords.locator('[data-source-word-role="active"]')).toHaveText('world');
	await expect(sourceWords.locator('[data-source-word-role="next"]')).toHaveCount(0);
	await expect(feelWords.locator('[data-practice-word]')).toHaveText(['w;suv']);
});
