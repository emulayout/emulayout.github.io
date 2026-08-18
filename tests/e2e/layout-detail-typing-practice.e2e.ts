import { expect, test } from './fixtures/test';
import { LAYOUT_DETAIL_VERSION } from '../../src/lib/layoutDetails';
import { TYPING_PRACTICE_DISPLAY_OPTIONS_STORAGE_KEY } from '../../src/lib/typingPracticePrefs';
import { adaptivePreview, repeatKey, vylet } from './fixtures/catalog-data';

test.use({ catalogVariant: 'core' });

test('focuses typing practice and Escape starts a different lesson', async ({ page }) => {
	await page.goto('/layouts/QWERTY');

	const practicePanel = page.getByRole('tabpanel', { name: 'Typing practice' });
	const practiceInput = practicePanel.getByRole('textbox', { name: 'Typing practice input' });
	const practiceWords = practicePanel.locator('[data-practice-word]');
	await expect(practicePanel.getByRole('radiogroup', { name: 'Typing mode' })).toHaveCount(0);
	await expect(practicePanel.getByRole('textbox', { name: 'Type freely' })).toHaveCount(0);
	await expect(practiceWords).toHaveCount(10);
	await expect(practiceInput).toBeFocused();
	await expect(practiceInput).toHaveAttribute('type', 'text');
	await expect(practicePanel.locator('.layout-test-area')).toHaveCSS('height', '72px');
	const initialWords = await practiceWords.allTextContents();
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.evaluate(() => navigator.clipboard.writeText('blocked paste'));
	await practiceInput.press('ControlOrMeta+V');
	await expect(practiceInput).toHaveValue('');
	await practiceInput.press('Enter');
	await expect(practiceInput).toHaveValue('');
	await expect(practicePanel.getByLabel('Elapsed time: 00:00')).toHaveText('00:00');

	await page.keyboard.type(initialWords[0]![0]!);
	await expect
		.poll(async () => practicePanel.getByLabel(/^Elapsed time:/).getAttribute('aria-label'), {
			timeout: 2500
		})
		.not.toBe('Elapsed time: 00:00');

	await page.keyboard.press('Escape');
	await expect(practiceInput).toBeFocused();
	await expect(practiceInput).toHaveValue('');
	await expect(practicePanel.getByLabel('0 of 10 words complete')).toHaveText('0/10');
	await expect(practicePanel.getByLabel('Elapsed time: 00:00')).toHaveText('00:00');
	await expect(practicePanel.getByLabel('Typing practice results')).toHaveCount(0);
	await expect(practiceWords).toHaveCount(10);
	const replacementWords = await practiceWords.allTextContents();
	expect(replacementWords.some((word) => initialWords.includes(word))).toBe(false);
});

test('uses URL-backed custom practice text until it is cleared', async ({ page }) => {
	const wordPoolRequests: string[] = [];
	page.on('request', (request) => {
		if (new URL(request.url()).pathname === '/languages/english1k.json') {
			wordPoolRequests.push(request.url());
		}
	});

	await page.goto('/layouts/QWERTY?text=hello%20hello%20world');
	const practicePanel = page.getByRole('tabpanel', { name: 'Typing practice' });
	const practiceInput = practicePanel.getByRole('textbox', { name: 'Typing practice input' });
	const practiceWords = practicePanel.locator('[data-practice-word]');
	await expect(practiceWords).toHaveCount(3);
	await expect(page).toHaveURL('/layouts/QWERTY?tab=practice&text=hello+hello+world');
	await expect(practiceWords).toHaveText(['hello', 'hello', 'world']);
	expect(wordPoolRequests).toHaveLength(0);
	const settingsButton = practicePanel.getByRole('button', { name: 'Practice lesson settings' });
	await expect(settingsButton).toBeVisible();

	await practiceInput.press('h');
	await page.keyboard.press('Escape');
	await expect(practiceWords).toHaveText(['hello', 'hello', 'world']);
	await expect(practiceInput).toHaveValue('');
	await expect(practicePanel.getByLabel('0 of 3 words complete')).toHaveText('0/3');
	await expect(page).toHaveURL('/layouts/QWERTY?tab=practice&text=hello+hello+world');

	await page.getByRole('tab', { name: 'Stats' }).click();
	await expect(page).toHaveURL('/layouts/QWERTY?tab=stats&text=hello+hello+world');
	await page.getByRole('tab', { name: 'Typing practice' }).click();
	await expect(page).toHaveURL('/layouts/QWERTY?tab=practice&text=hello+hello+world');

	await settingsButton.click();
	const dialog = page.getByRole('dialog', { name: 'Practice lesson' });
	await dialog.getByRole('button', { name: 'Reset' }).click();
	await expect(dialog).toHaveCount(0);
	await expect(page).toHaveURL('/layouts/QWERTY?tab=practice');
	await expect(practiceWords).toHaveCount(10);

	const randomWords = await practiceWords.allTextContents();
	await settingsButton.click();
	await expect(dialog.getByRole('radio', { name: 'Random words' })).toBeChecked();
	await expect(dialog.getByRole('button', { name: 'Reset' })).toBeDisabled();
	await dialog.getByRole('radio', { name: 'Custom text' }).check();
	const customTextField = dialog.getByRole('textbox', { name: 'Practice text' });
	await expect(customTextField).toHaveValue(randomWords.join(' '));
	await expect(customTextField).toBeFocused();
	await expect
		.poll(() =>
			customTextField.evaluate((field: HTMLTextAreaElement) => ({
				start: field.selectionStart,
				end: field.selectionEnd,
				length: field.value.length
			}))
		)
		.toEqual({ start: 0, end: randomWords.join(' ').length, length: randomWords.join(' ').length });
	await customTextField.fill('custom text source');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL('/layouts/QWERTY?tab=practice&text=custom+text+source');
	await expect(practiceWords).toHaveText(['custom', 'text', 'source']);
	await expect(dialog).toHaveCount(0);
});

