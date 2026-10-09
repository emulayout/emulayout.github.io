import { decodeLayout } from '../../src/lib/layoutCodec';
import { vylet } from './fixtures/catalog-data';
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
	const remappingTab = dialog.getByRole('tab', { name: 'Special mappings', exact: true });
	await expect(remappingTab).toBeFocused();
	await expect(remappingTab).toHaveAttribute('aria-selected', 'true');
	await expect(dialog.getByRole('tabpanel', { name: 'Special mappings' })).toContainText(
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
			.getByRole('tab', { name: 'Special mappings', exact: true })
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

test('pending modal focus yields to keyboard tab navigation', async ({ page }) => {
	await page.goto('/create?text=hello');
	await page.evaluate(() => {
		const request = window.requestAnimationFrame.bind(window);
		const cancel = window.cancelAnimationFrame.bind(window);
		const pending = new Map<number, FrameRequestCallback>();
		let nextId = -1;
		let held = true;
		window.requestAnimationFrame = (callback) => {
			if (
				held &&
				/ModalShell\.svelte|focusFilterControl\.ts|TypingPracticeLessonModal\.svelte/.test(
					new Error().stack ?? ''
				)
			) {
				const id = nextId--;
				pending.set(id, callback);
				return id;
			}
			return request(callback);
		};
		window.cancelAnimationFrame = (id) => {
			if (id < 0) pending.delete(id);
			else cancel(id);
		};
		Object.assign(window, {
			pendingFocusFrames: () => pending.size,
			releaseFocusFrames: async () => {
				held = false;
				for (const callback of pending.values()) request(callback);
				pending.clear();
				await new Promise<void>((resolve) => request(() => request(() => resolve())));
			}
		});
	});
	await page.getByRole('button', { name: 'Practice lesson settings' }).click();
	const dialog = page.getByRole('dialog', { name: 'Practice lesson', exact: true });
	await expect
		.poll(() =>
			page.evaluate(() =>
				(window as unknown as { pendingFocusFrames: () => number }).pendingFocusFrames()
			)
		)
		.toBeGreaterThan(0);
	await dialog.getByRole('textbox', { name: 'Practice text' }).fill('changed draft');
	const source = dialog.getByRole('tab', { name: 'Test source', exact: true });
	await source.focus();
	await source.press('ArrowRight');
	const remappings = dialog.getByRole('tab', { name: 'Special mappings', exact: true });
	await expect(remappings).toBeFocused();
	await page.evaluate(() =>
		(window as unknown as { releaseFocusFrames: () => Promise<void> }).releaseFocusFrames()
	);
	await expect(remappings).toBeFocused();
	await expect(remappings).toHaveAttribute('aria-selected', 'true');
	await source.click();
	await expect(dialog.getByRole('textbox', { name: 'Practice text' })).toHaveValue('changed draft');
});

test('late catalog mappings do not reset an open lesson draft or its selected tab', async ({
	page
}) => {
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route('**/layout-supplemental.json', async (route) => {
		await gate;
		await route.fulfill({
			json: {
				vylet: {
					format: 'spark/1',
					layout: {
						keys: Object.entries(decodeLayout(vylet).keys).map(([char, key]) => ({
							char,
							row: key.row,
							col: key.col,
							finger: ['LP', 'LR', 'LM', 'LI', 'LI', 'RI', 'RI', 'RM', 'RR', 'RP'][key.col] ?? 'RP'
						})),
						magic: { magic_keys: [{ key: '*', rules: [{ after: 'c', emit: 'k' }] }] }
					}
				}
			}
		});
	});
	try {
		await page.route('**/languages/english1k.json', (route) =>
			route.fulfill({ json: { name: 'test', words: ['dog', 'back'] } })
		);
		await page.goto('/create?base=vylet&special=100');
		await page.getByRole('button', { name: 'Practice lesson settings' }).click();
		const dialog = page.getByRole('dialog', { name: 'Practice lesson', exact: true });
		await dialog.getByRole('radio', { name: 'Custom text' }).check();
		await dialog.getByRole('textbox', { name: 'Practice text' }).fill('keep this draft');
		const remappings = dialog.getByRole('tab', { name: 'Special mappings', exact: true });
		await remappings.click();
		release();
		await expect(
			page.getByRole('region', { name: 'Magic key mappings', exact: true })
		).toBeVisible();
		await expect(remappings).toHaveAttribute('aria-selected', 'true');
		await expect(remappings).toBeFocused();
		await dialog.getByRole('tab', { name: 'Test source', exact: true }).click();
		await expect(dialog.getByRole('radio', { name: 'Custom text' })).toBeChecked();
		await expect(dialog.getByRole('textbox', { name: 'Practice text' })).toHaveValue(
			'keep this draft'
		);
	} finally {
		release();
	}
});
