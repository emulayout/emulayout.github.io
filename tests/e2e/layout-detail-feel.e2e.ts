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

test('clears the timer and refills leftover words when switching practice and feel', async ({
	page
}) => {
	await page.goto('/layouts/QWERTY?tab=practice');

	const practicePanel = page.getByRole('tabpanel', { name: 'Typing practice' });
	const practiceInput = practicePanel.getByRole('textbox', { name: 'Typing practice input' });
	const practiceWords = practicePanel.locator('[data-practice-word]');
	await expect(practiceWords).toHaveCount(10);
	const initialWords = await practiceWords.allTextContents();
	const firstWord = initialWords[0]!;
	await practiceInput.press(firstWord[0]!);
	await expect
		.poll(async () => practicePanel.getByLabel(/^Elapsed time:/).getAttribute('aria-label'), {
			timeout: 2500
		})
		.not.toBe('Elapsed time: 00:00');
	for (const character of firstWord.slice(1)) {
		await practiceInput.press(character);
	}
	await practiceInput.press('Space');
	await expect(practicePanel.getByLabel('1 of 10 words complete')).toHaveText('1/10');

	await page.getByRole('tab', { name: 'Layout feel' }).click();
	const feelPanel = page.getByRole('tabpanel', { name: 'Layout feel' });
	const feelInput = feelPanel.getByRole('textbox', { name: 'Layout feel input' });
	const feelWords = feelPanel.getByLabel('Layout feel words').locator('[data-practice-word]');
	await expect(page).toHaveURL('/layouts/QWERTY?tab=feel');
	await expect(feelPanel.getByLabel('0 of 10 words complete')).toHaveText('0/10');
	await expect(feelPanel.getByLabel('Elapsed time: 00:00')).toHaveText('00:00');
	await expect(feelInput).toHaveValue('');
	await expect(feelWords).toHaveCount(10);
	const refilledWords = await feelWords.allTextContents();
	expect(refilledWords.slice(0, 9)).toEqual(initialWords.slice(1));
	expect(initialWords).not.toContain(refilledWords[9]);

	await page.getByRole('tab', { name: 'Typing practice' }).click();
	await expect(page).toHaveURL('/layouts/QWERTY?tab=practice');
	await expect(practiceWords).toHaveText(refilledWords);
	await expect(practiceInput).toHaveValue('');
	await expect(practicePanel.getByLabel('0 of 10 words complete')).toHaveText('0/10');
	await expect(practicePanel.getByLabel('Elapsed time: 00:00')).toHaveText('00:00');
});

test('keeps leftover custom-lesson words and clears input when switching tabs', async ({
	page
}) => {
	await page.goto('/layouts/Colemak-DH?tab=practice&text=hello%20world');

	const practicePanel = page.getByRole('tabpanel', { name: 'Typing practice' });
	const practiceInput = practicePanel.getByRole('textbox', { name: 'Typing practice input' });
	await expect(practicePanel.locator('[data-practice-word]')).toHaveText(['hello', 'world']);
	await practiceInput.press('m');
	await practiceInput.press('k');
	await practiceInput.press('u');
	await expect(practiceInput).toHaveValue('hel');

	await page.getByRole('tab', { name: 'Layout feel' }).click();
	const feelPanel = page.getByRole('tabpanel', { name: 'Layout feel' });
	const feelInput = feelPanel.getByRole('textbox', { name: 'Layout feel input' });
	await expect(page).toHaveURL('/layouts/Colemak-DH?tab=feel&text=hello+world');
	await expect(
		feelPanel.getByLabel('Original words').locator('[data-source-word-role="active"]')
	).toHaveText('hello');
	await expect(
		feelPanel.getByLabel('Layout feel words').locator('[data-practice-word]')
	).toHaveText(['mkuu;', 'w;suv']);
	await expect(feelInput).toHaveValue('');
	await expect(feelPanel.getByLabel('0 of 2 words complete')).toHaveText('0/2');
	await expect(feelPanel.getByLabel('Elapsed time: 00:00')).toHaveText('00:00');

	await page.getByRole('tab', { name: 'Typing practice' }).click();
	await expect(page).toHaveURL('/layouts/Colemak-DH?tab=practice&text=hello+world');
	await expect(practicePanel.locator('[data-practice-word]')).toHaveText(['hello', 'world']);
	await expect(practiceInput).toHaveValue('');
	await expect(practicePanel.getByLabel('0 of 2 words complete')).toHaveText('0/2');
	await expect(practicePanel.getByLabel('Elapsed time: 00:00')).toHaveText('00:00');
});