test('balances random lessons toward words matching the active special keys', async ({ page }) => {
	await page.route('**/layout-details/*.json', async (route) => {
		await route.fulfill({
			json: {
				version: LAYOUT_DETAIL_VERSION,
				layout: vylet,
				authorName: 'acas',
				likeCount: 0,
				supplemental: {
					schema: 1,
					variants: [{ id: 'default', magicKeys: { mappings: { '*': { c: 'k' } } } }]
				},
				stats: {}
			}
		});
	});
	await page.route('**/languages/english1k.json', async (route) => {
		await route.fulfill({
			json: {
				name: 'special-words-test',
				words: [
					'luck',
					'sick',
					'rock',
					'kick',
					'deck',
					'dock',
					'cost',
					'rest',
					'mind',
					'gold',
					'tree',
					'fish'
				]
			}
		});
	});
	await page.goto('/layouts/vylet?special=100');

	const practicePanel = page.getByRole('tabpanel', { name: 'Typing practice' });
	const practiceWords = practicePanel.locator('[data-practice-word]');
	await expect(page).toHaveURL('/layouts/vylet?tab=practice&special=100');
	await expect(practiceWords).toHaveCount(10);
	expect((await practiceWords.allTextContents()).every((word) => word.includes('ck'))).toBe(true);

	const settingsButton = practicePanel.getByRole('button', { name: 'Practice lesson settings' });
	await settingsButton.click();
	const dialog = page.getByRole('dialog', { name: 'Practice lesson' });
	const balanceSlider = dialog.getByRole('slider', {
		name: 'Increase magic/adaptive key occurrences'
	});
	await expect(dialog.getByRole('radio', { name: 'Random words' })).toBeChecked();
	await expect(balanceSlider).toHaveValue('100');
	await expect(dialog.getByRole('button', { name: 'Reset' })).toBeEnabled();
	await expect(
		dialog.getByText('6 of 12 words match the active magic/adaptive keys.')
	).toBeVisible();

	await balanceSlider.fill('0');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL('/layouts/vylet?tab=practice');
	await expect(dialog).toHaveCount(0);

	await settingsButton.click();
	await expect(dialog.getByRole('button', { name: 'Reset' })).toBeDisabled();
	await balanceSlider.fill('100');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(page).toHaveURL('/layouts/vylet?tab=practice&special=100');
	expect((await practiceWords.allTextContents()).every((word) => word.includes('ck'))).toBe(true);

	// Disabling the only Magic mapping empties the candidate set, so the
	// untouched lesson regenerates from ordinary random words.
	await practicePanel
		.locator('.layout-keyboard-workspace-mappings')
		.getByRole('checkbox', { name: 'Magic key mappings' })
		.uncheck();
	await expect
		.poll(async () => (await practiceWords.allTextContents()).some((word) => !word.includes('ck')))
		.toBe(true);
});

test('loads the word pool only after Typing practice opens', async ({ page }) => {
	const wordPoolRequests: string[] = [];
	let releaseWordPool!: () => void;
	const wordPoolGate = new Promise<void>((resolve) => {
		releaseWordPool = resolve;
	});
	await page.route('**/languages/english1k.json', async (route) => {
		await wordPoolGate;
		await route.continue();
	});
	page.on('request', (request) => {
		if (new URL(request.url()).pathname === '/languages/english1k.json') {
			wordPoolRequests.push(request.url());
		}
	});

	await page.goto('/layouts/QWERTY?tab=stats');
	await expect(page.getByRole('tabpanel', { name: 'Stats' })).toBeVisible();
	expect(wordPoolRequests).toHaveLength(0);

	await page.getByRole('tab', { name: 'Typing practice' }).click();
	const loadingMessage = page.getByText('Loading...', { exact: true });
	await expect(loadingMessage).toBeVisible();
	await expect(loadingMessage).toHaveCSS('font-size', '40px');
	await expect(loadingMessage).toHaveCSS('font-weight', '600');
	await expect(loadingMessage).toHaveCSS('line-height', '48px');
	releaseWordPool();
	await expect(
		page.getByRole('tabpanel', { name: 'Typing practice' }).locator('[data-practice-word]')
	).toHaveCount(10);
	expect(wordPoolRequests).toHaveLength(1);
});

