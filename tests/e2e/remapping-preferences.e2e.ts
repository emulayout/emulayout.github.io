import { expect, test } from './fixtures/test';

test('lesson tabs preserve drafts, support keyboard navigation, and cancel together', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/create?text=hello');
	const settings = page.getByRole('button', { name: 'Practice lesson settings' });
	const dialog = page.getByRole('dialog', { name: 'Practice lesson', exact: true });
	await settings.click();
	await dialog.getByRole('textbox', { name: 'Practice text' }).fill('changed draft');
	const sourceTab = dialog.getByRole('tab', { name: 'Test source', exact: true });
	await sourceTab.focus();
	await sourceTab.press('ArrowRight');
	const remappingTab = dialog.getByRole('tab', { name: 'Remappings', exact: true });
	await expect(remappingTab).toBeFocused();
	await expect(remappingTab).toHaveAttribute('aria-selected', 'true');
	await expect(dialog.getByRole('tabpanel', { name: 'Remappings' })).toContainText(
		'apply to random words'
	);
	await remappingTab.press('ArrowRight');
	await expect(dialog.getByRole('tab', { name: 'Test style', exact: true })).toBeFocused();
	await dialog.getByRole('radio', { name: 'Colemak Club' }).click();
	await sourceTab.click();
	await expect(dialog.getByRole('textbox', { name: 'Practice text' })).toHaveValue('changed draft');
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(settings).toBeFocused();
	await settings.click();
	await expect(sourceTab).toHaveAttribute('aria-selected', 'true');
	await expect(dialog.getByRole('textbox', { name: 'Practice text' })).toHaveValue('hello');
	await dialog.getByRole('tab', { name: 'Test style', exact: true }).click();
	await expect(dialog.getByRole('radio', { name: 'Monkeytype' })).toBeChecked();
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(dialog).toHaveCount(0);
});

test('saves relative preferences and keeps URL overrides temporary across practice surfaces', async ({
	page
}) => {
	const chiral = `v1:${Buffer.from(JSON.stringify([{ key: '/', sameKind: 'char', sameChar: 'e', oppositeKind: 'char', oppositeChar: 'i', except: 'm' }])).toString('base64url')}`;
	const params = new URLSearchParams({ chiral, special: '100' });
	await page.route('**/languages/english1k.json', (route) =>
		route.fulfill({ json: { name: 'test', words: ['ai', 'he', 'rest', 'cost'] } })
	);
	await page.goto(`/create?${params}`);
	const openSettings = async () => {
		await page.getByRole('button', { name: /^(Practice|Layout feel) lesson settings$/ }).click();
		await page
			.getByRole('dialog', { name: 'Practice lesson', exact: true })
			.getByRole('tab', { name: 'Remappings', exact: true })
			.click();
	};
	const dialog = page.getByRole('dialog', { name: 'Practice lesson', exact: true });
	await openSettings();
	await dialog.getByRole('button', { name: 'Adjust by type' }).click();
	await dialog.getByRole('slider', { name: 'Magic preference' }).fill('0');
	await dialog.getByRole('slider', { name: 'Adaptive preference' }).fill('50');
	await expect(
		dialog.getByText('No matching Adaptive words; this preference is skipped.')
	).toBeVisible();
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect.poll(() => new URL(page.url()).searchParams.get('remap')).toBe('0,50,100');
	const stored = await page.evaluate(() => localStorage.getItem('typingPracticeLessonSettings'));
	expect(JSON.parse(stored!).settings.remappingPreferences).toEqual({
		split: true,
		magic: 0,
		adaptive: 50,
		chiral: 100
	});
	await expect(page.locator('[data-practice-word]')).toHaveCount(10);
	expect(
		(await page.locator('[data-practice-word]').allTextContents()).every(
			(word) => word === 'ai' || word === 'he'
		)
	).toBe(true);
	await page.reload();
	await openSettings();
	await expect(dialog.getByRole('slider', { name: 'Adaptive preference' })).toHaveValue('50');
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await page.getByRole('tab', { name: 'Layout feel', exact: true }).click();
	await openSettings();
	await expect(dialog.getByRole('slider', { name: 'Chiral preference' })).toHaveValue('100');
	await dialog.getByRole('button', { name: 'Cancel' }).click();

	params.set('remap', '100,0,0');
	await page.goto(`/create?${params}`);
	await openSettings();
	await expect(dialog.getByRole('slider', { name: 'Magic preference' })).toHaveValue('100');
	expect(await page.evaluate(() => localStorage.getItem('typingPracticeLessonSettings'))).toBe(
		stored
	);
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	params.delete('remap');
	await page.goto(`/create?${params}`);
	await openSettings();
	await expect(dialog.getByRole('slider', { name: 'Magic preference' })).toHaveValue('0');
	await dialog.getByRole('button', { name: 'Use combined selection' }).click();
	await dialog.getByRole('button', { name: 'Save', exact: true }).click();
	await expect.poll(() => new URL(page.url()).searchParams.get('remap')).toBe('off,0,50,100');
	await page.reload();
	await openSettings();
	await expect(dialog.getByRole('button', { name: 'Adjust by type' })).toHaveAttribute(
		'aria-expanded',
		'false'
	);
	await dialog.getByRole('button', { name: 'Adjust by type' }).click();
	await expect(dialog.getByRole('slider', { name: 'Adaptive preference' })).toHaveValue('50');
	await dialog.getByRole('slider', { name: 'Adaptive preference' }).fill('0');
	await dialog.getByRole('slider', { name: 'Chiral preference' }).fill('0');
	await expect(dialog.getByRole('status')).toContainText('All preferences are off');
});