test('offers responsive next-key and home-key keyboard guidance', async ({ page }) => {
	await page.goto('/layouts/QWERTY');

	const practicePanel = page.getByRole('tabpanel', { name: 'Typing practice' });
	const practiceWords = practicePanel.locator('[data-practice-word]');
	await expect(practiceWords).toHaveCount(10);
	const targetWord = (await practiceWords.first().textContent())!;
	const nextCharacter = Array.from(targetWord)[0]!;
	const keyboardPreview = practicePanel.getByRole('img', { name: 'QWERTY keyboard preview' });
	const keyboardMain = practicePanel.locator('.layout-keyboard-workspace-main');
	const keyboardCluster = practicePanel.locator('.layout-keyboard-workspace-cluster');
	const keyboardOptions = practicePanel.getByRole('group', { name: 'Keyboard options' });
	const inputLayoutControl = practicePanel.getByRole('button', { name: 'Input layout: QWERTY' });
	const nextKeyToggle = keyboardOptions.getByRole('switch', { name: 'Highlight next key' });
	const homeKeyToggle = keyboardOptions.getByRole('switch', { name: 'Color home keys' });
	await expect(keyboardOptions.getByRole('switch', { name: 'Show special keys' })).toHaveCount(0);
	await expect(nextKeyToggle).not.toBeChecked();
	await expect(homeKeyToggle).toBeChecked();
	await expect(keyboardPreview.locator('[data-key-next="true"]')).toHaveCount(0);

	await nextKeyToggle.check();
	const nextKey = keyboardPreview.locator(`[data-key-char="${nextCharacter}"]`);
	await expect(nextKey).toHaveAttribute('data-key-next', 'true');
	await expect(keyboardPreview.locator('[data-key-next="true"]')).toHaveCount(1);

	const wrongCharacter = nextCharacter === 'x' ? 'z' : 'x';
	await practicePanel.getByRole('textbox', { name: 'Typing practice input' }).press(wrongCharacter);
	await expect(keyboardPreview.locator('[data-key-next="true"]')).toHaveCount(0);
	await page.keyboard.press('Backspace');
	await expect(nextKey).toHaveAttribute('data-key-next', 'true');

	const homeRow = keyboardPreview.locator('[data-keyboard-row="1"]');
	await expect(homeRow.locator('[data-key-home="true"]')).toHaveCount(8);
	await expect(homeRow.locator('[data-key-char="g"]')).not.toHaveAttribute('data-key-home', 'true');
	await expect(homeRow.locator('[data-key-char="h"]')).not.toHaveAttribute('data-key-home', 'true');
	await expect(
		keyboardPreview.locator('[data-keyboard-row="0"] [data-key-home="true"]')
	).toHaveCount(0);

	await expect(keyboardOptions).toHaveCSS('display', 'grid');
	await expect(keyboardOptions).toHaveCSS('grid-auto-flow', 'row');
	const [wideMainBox, wideClusterBox, wideKeyboardBox, wideOptionsBox, wideInputLayoutBox] =
		await Promise.all([
			keyboardMain.boundingBox(),
			keyboardCluster.boundingBox(),
			keyboardPreview.boundingBox(),
			keyboardOptions.boundingBox(),
			inputLayoutControl.boundingBox()
		]);
	expect(wideMainBox).not.toBeNull();
	expect(wideClusterBox).not.toBeNull();
	expect(wideKeyboardBox).not.toBeNull();
	expect(wideOptionsBox).not.toBeNull();
	expect(wideInputLayoutBox).not.toBeNull();
	expect(wideClusterBox!.x + wideClusterBox!.width / 2).toBeCloseTo(
		wideMainBox!.x + wideMainBox!.width / 2,
		0
	);
	expect(wideOptionsBox!.x).toBeCloseTo(wideClusterBox!.x, 0);
	expect(wideOptionsBox!.y).toBeGreaterThanOrEqual(wideKeyboardBox!.y + wideKeyboardBox!.height);
	expect(wideInputLayoutBox!.x).toBeCloseTo(wideKeyboardBox!.x, 0);
	expect(wideInputLayoutBox!.y + wideInputLayoutBox!.height).toBeLessThanOrEqual(
		wideKeyboardBox!.y
	);
	const firstKeyboardKeyBox = await keyboardPreview
		.locator('[data-key-char]')
		.first()
		.boundingBox();
	expect(firstKeyboardKeyBox).not.toBeNull();
	expect(firstKeyboardKeyBox!.x).toBeCloseTo(wideKeyboardBox!.x, 0);

	await page.setViewportSize({ width: 700, height: 900 });
	const [narrowKeyboardBox, narrowOptionsBox] = await Promise.all([
		keyboardPreview.boundingBox(),
		keyboardOptions.boundingBox()
	]);
	expect(narrowKeyboardBox).not.toBeNull();
	expect(narrowOptionsBox).not.toBeNull();
	expect(narrowOptionsBox!.y).toBeGreaterThanOrEqual(
		narrowKeyboardBox!.y + narrowKeyboardBox!.height
	);
	expect(
		await page.evaluate(
			(key) => localStorage.getItem(key),
			TYPING_PRACTICE_DISPLAY_OPTIONS_STORAGE_KEY
		)
	).not.toBeNull();

	await page.goto('/layouts/Colemak-DH');
	const restoredOptions = page
		.getByRole('tabpanel', { name: 'Typing practice' })
		.getByRole('group', { name: 'Keyboard options' });
	await expect(restoredOptions.getByRole('switch', { name: 'Highlight next key' })).toBeChecked();
	await expect(restoredOptions.getByRole('switch', { name: 'Color home keys' })).toBeChecked();
});

test('composes next-key guidance with home-key styling', async ({ page }) => {
	await page.goto('/layouts/QWERTY?text=a');

	const practicePanel = page.getByRole('tabpanel', { name: 'Typing practice' });
	const keyboardPreview = practicePanel.getByRole('img', { name: 'QWERTY keyboard preview' });
	const aKey = keyboardPreview.locator('[data-key-char="a"]');
	await expect(aKey).toHaveAttribute('data-key-home', 'true');
	const homeStyle = await aKey.evaluate((element) => {
		const style = getComputedStyle(element);
		return {
			backgroundImage: style.backgroundImage,
			borderColor: style.borderColor,
			boxShadow: style.boxShadow
		};
	});

	await practicePanel.getByRole('switch', { name: 'Highlight next key' }).check();
	await expect(aKey).toHaveAttribute('data-key-next', 'true');
	await expect(aKey).toHaveCSS('outline-style', 'solid');
	expect(
		await aKey.evaluate((element) => {
			const style = getComputedStyle(element);
			return {
				backgroundImage: style.backgroundImage,
				borderColor: style.borderColor,
				boxShadow: style.boxShadow
			};
		})
	).toEqual(homeStyle);
});

test('places special mappings without clipping the typing-practice keyboard', async ({ page }) => {
	await page.setViewportSize({ width: 1600, height: 900 });
	await page.route('**/layout-details/*.json', async (route) => {
		await route.fulfill({
			json: {
				version: LAYOUT_DETAIL_VERSION,
				layout: adaptivePreview,
				authorName: 'acas',
				likeCount: 0,
				supplemental: {
					schema: 1,
					variants: [
						{
							id: 'default',
							adaptiveSwaps: { mappings: { l: { y: 'j', h: 'k' }, n: { y: 'r' } } }
						}
					]
				},
				stats: {}
			}
		});
	});
	await page.goto('/layouts/adaptive-preview?text=lj');

	const practicePanel = page.getByRole('tabpanel', { name: 'Typing practice' });
	const keyboardMain = practicePanel.locator('.layout-keyboard-workspace-main');
	const keyboardLayout = practicePanel.locator('.layout-keyboard-workspace');
	const keyboardCluster = practicePanel.locator('.layout-keyboard-workspace-cluster');
	const mappings = practicePanel.locator('.layout-keyboard-workspace-mappings');
	const keyboardPreview = practicePanel.getByRole('img', {
		name: 'adaptive-preview keyboard preview'
	});
	const keyboardOptions = practicePanel.getByRole('group', { name: 'Keyboard options' });
	const showSpecialKeys = keyboardOptions.getByRole('switch', { name: 'Show special keys' });
	const showAdaptiveSwaps = keyboardOptions.getByRole('switch', {
		name: 'Show adaptive swaps'
	});
	const onlyRelevantSwaps = keyboardOptions.getByRole('switch', {
		name: 'Only show relevant swaps'
	});
	const underlineAdaptiveGroup = keyboardOptions.getByRole('switch', {
		name: 'Underline adaptive group'
	});
	const showSwapPaths = keyboardOptions.getByRole('switch', { name: 'Show swap paths' });
	const practiceInput = practicePanel.getByRole('textbox', { name: 'Typing practice input' });
	const yKey = keyboardPreview.locator('[data-key-char="y"]');
	const jKey = keyboardPreview.locator('[data-key-char="j"]');
	const hKey = keyboardPreview.locator('[data-key-char="h"]');
	const kKey = keyboardPreview.locator('[data-key-char="k"]');
	const swapPath = keyboardPreview.locator('[data-swap-path="j:y"]');
	await expect(showSpecialKeys).toBeChecked();
	await expect(showAdaptiveSwaps).toBeChecked();
	await expect(onlyRelevantSwaps).not.toBeChecked();
	await expect(underlineAdaptiveGroup).not.toBeChecked();
	await expect(showSwapPaths).not.toBeChecked();
	await expect(mappings.getByRole('checkbox', { name: 'Adaptive swap mappings' })).toBeVisible();
	await expect(practicePanel.locator('[data-adaptive-group="true"]')).toHaveCount(0);

	await underlineAdaptiveGroup.check();
	await expect(
		practicePanel.locator('[data-practice-word]').first().locator('[data-adaptive-group="true"]')
	).toHaveText(['l', 'j']);

	await practiceInput.press('l');
	await expect(yKey).toHaveText('j');
	await expect(jKey).toHaveText('y');
	await expect(hKey).toHaveText('k');
	await expect(kKey).toHaveText('h');
	await page.keyboard.press('Escape');
	await onlyRelevantSwaps.check();
	await practiceInput.press('l');
	await expect(yKey).toHaveText('j');
	await expect(jKey).toHaveText('y');
	await expect(hKey).toHaveText('h');
	await expect(kKey).toHaveText('k');
	await page.keyboard.press('Escape');
	await showSwapPaths.check();
	await showAdaptiveSwaps.uncheck();
	await expect(onlyRelevantSwaps).toHaveCount(0);
	await expect(showSwapPaths).toHaveCount(0);
	await practiceInput.press('l');
	await expect(yKey).toHaveText('y');
	await expect(jKey).toHaveText('j');
	await page.keyboard.press('Escape');
	await showAdaptiveSwaps.check();
	await expect(onlyRelevantSwaps).toBeChecked();
	await expect(showSwapPaths).toBeVisible();
	await expect(showSwapPaths).toBeChecked();
	await practiceInput.press('l');
	await expect(swapPath).toHaveCount(1);
	await page.keyboard.press('Escape');

	await showSpecialKeys.uncheck();
	await expect(mappings).toHaveCount(0);
	await expect(keyboardPreview.locator('[data-key-feedback]')).toHaveCount(0);
	await showSpecialKeys.check();
	await expect(mappings).toBeVisible();
	const [wideKeyboardBox, wideLayoutBox, wideClusterBox, wideMappingsBox, wideKeyBox] =
		await Promise.all([
			keyboardMain.boundingBox(),
			keyboardLayout.boundingBox(),
			keyboardCluster.boundingBox(),
			mappings.boundingBox(),
			yKey.boundingBox()
		]);
	expect(wideKeyboardBox).not.toBeNull();
	expect(wideLayoutBox).not.toBeNull();
	expect(wideClusterBox).not.toBeNull();
	expect(wideMappingsBox).not.toBeNull();
	expect(wideKeyBox).not.toBeNull();
	expect(wideLayoutBox!.x + wideLayoutBox!.width / 2).toBeCloseTo(
		wideKeyboardBox!.x + wideKeyboardBox!.width / 2,
		0
	);
	expect(wideMappingsBox!.width).toBeLessThanOrEqual(315);
	expect(wideMappingsBox!.x).toBeGreaterThanOrEqual(wideClusterBox!.x + wideClusterBox!.width);

	await page.setViewportSize({ width: 1300, height: 900 });
	const [compactMainBox, compactLayoutBox, compactClusterBox, compactMappingsBox] =
		await Promise.all([
			keyboardMain.boundingBox(),
			keyboardLayout.boundingBox(),
			keyboardCluster.boundingBox(),
			mappings.boundingBox()
		]);
	expect(compactMainBox).not.toBeNull();
	expect(compactLayoutBox).not.toBeNull();
	expect(compactClusterBox).not.toBeNull();
	expect(compactMappingsBox).not.toBeNull();
	expect(compactLayoutBox!.x + compactLayoutBox!.width / 2).toBeCloseTo(
		compactMainBox!.x + compactMainBox!.width / 2,
		0
	);
	expect(compactMappingsBox!.x).toBeGreaterThanOrEqual(
		compactClusterBox!.x + compactClusterBox!.width
	);
	expect(compactMappingsBox!.width).toBeLessThanOrEqual(224);
	const compactKeyBox = await yKey.boundingBox();
	expect(compactKeyBox).not.toBeNull();
	expect(compactKeyBox!.width).toBeCloseTo(wideKeyBox!.width, 0);
	const compactMappingRows = await mappings
		.locator('.mapping-row')
		.evaluateAll((elements) =>
			elements.slice(0, 2).map((element) => Math.round(element.getBoundingClientRect().top))
		);
	expect(new Set(compactMappingRows).size).toBe(2);
	const documentWidth = await page.evaluate(() => ({
		clientWidth: document.documentElement.clientWidth,
		scrollWidth: document.documentElement.scrollWidth
	}));
	expect(documentWidth.scrollWidth).toBeLessThanOrEqual(documentWidth.clientWidth + 1);

	await page.setViewportSize({ width: 700, height: 900 });
	const [narrowKeyboardBox, narrowLayoutBox, narrowMappingsBox] = await Promise.all([
		keyboardCluster.boundingBox(),
		keyboardLayout.boundingBox(),
		mappings.boundingBox()
	]);
	expect(narrowKeyboardBox).not.toBeNull();
	expect(narrowLayoutBox).not.toBeNull();
	expect(narrowMappingsBox).not.toBeNull();
	expect(narrowMappingsBox!.y).toBeGreaterThanOrEqual(
		narrowKeyboardBox!.y + narrowKeyboardBox!.height
	);
	expect(narrowMappingsBox!.x).toBeCloseTo(narrowLayoutBox!.x, 0);
	expect(narrowMappingsBox!.width).toBeCloseTo(narrowLayoutBox!.width, 0);
	const keyboardOverflow = await keyboardPreview.evaluate((element) => ({
		clientWidth: element.clientWidth,
		scrollWidth: element.scrollWidth
	}));
	expect(keyboardOverflow.scrollWidth).toBeLessThanOrEqual(keyboardOverflow.clientWidth + 1);

	await page.setViewportSize({ width: 468, height: 900 });
	const phoneKeyBox = await yKey.boundingBox();
	expect(phoneKeyBox).not.toBeNull();
	expect(phoneKeyBox!.width).toBeLessThan(wideKeyBox!.width);
	const narrowPageBounds = await page.evaluate(() => {
		const detailColumns = document.querySelector('.detail-columns');
		const keyboardKeys = document.querySelector('.keyboard-preview__keys');
		if (!detailColumns || !keyboardKeys) throw new Error('Expected typing-practice keyboard');
		const columnsBox = detailColumns.getBoundingClientRect();
		const keysBox = keyboardKeys.getBoundingClientRect();
		return {
			documentClientWidth: document.documentElement.clientWidth,
			documentScrollWidth: document.documentElement.scrollWidth,
			columnsRight: columnsBox.right,
			keysRight: keysBox.right
		};
	});
	expect(narrowPageBounds.keysRight).toBeLessThanOrEqual(narrowPageBounds.columnsRight + 1);
	expect(narrowPageBounds.documentScrollWidth).toBeLessThanOrEqual(
		narrowPageBounds.documentClientWidth + 1
	);

	await page.reload();
	const restoredKeyboardOptions = page
		.getByRole('tabpanel', { name: 'Typing practice' })
		.getByRole('group', { name: 'Keyboard options' });
	await expect(
		restoredKeyboardOptions.getByRole('switch', { name: 'Show special keys' })
	).toBeChecked();
	await expect(
		restoredKeyboardOptions.getByRole('switch', { name: 'Show adaptive swaps' })
	).toBeChecked();
	await expect(
		restoredKeyboardOptions.getByRole('switch', { name: 'Only show relevant swaps' })
	).toBeChecked();
	await expect(
		restoredKeyboardOptions.getByRole('switch', { name: 'Underline adaptive group' })
	).toBeChecked();
	await expect(
		restoredKeyboardOptions.getByRole('switch', { name: 'Show swap paths' })
	).toBeChecked();
});

test('underlines enabled Magic groups in typing-practice words', async ({ page }) => {
	await page.route('**/layout-details/*.json', async (route) => {
		await route.fulfill({
			json: {
				version: LAYOUT_DETAIL_VERSION,
				layout: vylet,
				authorName: 'acas',
				likeCount: 0,
				supplemental: {
					schema: 1,
					variants: [
						{
							id: 'default',
							magicKeys: {
								mappings: {
									'*': { rules: { e: 'x' }, fallback: 'repeat-last' }
								}
							}
						}
					]
				},
				stats: {}
			}
		});
	});
	await page.goto('/layouts/vylet?text=explode%20will');

	const practicePanel = page.getByRole('tabpanel', { name: 'Typing practice' });
	const underlineMagicGroup = practicePanel.getByRole('switch', {
		name: 'Underline magic group'
	});
	const words = practicePanel.locator('[data-practice-word]');
	await expect(underlineMagicGroup).toBeChecked();
	await expect(words.nth(0).locator('[data-magic-group="true"]')).toHaveText(['e', 'x']);
	await expect(words.nth(1).locator('[data-magic-group="true"]')).toHaveText(['l', 'l']);

	await page.reload();
	await expect(underlineMagicGroup).toBeChecked();
	await expect(words.nth(0).locator('[data-magic-group="true"]')).toHaveText(['e', 'x']);
	await expect(words.nth(1).locator('[data-magic-group="true"]')).toHaveText(['l', 'l']);
});

test('colors typing-practice feedback and advances only a completed word', async ({ page }) => {
	await page.goto('/layouts/QWERTY');

	const practicePanel = page.getByRole('tabpanel', { name: 'Typing practice' });
	const practiceWords = practicePanel.getByLabel('Practice words');
	const practiceInput = practicePanel.getByRole('textbox', { name: 'Typing practice input' });
	await expect(practicePanel.locator('[data-practice-word]')).toHaveCount(10);
	const initialWords = await practicePanel.locator('[data-practice-word]').allTextContents();
	const testCharacterCount = Array.from(initialWords.join(' ')).length;
	let currentWord = practiceWords.locator('[data-current-word="true"]');
	const targetWord = (await currentWord.textContent())!;
	const targetCharacters = Array.from(targetWord);
	const firstTargetCharacter = targetCharacters[0]!;
	const secondTargetCharacter = targetCharacters[1];
	const wrongCharacter = firstTargetCharacter === 'x' ? 'z' : 'x';
	const incorrectInput = `${wrongCharacter}${secondTargetCharacter ?? ''}`;

	await practiceInput.focus();
	await page.keyboard.type(incorrectInput);
	await expect(practiceInput).toHaveValue(incorrectInput);
	await expect(currentWord.locator('[data-character-status="correct"]')).toHaveCount(
		secondTargetCharacter === undefined ? 0 : 1
	);
	await expect(currentWord.locator('[data-character-status="incorrect"]')).toHaveCount(1);
	if (secondTargetCharacter !== undefined) {
		await expect(currentWord.locator('[data-character-status="correct"]')).toHaveCSS(
			'color',
			'rgb(122, 168, 37)'
		);
	}
	await expect(currentWord.locator('[data-character-status="incorrect"]')).toHaveCSS(
		'color',
		'rgb(196, 75, 58)'
	);
	await expect(practiceInput).toHaveCSS('color', 'rgb(196, 75, 58)');
	await expect(practiceInput).toHaveAttribute('aria-invalid', 'true');
	await expect(practicePanel.getByRole('status')).toHaveText(
		'Typing input does not match the current word.'
	);

	await page.keyboard.press('Space');
	await expect(practiceInput).toHaveValue(`${incorrectInput} `);
	await expect(practicePanel.getByLabel('0 of 10 words complete')).toHaveText('0/10');
	await expect(currentWord).toHaveText(targetWord);

	await practiceInput.selectText();
	await page.keyboard.type(targetWord);
	await expect(currentWord.locator('[data-character-status="correct"]')).toHaveCount(
		targetCharacters.length
	);
	await expect(currentWord.locator('[data-character-status="incorrect"]')).toHaveCount(0);
	await expect(practiceInput).not.toHaveCSS('color', 'rgb(196, 75, 58)');
	await expect(practiceInput).not.toHaveAttribute('aria-invalid', 'true');
	await expect(practicePanel.getByRole('status')).toHaveText('');

	await page.keyboard.press('Space');
	await expect(practiceInput).toHaveValue('');
	await expect(practicePanel.getByLabel('1 of 10 words complete')).toHaveText('1/10');
	currentWord = practiceWords.locator('[data-current-word="true"]');
	await expect(currentWord).not.toHaveText(targetWord);
	expect(await practicePanel.locator('[data-practice-word]').allTextContents()).not.toContain(
		targetWord
	);

	for (let completedWordCount = 1; completedWordCount < 9; completedWordCount += 1) {
		const nextWord = (await practiceWords.locator('[data-current-word="true"]').textContent())!;
		await practiceInput.fill(nextWord);
		await page.keyboard.press('Space');
		await expect(
			practicePanel.getByLabel(`${completedWordCount + 1} of 10 words complete`)
		).toHaveText(`${completedWordCount + 1}/10`);
	}

	const finalWord = (await practiceWords.locator('[data-current-word="true"]').textContent())!;
	await practiceInput.fill(finalWord);
	await expect(practiceInput).toHaveValue('');
	await expect(practicePanel.getByLabel('10 of 10 words complete')).toHaveText('10/10');
	await expect(practiceWords).toHaveText('Press esc to restart');
	await expect(practiceWords.locator('[data-current-word="true"]')).toHaveCount(0);
	const correctAttemptCount = testCharacterCount + (secondTargetCharacter === undefined ? 0 : 1);
	const expectedAccuracy = ((correctAttemptCount / (correctAttemptCount + 2)) * 100).toFixed(2);
	const results = practicePanel.getByLabel('Typing practice results');
	await expect(results).toBeVisible();
	await expect(results.getByText(`Accuracy: ${expectedAccuracy}%`)).toBeVisible();
	await expect(results.getByText(/^WPM: [1-9]\d*\.\d{2}$/)).toBeVisible();
	const completedResults = await results.textContent();
	await practiceInput.fill('x');
	await expect(practiceInput).toHaveValue('');
	await expect(results).toHaveText(completedResults!);
});

test('keeps Repeat enabled without a detail-page toggle', async ({ page }) => {
	await page.route('**/layout-details/*.json', async (route) => {
		await route.fulfill({
			json: {
				version: LAYOUT_DETAIL_VERSION,
				layout: repeatKey,
				authorName: 'ikcelaks',
				likeCount: 0,
				stats: {}
			}
		});
	});
	await page.goto('/layouts/repeat-key?tab=test');

	const repeatTestArea = page.getByPlaceholder('Layout test area');
	await expect(page.getByRole('button', { name: 'Disable repeat key' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Enable repeat key' })).toHaveCount(0);
	await repeatTestArea.focus();
	await page.keyboard.press('a');
	await page.keyboard.press('/');
	await expect(repeatTestArea).toHaveValue('aa');
});

test('highlights both a direct key and Repeat when either can type the next letter', async ({
	page
}) => {
	await page.route('**/layout-details/*.json', async (route) => {
		await route.fulfill({
			json: {
				version: LAYOUT_DETAIL_VERSION,
				layout: repeatKey,
				authorName: 'ikcelaks',
				likeCount: 0,
				stats: {}
			}
		});
	});
	await page.route('**/languages/english1k.json', async (route) => {
		await route.fulfill({
			json: {
				name: 'repeat-key-test',
				words: [
					'hello',
					'letter',
					'coffee',
					'apple',
					'green',
					'tree',
					'book',
					'summer',
					'happy',
					'class'
				]
			}
		});
	});
	await page.goto('/layouts/repeat-key');

	const practicePanel = page.getByRole('tabpanel', { name: 'Typing practice' });
	const practiceWords = practicePanel.locator('[data-practice-word]');
	await expect(practiceWords).toHaveCount(10);
	const targetWord = (await practiceWords.first().textContent())!;
	const targetCharacters = Array.from(targetWord);
	const repeatedIndex = targetCharacters.findIndex(
		(character, index) => index > 0 && character === targetCharacters[index - 1]
	);
	expect(repeatedIndex).toBeGreaterThan(0);

	await practicePanel.getByRole('switch', { name: 'Highlight next key' }).check();
	const practiceInput = practicePanel.getByRole('textbox', { name: 'Typing practice input' });
	for (const character of targetCharacters.slice(0, repeatedIndex)) {
		await practiceInput.press(character);
	}

	const keyboardPreview = practicePanel.getByRole('img', {
		name: 'repeat-key keyboard preview'
	});
	const directKey = keyboardPreview.locator(`[data-key-char="${targetCharacters[repeatedIndex]}"]`);
	const repeatKeyPreview = keyboardPreview.locator('[data-key-char="@"]');
	await expect(directKey).toHaveAttribute('data-key-next', 'true');
	await expect(repeatKeyPreview).toHaveAttribute('data-key-next', 'true');
	await expect(keyboardPreview.locator('[data-key-next="true"]')).toHaveCount(2);
});

test.describe('unreachable input-layout keys', () => {
	test.use({ catalogVariant: 'full' });

	test('marks night’s unassigned thumb and keeps it out of random lessons', async ({ page }) => {
		await page.goto('/layouts/night');

		const practicePanel = page.getByRole('tabpanel', { name: 'Typing practice' });
		const practiceWords = practicePanel.locator('[data-practice-word]');
		await expect(practiceWords).toHaveCount(10);

		const thumbKey = practicePanel
			.getByRole('img', { name: 'night keyboard preview' })
			.locator('[data-key-char="r"]');
		await expect(thumbKey).toHaveAttribute('data-key-unreachable', 'true');
		await expect(thumbKey).toHaveAttribute(
			'title',
			/No physical mapping from your input layout\. Words with this key are excluded from random lessons\./
		);
		await expect(thumbKey).toHaveAttribute('title', /Simulate thumb keys/);

		const lessonText = (await practiceWords.allTextContents()).join(' ');
		expect(lessonText).not.toMatch(/r/i);

		await practicePanel.getByRole('switch', { name: 'Simulate thumb keys' }).check();
		await expect(thumbKey).not.toHaveAttribute('data-key-unreachable', 'true');
	});
});
