import { expect, test } from './fixtures/test';
import { LAYOUT_DETAIL_VERSION, layoutDetailFileId } from '../../src/lib/layoutDetails';
import { LAYOUT_DETAIL_STATS_ANALYZERS_STORAGE_KEY } from '../../src/lib/layoutDetailStatsPrefs';
import { STATS_CORPUS_STORAGE_KEY } from '../../src/lib/statsAnalyzers';
import { TYPING_PRACTICE_DISPLAY_OPTIONS_STORAGE_KEY } from '../../src/lib/typingPracticePrefs';
import {
	COMPACT_STAT_FIELD_COUNT,
	CYANOPHAGE_COMPACT_STAT_FIELD_COUNT,
	MANA2_COMPACT_STAT_FIELD_COUNT
} from '../../src/lib/statsDerivation';
import {
	adaptivePreview,
	angleLeftThumb,
	colemakDh,
	lela,
	missingOrthoColumn,
	qwerty,
	repeatKey
} from './fixtures/catalog-data';

test.use({ catalogVariant: 'core' });

test('opens a layout on its own route and returns to the preserved index view', async ({
	page
}) => {
	await page.goto('/');

	const colemakSelection = page.getByRole('checkbox', { name: 'Select Colemak-DH' });
	const lelaSelection = page.getByRole('checkbox', { name: 'Select lela' });
	await colemakSelection.check();
	await lelaSelection.check();
	await expect(page).toHaveURL(/(?:\?|&)selected=[^&]*(?:%2C|,)[^&]+(?:&|$)/);
	const indexUrl = page.url();

	const card = page.locator('[data-layout-name="Colemak-DH"]');
	const keyboardDetailsLink = card.getByRole('link', {
		name: 'View Colemak-DH layout details'
	});
	await expect(keyboardDetailsLink).toHaveAttribute('href', '/layouts/Colemak-DH?tab=practice');
	await keyboardDetailsLink.click();

	await expect(page).toHaveURL('/layouts/Colemak-DH?tab=practice');
	await expect(page.getByRole('heading', { name: 'Emulayout', exact: true })).toBeVisible();
	await expect(page.getByRole('article', { name: 'Colemak-DH details' })).toBeVisible();
	await expect(page.locator('.layout-detail-title')).toHaveCount(0);
	await expect(page.getByRole('checkbox', { name: 'Select Colemak-DH' })).toHaveCount(0);
	await expect(page.getByRole('tabpanel', { name: 'Layout results' })).toHaveCount(0);

	await page.getByRole('link', { name: 'All layouts' }).click();

	await expect(page).toHaveURL(indexUrl);
	await expect(colemakSelection).toBeChecked();
	await expect(lelaSelection).toBeChecked();

	await page.reload();
	await expect(colemakSelection).toBeChecked();
	await expect(lelaSelection).toBeChecked();
});

test('keeps keyboard text selectable without opening the detail page', async ({ page }) => {
	await page.goto('/');

	const keyboardDetailsLink = page
		.locator('[data-layout-name="Colemak-DH"]')
		.getByRole('link', { name: 'View Colemak-DH layout details' });
	const layoutText = keyboardDetailsLink.locator('.layout-display');
	const textBox = await layoutText.boundingBox();
	expect(textBox).not.toBeNull();

	await page.mouse.move(textBox!.x + 8, textBox!.y + 8);
	await page.mouse.down();
	await page.mouse.move(textBox!.x + 80, textBox!.y + 8, { steps: 8 });
	await page.mouse.up();

	await expect(page).toHaveURL('/');
	const selectedText = await page.evaluate(() => window.getSelection()?.toString() ?? '');
	expect(selectedText.trim().length).toBeGreaterThan(0);
});

test('loads a direct detail file before fetching the full catalog for Compare', async ({
	page
}) => {
	const requestedPaths: string[] = [];
	page.on('request', (request) => requestedPaths.push(new URL(request.url()).pathname));
	await page.goto('/layouts/QWERTY?selected=lela&likes=0');

	await expect(page).toHaveURL('/layouts/QWERTY?tab=practice');
	await expect(page.locator('[data-layout-detail]')).toBeVisible();
	await expect(page.getByRole('article', { name: 'QWERTY details' })).toBeVisible();
	const ansiPreview = page.getByRole('img', { name: 'QWERTY keyboard preview' });
	await expect(ansiPreview).toHaveAttribute('data-geometry', 'ansi');
	const [ansiTopKey, ansiHomeKey, ansiBottomKey] = await Promise.all([
		ansiPreview.locator('[data-keyboard-row="0"] .keyboard-preview__key').first().boundingBox(),
		ansiPreview.locator('[data-keyboard-row="1"] .keyboard-preview__key').first().boundingBox(),
		ansiPreview.locator('[data-keyboard-row="2"] .keyboard-preview__key').first().boundingBox()
	]);
	expect(ansiTopKey).not.toBeNull();
	expect(ansiHomeKey).not.toBeNull();
	expect(ansiBottomKey).not.toBeNull();
	expect(ansiHomeKey!.x).toBeGreaterThan(ansiTopKey!.x);
	expect(ansiBottomKey!.x).toBeGreaterThan(ansiHomeKey!.x);
	expect(requestedPaths.some((path) => path.startsWith('/layout-details/'))).toBe(true);
	expect(requestedPaths).not.toContain('/all-layouts.json');

	await page.getByRole('button', { name: 'Compare layouts' }).click();
	await expect(page.getByRole('dialog', { name: 'Compare' })).toBeVisible();
	expect(requestedPaths).toContain('/all-layouts.json');
});

test('uses the persisted corpus on a direct detail visit', async ({ page }) => {
	const monkeyracer = Array<number>(23).fill(0);
	monkeyracer[0] = 3000;
	monkeyracer[9] = 100;
	const reddit = [...monkeyracer];
	reddit[9] = 200;

	await page.addInitScript(
		({ key, corpus }) => {
			if (localStorage.getItem(key) === null) localStorage.setItem(key, corpus);
		},
		{
			key: STATS_CORPUS_STORAGE_KEY,
			corpus: 'reddit'
		}
	);
	await page.route(`**/layout-details/${layoutDetailFileId('QWERTY')}.json`, async (route) => {
		await route.fulfill({
			json: {
				version: LAYOUT_DETAIL_VERSION,
				layout: qwerty,
				authorName: 'cmini',
				likeCount: 0,
				stats: { cmini: { monkeyracer, reddit } }
			}
		});
	});

	const requestedPaths: string[] = [];
	page.on('request', (request) => requestedPaths.push(new URL(request.url()).pathname));
	await page.goto('/layouts/QWERTY?tab=stats');

	const summaryStats = page
		.locator('[data-layout-name="QWERTY"]')
		.getByLabel('cmini core statistics');
	const corpus = page.getByRole('combobox', { name: 'Corpus' });
	await expect(corpus).toHaveValue('reddit');
	await expect(summaryStats.getByText('2.00%', { exact: true })).toBeVisible();
	expect(requestedPaths).not.toContain('/layout-stats-cmini-reddit.json');

	await corpus.selectOption('monkeyracer');
	await expect(summaryStats.getByText('1.00%', { exact: true })).toBeVisible();
	await expect
		.poll(() => page.evaluate((key) => localStorage.getItem(key), STATS_CORPUS_STORAGE_KEY))
		.toBe('monkeyracer');

	await page.reload();
	await expect(corpus).toHaveValue('monkeyracer');
	await expect(summaryStats.getByText('1.00%', { exact: true })).toBeVisible();

	await page.getByRole('link', { name: 'All layouts' }).click();
	await expect(page).toHaveURL('/');
	await expect(corpus).toHaveValue('monkeyracer');
	await corpus.selectOption('reddit');
	await page
		.locator('[data-layout-name="QWERTY"]')
		.getByRole('link', { name: 'View QWERTY layout details' })
		.click();
	await expect(page).toHaveURL('/layouts/QWERTY?tab=practice');
	await page.getByRole('tab', { name: 'Stats' }).click();
	await expect(page).toHaveURL('/layouts/QWERTY?tab=stats');
	await expect(corpus).toHaveValue('reddit');
	await expect
		.poll(() => page.evaluate((key) => localStorage.getItem(key), STATS_CORPUS_STORAGE_KEY))
		.toBe('reddit');
});

test('persists detail analyzer visibility across layouts and reloads', async ({ page }) => {
	const cmini = Array(COMPACT_STAT_FIELD_COUNT).fill(10_000);
	const cyanophage = Array(CYANOPHAGE_COMPACT_STAT_FIELD_COUNT).fill(10_000);
	const mana2 = Array(MANA2_COMPACT_STAT_FIELD_COUNT).fill(10_000);
	await page.route('**/layout-details/*.json', async (route) => {
		const filename = new URL(route.request().url()).pathname.split('/').pop();
		const layout = filename === `${layoutDetailFileId('QWERTY')}.json` ? qwerty : colemakDh;
		await route.fulfill({
			json: {
				version: LAYOUT_DETAIL_VERSION,
				layout,
				authorName: 'cmini',
				likeCount: 0,
				stats: {
					cmini: { monkeyracer: cmini, reddit: cmini },
					cyanophage,
					mana2: { monkeyracer: mana2, reddit: mana2 }
				}
			}
		});
	});

	await page.goto('/layouts/Colemak-DH?tab=stats');
	const statsPanel = page.getByRole('tabpanel', { name: 'Stats' });
	await expect(statsPanel.getByRole('heading', { name: 'Stats options' })).toBeVisible();
	await expect(statsPanel.getByRole('group', { name: 'Analyzers' })).toBeVisible();
	const cminiToggle = statsPanel.getByRole('checkbox', { name: 'cmini' });
	const cyanophageToggle = statsPanel.getByRole('checkbox', { name: 'Cyanophage' });
	const mana2Toggle = statsPanel.getByRole('checkbox', { name: 'Mana2' });
	await expect(cminiToggle).toBeChecked();
	await expect(cyanophageToggle).toBeChecked();
	await expect(mana2Toggle).toBeChecked();

	await cyanophageToggle.uncheck();
	await mana2Toggle.uncheck();
	await expect
		.poll(() =>
			page.evaluate((key) => localStorage.getItem(key), LAYOUT_DETAIL_STATS_ANALYZERS_STORAGE_KEY)
		)
		.toBe('["cmini"]');

	await page.reload();
	await expect(cminiToggle).toBeChecked();
	await expect(cyanophageToggle).not.toBeChecked();
	await expect(mana2Toggle).not.toBeChecked();

	await page.goto('/layouts/QWERTY?tab=stats');
	await expect(cminiToggle).toBeChecked();
	await expect(cyanophageToggle).not.toBeChecked();
	await expect(mana2Toggle).not.toBeChecked();

	await cminiToggle.uncheck();
	await expect
		.poll(() =>
			page.evaluate((key) => localStorage.getItem(key), LAYOUT_DETAIL_STATS_ANALYZERS_STORAGE_KEY)
		)
		.toBe('[]');
	await page.reload();
	await expect(cminiToggle).not.toBeChecked();
	await expect(cyanophageToggle).not.toBeChecked();
	await expect(mana2Toggle).not.toBeChecked();
});

test('defaults to Typing practice and switches detail sections with tab keyboard navigation', async ({
	page
}) => {
	await page.goto('/layouts/Colemak-DH');

	const practiceTab = page.getByRole('tab', { name: 'Typing practice' });
	const testTab = page.getByRole('tab', { name: 'Test area' });
	const statsTab = page.getByRole('tab', { name: 'Stats' });
	await expect(practiceTab).toHaveAttribute('aria-selected', 'true');
	await expect(page).toHaveURL('/layouts/Colemak-DH?tab=practice');
	const practicePanel = page.getByRole('tabpanel', { name: 'Typing practice' });
	await expect(practicePanel).toBeVisible();
	const practiceWordItems = practicePanel.locator('[data-practice-word]');
	await expect(practiceWordItems).toHaveCount(10);
	const initialPracticeWords = await practiceWordItems.allTextContents();
	expect(initialPracticeWords).toHaveLength(10);
	expect(new Set(initialPracticeWords).size).toBe(10);
	expect(initialPracticeWords.every((word) => word.length > 0)).toBe(true);
	await expect(practicePanel.getByLabel('0 of 10 words complete')).toHaveText('0/10');
	await expect(practicePanel.getByLabel('Elapsed time: 00:00')).toHaveText('00:00');
	await expect(practicePanel.getByLabel('Typing practice results')).toHaveCount(0);

	const detailPage = page.locator('[data-layout-detail]');
	const practiceInput = practicePanel.getByRole('textbox', { name: 'Typing practice input' });
	const practiceWords = practicePanel.getByLabel('Practice words');
	const practiceInputContainer = practicePanel.locator('.layout-test-area');
	const keyboardPreview = page.getByRole('img', { name: 'Colemak-DH keyboard preview' });
	const keyboardOptions = practicePanel.getByRole('group', { name: 'Keyboard options' });
	const summaryCard = detailPage.locator('[data-layout-name="Colemak-DH"]');
	const detailTabs = page.getByRole('tablist', { name: 'Layout detail sections' });
	const [cardBox, tabsBox, previewBox, practiceInputContainerBox, keyboardOptionsBox] =
		await Promise.all([
			summaryCard.boundingBox(),
			detailTabs.boundingBox(),
			keyboardPreview.boundingBox(),
			practiceInputContainer.boundingBox(),
			keyboardOptions.boundingBox()
		]);
	expect(cardBox).not.toBeNull();
	expect(tabsBox).not.toBeNull();
	expect(previewBox).not.toBeNull();
	expect(practiceInputContainerBox).not.toBeNull();
	expect(keyboardOptionsBox).not.toBeNull();
	await expect(keyboardPreview).toHaveAttribute('data-geometry', 'ortho');
	expect(tabsBox!.x).toBeGreaterThan(cardBox!.x + cardBox!.width);
	expect(practiceInputContainerBox!.x).toBeGreaterThan(cardBox!.x + cardBox!.width);
	expect(practiceInputContainerBox!.y + practiceInputContainerBox!.height).toBeLessThanOrEqual(
		previewBox!.y
	);
	expect(keyboardOptionsBox!.y).toBeGreaterThanOrEqual(previewBox!.y + previewBox!.height);
	expect(keyboardOptionsBox!.x + keyboardOptionsBox!.width).toBeLessThanOrEqual(
		previewBox!.x + previewBox!.width
	);
	await expect(keyboardOptions).toHaveCSS('border-top-width', '0px');
	const keyboardBoard = keyboardPreview.locator('.keyboard-preview__board');
	await expect(keyboardBoard).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await expect(keyboardBoard).toHaveCSS('border-top-style', 'none');
	await expect(keyboardBoard).toHaveCSS('box-shadow', 'none');
	await expect(practicePanel.locator('[data-layout-name="Colemak-DH"]')).toHaveCount(0);
	await expect(practiceWords).toHaveCSS('flex-wrap', 'nowrap');
	await expect(practiceWords).toHaveCSS('overflow', 'hidden');
	await expect(practiceWords).toHaveCSS('white-space', 'nowrap');
	const [promptTypography, inputTypography] = await Promise.all(
		[practiceWords, practiceInput].map((locator) =>
			locator.evaluate((element) => {
				const styles = getComputedStyle(element);
				return {
					fontFamily: styles.fontFamily,
					fontSize: styles.fontSize,
					fontWeight: styles.fontWeight,
					letterSpacing: styles.letterSpacing,
					lineHeight: styles.lineHeight
				};
			})
		)
	);
	expect(inputTypography).toEqual(promptTypography);
	await expect(practiceInput).toBeFocused();
	await expect(summaryCard.getByRole('button')).toHaveCount(1);
	await expect(summaryCard.getByRole('button', { name: 'Anglemod' })).toBeVisible();
	const cminiCardStats = summaryCard.getByLabel('cmini core statistics');
	await expect(cminiCardStats).toBeVisible();
	const cardAnalyzer = summaryCard.getByRole('radiogroup', {
		name: 'Stats analyzer for Colemak-DH'
	});
	await expect(cardAnalyzer).toBeVisible();
	const [cminiCardStatsBox, cardAnalyzerBox] = await Promise.all([
		cminiCardStats.boundingBox(),
		cardAnalyzer.boundingBox()
	]);
	expect(cminiCardStatsBox).not.toBeNull();
	expect(cardAnalyzerBox).not.toBeNull();
	expect(cardAnalyzerBox!.y).toBeGreaterThanOrEqual(
		cminiCardStatsBox!.y + cminiCardStatsBox!.height
	);
	await expect(cardAnalyzer.getByRole('radio', { name: 'cmini' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await cardAnalyzer.getByRole('radio', { name: 'Cyanophage' }).click();
	await expect(summaryCard.getByLabel('Cyanophage core statistics')).toBeVisible();
	await expect(summaryCard.getByLabel('cmini core statistics')).toHaveCount(0);
	await expect(detailPage.getByRole('link', { name: 'View in Cyanophage' })).toHaveAttribute(
		'href',
		/^https:\/\/cyanophage\.github\.io\//
	);
	await expect(
		detailPage.getByRole('link', { name: 'Practice typing on Colemak Camp' })
	).toHaveAttribute('href', /^https:\/\/emulayout\.github\.io\/colemakcamp\//);

	await practiceInput.focus();
	await page.keyboard.press('a');
	await expect(practiceInput).toHaveValue('a');
	await expect
		.poll(async () => practicePanel.getByLabel(/^Elapsed time:/).getAttribute('aria-label'), {
			timeout: 2500
		})
		.not.toBe('Elapsed time: 00:00');

	await practiceTab.focus();
	await practiceTab.press('ArrowRight');
	await expect(testTab).toBeFocused();
	await expect(testTab).toHaveAttribute('aria-selected', 'true');
	await expect(page).toHaveURL('/layouts/Colemak-DH?tab=test');
	const testPanel = page.getByRole('tabpanel', { name: 'Test area' });
	await expect(testPanel).toBeVisible();
	const testArea = page.getByPlaceholder('Layout test area');
	await expect(testArea).toBeVisible();
	await expect(practiceInput).toHaveCount(0);

	await testTab.press('ArrowRight');
	await expect(statsTab).toBeFocused();
	await expect(statsTab).toHaveAttribute('aria-selected', 'true');
	await expect(page).toHaveURL('/layouts/Colemak-DH?tab=stats');
	const statsPanel = page.getByRole('tabpanel', { name: 'Stats' });
	await expect(statsPanel).toBeVisible();
	await expect(page.getByText('Analyzers', { exact: true })).toBeVisible();
	await expect(statsPanel.locator('[data-layout-name="Colemak-DH"]')).toHaveCount(0);
	await expect(summaryCard).toBeVisible();
	await expect(detailPage.getByRole('link', { name: 'View in Cyanophage' })).toBeVisible();
	await expect(
		detailPage.getByRole('link', { name: 'Practice typing on Colemak Camp' })
	).toBeVisible();
	await expect(testArea).toHaveCount(0);

	await statsTab.press('ArrowLeft');
	await expect(testTab).toBeFocused();
	await expect(testTab).toHaveAttribute('aria-selected', 'true');
	await expect(page).toHaveURL('/layouts/Colemak-DH?tab=test');

	await page.getByRole('link', { name: 'All layouts' }).click();
	await expect(
		page.getByRole('radiogroup', { name: 'Analyzer' }).getByRole('radio', { name: 'cmini' })
	).toHaveAttribute('aria-checked', 'true');
});

test('focuses typing practice and Escape starts a different lesson', async ({ page }) => {
	await page.goto('/layouts/QWERTY');

	const practicePanel = page.getByRole('tabpanel', { name: 'Typing practice' });
	const practiceInput = practicePanel.getByRole('textbox', { name: 'Typing practice input' });
	const practiceWords = practicePanel.locator('[data-practice-word]');
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
	const keyboardOptions = practicePanel.getByRole('group', { name: 'Keyboard options' });
	const nextKeyToggle = keyboardOptions.getByRole('switch', { name: 'Highlight next key' });
	const homeKeyToggle = keyboardOptions.getByRole('switch', { name: 'Color home keys' });
	await expect(keyboardOptions.getByRole('switch', { name: 'Show special keys' })).toHaveCount(0);
	await expect(nextKeyToggle).not.toBeChecked();
	await expect(homeKeyToggle).not.toBeChecked();
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

	await homeKeyToggle.check();
	const homeRow = keyboardPreview.locator('[data-keyboard-row="1"]');
	await expect(homeRow.locator('[data-key-home="true"]')).toHaveCount(8);
	await expect(homeRow.locator('[data-key-char="g"]')).not.toHaveAttribute('data-key-home', 'true');
	await expect(homeRow.locator('[data-key-char="h"]')).not.toHaveAttribute('data-key-home', 'true');
	await expect(
		keyboardPreview.locator('[data-keyboard-row="0"] [data-key-home="true"]')
	).toHaveCount(0);

	await expect(keyboardOptions).toHaveCSS('flex-direction', 'row');
	await expect(keyboardOptions).toHaveCSS('justify-content', 'flex-start');
	const [wideKeyboardBox, wideOptionsBox] = await Promise.all([
		keyboardPreview.boundingBox(),
		keyboardOptions.boundingBox()
	]);
	expect(wideKeyboardBox).not.toBeNull();
	expect(wideOptionsBox).not.toBeNull();
	expect(wideOptionsBox!.y).toBeGreaterThanOrEqual(wideKeyboardBox!.y + wideKeyboardBox!.height);
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

test('places special mappings beside the typing-practice keyboard', async ({ page }) => {
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
							adaptiveSwaps: { mappings: { l: { y: 'j' } } }
						}
					]
				},
				stats: {}
			}
		});
	});
	await page.goto('/layouts/adaptive-preview');

	const practicePanel = page.getByRole('tabpanel', { name: 'Typing practice' });
	const keyboardMain = practicePanel.locator('.typing-practice-keyboard-main');
	const mappings = practicePanel.locator('.typing-practice-mappings');
	const keyboardPreview = practicePanel.getByRole('img', {
		name: 'adaptive-preview keyboard preview'
	});
	const keyboardOptions = practicePanel.getByRole('group', { name: 'Keyboard options' });
	const showSpecialKeys = keyboardOptions.getByRole('switch', { name: 'Show special keys' });
	const showAdaptiveSwaps = keyboardOptions.getByRole('switch', {
		name: 'Show Adaptive swaps'
	});
	const showSwapPaths = keyboardOptions.getByRole('switch', { name: 'Show swap paths' });
	const practiceInput = practicePanel.getByRole('textbox', { name: 'Typing practice input' });
	const yKey = keyboardPreview.locator('[data-key-char="y"]');
	const jKey = keyboardPreview.locator('[data-key-char="j"]');
	const swapPath = keyboardPreview.locator('[data-swap-path="j:y"]');
	await expect(showSpecialKeys).toBeChecked();
	await expect(showAdaptiveSwaps).toBeChecked();
	await expect(showSwapPaths).not.toBeChecked();
	await expect(mappings.getByRole('checkbox', { name: 'Adaptive swap mappings' })).toBeVisible();

	await practiceInput.press('l');
	await expect(yKey).toHaveText('j');
	await expect(jKey).toHaveText('y');
	await page.keyboard.press('Escape');
	await showAdaptiveSwaps.uncheck();
	await expect(showSwapPaths).toHaveCount(0);
	await practiceInput.press('l');
	await expect(yKey).toHaveText('y');
	await expect(jKey).toHaveText('j');
	await page.keyboard.press('Escape');
	await showAdaptiveSwaps.check();
	await expect(showSwapPaths).toBeVisible();
	await expect(showSwapPaths).not.toBeChecked();
	await showSwapPaths.check();
	await practiceInput.press('l');
	await expect(swapPath).toHaveCount(1);
	await page.keyboard.press('Escape');

	await showSpecialKeys.uncheck();
	await expect(mappings).toHaveCount(0);
	await expect(keyboardPreview.locator('[data-key-feedback]')).toHaveCount(0);
	await showSpecialKeys.check();
	await expect(mappings).toBeVisible();
	const [wideKeyboardBox, wideMappingsBox] = await Promise.all([
		keyboardMain.boundingBox(),
		mappings.boundingBox()
	]);
	expect(wideKeyboardBox).not.toBeNull();
	expect(wideMappingsBox).not.toBeNull();
	expect(wideMappingsBox!.width).toBeLessThanOrEqual(315);
	expect(wideKeyboardBox!.width).toBeGreaterThan(wideMappingsBox!.width);
	expect(wideMappingsBox!.x).toBeGreaterThanOrEqual(wideKeyboardBox!.x + wideKeyboardBox!.width);

	await page.setViewportSize({ width: 700, height: 900 });
	const [narrowKeyboardBox, narrowMappingsBox] = await Promise.all([
		keyboardMain.boundingBox(),
		mappings.boundingBox()
	]);
	expect(narrowKeyboardBox).not.toBeNull();
	expect(narrowMappingsBox).not.toBeNull();
	expect(narrowMappingsBox!.y).toBeGreaterThanOrEqual(
		narrowKeyboardBox!.y + narrowKeyboardBox!.height
	);

	await page.reload();
	const restoredKeyboardOptions = page
		.getByRole('tabpanel', { name: 'Typing practice' })
		.getByRole('group', { name: 'Keyboard options' });
	await expect(
		restoredKeyboardOptions.getByRole('switch', { name: 'Show special keys' })
	).toBeChecked();
	await expect(
		restoredKeyboardOptions.getByRole('switch', { name: 'Show Adaptive swaps' })
	).toBeChecked();
	await expect(
		restoredKeyboardOptions.getByRole('switch', { name: 'Show swap paths' })
	).toBeChecked();
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

test('uses the detail tab query as the selected-section source of truth', async ({ page }) => {
	await page.goto('/layouts/Colemak-DH?tab=stats&selected=lela');

	const practiceTab = page.getByRole('tab', { name: 'Typing practice' });
	const testTab = page.getByRole('tab', { name: 'Test area' });
	const statsTab = page.getByRole('tab', { name: 'Stats' });
	await expect(page).toHaveURL('/layouts/Colemak-DH?tab=stats');
	await expect(statsTab).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByRole('tabpanel', { name: 'Stats' })).toBeVisible();

	await page.reload();
	await expect(statsTab).toHaveAttribute('aria-selected', 'true');

	await testTab.click();
	await expect(page).toHaveURL('/layouts/Colemak-DH?tab=test');
	await expect(testTab).toHaveAttribute('aria-selected', 'true');

	await page.goto('/layouts/Colemak-DH?tab=unknown');
	await expect(page).toHaveURL('/layouts/Colemak-DH?tab=practice');
	await expect(practiceTab).toHaveAttribute('aria-selected', 'true');
});

test('uses one document scrollbar for detail content at every responsive width', async ({
	page
}) => {
	for (const width of [640, 800, 1024]) {
		await page.setViewportSize({ width, height: 500 });
		await page.goto('/layouts/Colemak-DH');
		await expect(page.locator('[data-layout-detail]')).toBeVisible();

		const scrollState = await page.evaluate(() => {
			const shell = document.querySelector<HTMLElement>('.app-shell');
			const main = document.querySelector<HTMLElement>('.app-main');
			const detailPane = document.querySelector<HTMLElement>('.layout-detail-scroll');
			const backHeader = document.querySelector<HTMLElement>('.layout-detail-header');
			if (!shell || !main || !detailPane || !backHeader) return null;

			return {
				documentHeight: document.documentElement.scrollHeight,
				viewportHeight: window.innerHeight,
				rootOverflow: getComputedStyle(document.documentElement).overflowY,
				bodyOverflow: getComputedStyle(document.body).overflowY,
				shellOverflow: getComputedStyle(shell).overflowY,
				mainOverflow: getComputedStyle(main).overflowY,
				detailOverflow: getComputedStyle(detailPane).overflowY,
				backPosition: getComputedStyle(backHeader).position
			};
		});

		expect(scrollState).not.toBeNull();
		expect(scrollState!.documentHeight).toBeGreaterThan(scrollState!.viewportHeight);
		expect(scrollState!.rootOverflow).not.toBe('hidden');
		expect(scrollState!.bodyOverflow).not.toBe('hidden');
		expect(scrollState!.shellOverflow).not.toBe('hidden');
		expect(scrollState!.mainOverflow).not.toBe('hidden');
		expect(scrollState!.detailOverflow).not.toBe('auto');
		expect(scrollState!.detailOverflow).not.toBe('scroll');
		expect(scrollState!.backPosition).toBe('static');

		await page.evaluate(() => window.scrollTo(0, 0));
		await page.mouse.move(20, 20);
		await page.mouse.wheel(0, 600);
		await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
	}
});

test('keeps the layout summary in the page scroll on wide detail views', async ({ page }) => {
	await page.setViewportSize({ width: 1024, height: 500 });
	await page.goto('/layouts/Colemak-DH');

	await expect(page.locator('.detail-side')).toHaveCSS('position', 'static');
});

test('disables and re-enables a Repeat key from the persistent options', async ({ page }) => {
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

	const repeatOption = page.getByRole('button', { name: 'Disable repeat key' });
	const repeatTestArea = page.getByPlaceholder('Layout test area');
	await repeatTestArea.focus();
	await page.keyboard.press('a');
	await page.keyboard.press('/');
	await expect(repeatTestArea).toHaveValue('aa');
	await page.keyboard.press('Escape');
	await repeatOption.click();
	await expect(page.getByRole('button', { name: 'Enable repeat key' })).toBeVisible();
	await repeatTestArea.focus();
	await page.keyboard.press('a');
	await page.keyboard.press('/');
	await expect(repeatTestArea).toHaveValue('a@');
	await page.getByRole('button', { name: 'Enable repeat key' }).click();
	await expect(page.getByRole('button', { name: 'Disable repeat key' })).toBeVisible();
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

test('removes and reapplies angle mod from the summary card action', async ({ page }) => {
	await page.goto('/layouts/lela?tab=test');
	const summaryCard = page.locator('[data-layout-name="lela"]');
	const angleOption = summaryCard.getByRole('button', { name: 'Remove anglemod' });
	await expect(angleOption).toHaveAttribute('aria-pressed', 'false');
	const previewBottomLeftKey = page
		.getByRole('img', { name: 'lela keyboard preview' })
		.locator('[data-keyboard-row="2"] .keyboard-preview__key')
		.first();
	await expect(previewBottomLeftKey).toHaveText('x');
	const angleTestArea = page.getByPlaceholder('Layout test area');
	await angleTestArea.focus();
	await page.keyboard.press('z');
	await expect(angleTestArea).toHaveValue('x');
	await page.keyboard.press('Escape');
	await angleOption.click();
	await expect(angleOption).toHaveAttribute('aria-pressed', 'true');
	await expect(previewBottomLeftKey).toHaveText('z');
	await angleTestArea.focus();
	await page.keyboard.press('z');
	await expect(angleTestArea).toHaveValue('z');
	await angleOption.click();
	await expect(angleOption).toHaveAttribute('aria-pressed', 'false');
});

test('previews armed Adaptive swaps on the styled keyboard', async ({ page }) => {
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
							adaptiveSwaps: { mappings: { l: { y: 'j' } } }
						}
					]
				},
				stats: {}
			}
		});
	});
	await page.goto('/layouts/adaptive-preview?tab=test');

	const testArea = page.getByPlaceholder('Layout test area');
	const preview = page.getByRole('img', { name: 'adaptive-preview keyboard preview' });
	const yKey = preview.locator('[data-key-char="y"]');
	const jKey = preview.locator('[data-key-char="j"]');
	const previewToggle = page.getByRole('switch', { name: 'Preview Adaptive swaps' });
	const pathToggle = page.getByRole('switch', { name: 'Show swap paths' });
	const swapPath = preview.locator('[data-swap-path="j:y"]');
	const baseBackground = await yKey.evaluate((key) => getComputedStyle(key).backgroundImage);

	await expect(previewToggle).toBeChecked();
	await expect(pathToggle).not.toBeChecked();
	await expect(swapPath).toHaveCount(0);
	await previewToggle.focus();
	await previewToggle.press('Space');
	await expect(previewToggle).not.toBeChecked();
	await testArea.focus();
	await page.keyboard.press('l');
	await expect(testArea).toHaveValue('l');
	await expect(yKey).toHaveText('y');
	await expect(jKey).toHaveText('j');

	await page.keyboard.press('Escape');
	await previewToggle.focus();
	await previewToggle.press('Space');
	await expect(previewToggle).toBeChecked();
	await pathToggle.focus();
	await pathToggle.press('Space');
	await expect(pathToggle).toBeChecked();
	await testArea.focus();
	await page.keyboard.press('l');
	await expect(yKey).toHaveText('j');
	await expect(jKey).toHaveText('y');
	await expect(yKey).toHaveAttribute('data-key-feedback-active', 'true');
	await expect(jKey).toHaveAttribute('data-key-feedback-active', 'true');
	await expect(swapPath).toHaveCount(1);
	const activeBackground = await yKey.evaluate((key) => getComputedStyle(key).backgroundImage);
	expect(activeBackground).not.toBe(baseBackground);

	await page.keyboard.press('Escape');
	await expect(yKey).toHaveText('y');
	await expect(jKey).toHaveText('j');
	await expect(yKey).not.toHaveAttribute('data-key-feedback-active', 'true');
	await expect(swapPath).toHaveCount(0);

	await page.getByRole('checkbox', { name: 'Adaptive swap mappings' }).uncheck();
	await testArea.focus();
	await page.keyboard.press('l');
	await expect(yKey).toHaveText('y');
	await expect(jKey).toHaveText('j');
	await expect(swapPath).toHaveCount(0);
});

test('preserves ortho columns when a row has a missing key', async ({ page }) => {
	await page.route('**/layout-details/*.json', async (route) => {
		await route.fulfill({
			json: {
				version: LAYOUT_DETAIL_VERSION,
				layout: missingOrthoColumn,
				authorName: 'cmini',
				likeCount: 0,
				stats: {}
			}
		});
	});
	await page.goto('/layouts/missing-ortho-column');

	const preview = page.getByRole('img', { name: 'missing-ortho-column keyboard preview' });
	const topRow = preview.locator('[data-keyboard-row="0"]');
	const homeRow = preview.locator('[data-keyboard-row="1"]');
	const [topRightStart, homeRightStart, missingTopKey, homeRightEnd] = await Promise.all([
		topRow.locator('[data-key-column="5"]').boundingBox(),
		homeRow.locator('[data-key-column="5"]').boundingBox(),
		topRow.locator('[data-key-column="9"]').boundingBox(),
		homeRow.locator('[data-key-column="9"]').boundingBox()
	]);
	expect(topRightStart).not.toBeNull();
	expect(homeRightStart).not.toBeNull();
	expect(missingTopKey).not.toBeNull();
	expect(homeRightEnd).not.toBeNull();
	expect(Math.abs(topRightStart!.x - homeRightStart!.x)).toBeLessThanOrEqual(1);
	expect(Math.abs(missingTopKey!.x - homeRightEnd!.x)).toBeLessThanOrEqual(1);
	await expect(topRow.locator('[data-key-column="9"]')).toHaveClass(
		/keyboard-preview__key-placeholder/
	);
	await expect(homeRow.locator('[data-key-column="9"]')).toHaveText('u');
});

test('loads Quick Find names and highlighted layout details on demand', async ({ page }) => {
	await page.route(`**/layout-details/${layoutDetailFileId('lela')}.json`, async (route) => {
		await route.fulfill({
			json: {
				version: LAYOUT_DETAIL_VERSION,
				layout: lela,
				authorName: 'lelazsq',
				likeCount: 0,
				stats: {
					cmini: {
						monkeyracer: [
							1923, 2032, 1766, 106, 127, 578, 38, 641, 593, 597, 5448, 4552, 2044, 1857, 711, 792,
							2041, 948, 1331, 275, 0, 0, 0
						]
					}
				}
			}
		});
	});
	const requestedPaths: string[] = [];
	page.on('request', (request) => requestedPaths.push(new URL(request.url()).pathname));
	await page.goto('/layouts/QWERTY');

	await page.getByRole('button', { name: 'Quick find layouts' }).click();
	const quickFind = page.getByRole('dialog', { name: 'Quick find' });
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).fill('lela');

	const previewCard = quickFind.locator('[data-layout-name="lela"]');
	await expect(previewCard).toBeVisible();
	await expect(previewCard.getByText('SFB', { exact: true })).toBeVisible();
	await expect(previewCard.getByRole('checkbox', { name: 'Select lela' })).toHaveCount(0);
	await expect(
		previewCard.getByRole('button', { name: /Open .*Same-finger bigrams filter/ })
	).toHaveCount(0);
	await expect(
		previewCard.getByRole('button', { name: /Open Left pinky usage filter/ })
	).toHaveCount(0);
	await expect(previewCard.getByRole('button', { name: /Left pinky:/ })).toBeVisible();
	expect(requestedPaths).toContain('/layout-names.json');
	expect(requestedPaths.filter((path) => path.startsWith('/layout-details/')).length).toBe(2);
	expect(requestedPaths).not.toContain('/all-layouts.json');
});

test('debounces Quick Find detail fetches while the highlight moves', async ({ page }) => {
	const requestedDetails: string[] = [];
	page.on('request', (request) => {
		const path = new URL(request.url()).pathname;
		if (path.startsWith('/layout-details/')) requestedDetails.push(path);
	});
	await page.goto('/layouts/QWERTY');

	await page.getByRole('button', { name: 'Quick find layouts' }).click();
	const quickFind = page.getByRole('dialog', { name: 'Quick find' });
	const search = quickFind.getByRole('combobox', { name: 'Search layout names' });
	await search.fill('l');
	await search.press('ArrowDown');
	await search.press('ArrowUp');

	await expect(quickFind.locator('[data-layout-name="lela"]')).toBeVisible();
	expect(requestedDetails.filter((path) => path.includes(layoutDetailFileId('lela')))).toHaveLength(
		1
	);
	expect(
		requestedDetails.filter((path) => path.includes(layoutDetailFileId('Colemak-DH')))
	).toHaveLength(0);
});

test('reuses the loaded index catalog for Quick Find without detail fetches', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'lela', exact: true })).toBeVisible();

	const requestedPaths: string[] = [];
	page.on('request', (request) => requestedPaths.push(new URL(request.url()).pathname));

	await page.getByRole('button', { name: 'Quick find layouts' }).click();
	const quickFind = page.getByRole('dialog', { name: 'Quick find' });
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).fill('l');

	await expect(quickFind.locator('[data-layout-name="lela"]')).toBeVisible();
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).press('ArrowDown');
	await expect(quickFind.locator('[data-layout-name="Colemak-DH"]')).toBeVisible();

	expect(requestedPaths).not.toContain('/layout-names.json');
	expect(requestedPaths.filter((path) => path.startsWith('/layout-details/'))).toEqual([]);
});

test('opens the layout show page from Quick Find with Enter', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'lela', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Quick find layouts' }).click();
	const quickFind = page.getByRole('dialog', { name: 'Quick find' });
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).fill('lela');
	await expect(quickFind.getByRole('option', { name: 'lela' })).toBeVisible();
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).press('Enter');

	await expect(page).toHaveURL('/layouts/lela?tab=practice');
	await expect(quickFind).toHaveCount(0);
});

test('dismisses Quick Find when opening layout details from the preview', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'lela', exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Quick find layouts' }).click();
	const quickFind = page.getByRole('dialog', { name: 'Quick find' });
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).fill('lela');

	const previewCard = quickFind.locator('[data-layout-name="lela"]');
	await expect(previewCard).toBeVisible();
	await previewCard.getByRole('link', { name: 'View lela layout details' }).click();

	await expect(page).toHaveURL('/layouts/lela?tab=practice');
	await expect(quickFind).toHaveCount(0);
});

test('shows a recoverable not-found page for an unknown layout URL', async ({ page }) => {
	await page.goto('/layouts/does-not-exist?selected=lela');

	await expect(page).toHaveURL('/layouts/does-not-exist');
	await expect(page.getByRole('heading', { name: 'Layout not found' })).toBeVisible();
	await expect(
		page.getByText('No layout named “does-not-exist” is in the current catalog.')
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Back to layouts' })).toHaveAttribute('href', '/');
});

test.describe('full-catalog keyboard previews', () => {
	test.use({ catalogVariant: 'full' });

	test('places special mappings beside the test area', async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.goto('/layouts/vylet?tab=test');

		const row = page.locator('.detail-test-input-row--with-mappings');
		const mappings = row.locator('.detail-test-mappings');
		const testArea = row.locator('.layout-test-area');
		const preview = page.getByRole('img', { name: 'vylet keyboard preview' });
		const [rowBox, mappingsBox, testAreaBox, previewBox] = await Promise.all([
			row.boundingBox(),
			mappings.boundingBox(),
			testArea.boundingBox(),
			preview.boundingBox()
		]);

		expect(rowBox).not.toBeNull();
		expect(mappingsBox).not.toBeNull();
		expect(testAreaBox).not.toBeNull();
		expect(previewBox).not.toBeNull();
		expect(testAreaBox!.x).toBeLessThan(mappingsBox!.x);
		expect(Math.abs(mappingsBox!.y - testAreaBox!.y)).toBeLessThanOrEqual(1);
		expect(testAreaBox!.width).toBeLessThan(rowBox!.width);
		expect(previewBox!.y).toBeGreaterThanOrEqual(
			Math.max(mappingsBox!.y + mappingsBox!.height, testAreaBox!.y + testAreaBox!.height)
		);
	});

	test('places Turnip’s right thumb between k and p', async ({ page }) => {
		await page.goto('/layouts/turnip');

		const preview = page.getByRole('img', { name: 'turnip keyboard preview' });
		const bottomRow = preview.locator('[data-keyboard-row="2"]');
		const thumbKey = preview
			.locator('[data-keyboard-row="3"] .keyboard-preview__key')
			.filter({ hasText: 't' });
		const leftTargetKey = bottomRow.locator('.keyboard-preview__key').filter({ hasText: 'k' });
		const rightTargetKey = bottomRow.locator('.keyboard-preview__key').filter({ hasText: 'p' });
		const [thumbBox, leftTargetBox, rightTargetBox] = await Promise.all([
			thumbKey.boundingBox(),
			leftTargetKey.boundingBox(),
			rightTargetKey.boundingBox()
		]);
		expect(thumbBox).not.toBeNull();
		expect(leftTargetBox).not.toBeNull();
		expect(rightTargetBox).not.toBeNull();
		const targetCenter =
			(leftTargetBox!.x +
				leftTargetBox!.width / 2 +
				rightTargetBox!.x +
				rightTargetBox!.width / 2) /
			2;
		expect(Math.abs(thumbBox!.x + thumbBox!.width / 2 - targetCenter)).toBeLessThanOrEqual(1);
	});

	test('places an angled left thumb between its adjacent bottom-row keys', async ({ page }) => {
		await page.route('**/layout-details/*.json', async (route) => {
			await route.fulfill({
				json: {
					version: LAYOUT_DETAIL_VERSION,
					layout: angleLeftThumb,
					authorName: 'strawberryturtle',
					likeCount: 0,
					stats: {}
				}
			});
		});
		await page.goto('/layouts/angle-left-thumb');

		const preview = page.getByRole('img', { name: 'angle-left-thumb keyboard preview' });
		const bottomRow = preview.locator('[data-keyboard-row="2"]');
		const thumbKey = preview
			.locator('[data-keyboard-row="3"] .keyboard-preview__key')
			.filter({ hasText: 't' });
		const leftTargetKey = bottomRow.locator('.keyboard-preview__key').filter({ hasText: 'c' });
		const rightTargetKey = bottomRow.locator('.keyboard-preview__key').filter({ hasText: 'm' });
		const [thumbBox, leftTargetBox, rightTargetBox] = await Promise.all([
			thumbKey.boundingBox(),
			leftTargetKey.boundingBox(),
			rightTargetKey.boundingBox()
		]);
		expect(thumbBox).not.toBeNull();
		expect(leftTargetBox).not.toBeNull();
		expect(rightTargetBox).not.toBeNull();
		const targetCenter =
			(leftTargetBox!.x +
				leftTargetBox!.width / 2 +
				rightTargetBox!.x +
				rightTargetBox!.width / 2) /
			2;
		expect(Math.abs(thumbBox!.x + thumbBox!.width / 2 - targetCenter)).toBeLessThanOrEqual(1);
	});

	test('places a left thumb key under the left index-finger column', async ({ page }) => {
		await page.goto('/layouts/night');

		const preview = page.getByRole('img', { name: 'night keyboard preview' });
		const thumbKey = preview
			.locator('[data-keyboard-row="3"] .keyboard-preview__key')
			.filter({ hasText: 'r' });
		const leftIndexKey = preview.locator('[data-keyboard-row="2"] [data-key-column="3"]');
		await expect(leftIndexKey).toHaveText('d');
		const [thumbBox, leftIndexBox] = await Promise.all([
			thumbKey.boundingBox(),
			leftIndexKey.boundingBox()
		]);
		expect(thumbBox).not.toBeNull();
		expect(leftIndexBox).not.toBeNull();
		expect(Math.abs(thumbBox!.x - leftIndexBox!.x)).toBeLessThanOrEqual(1);
	});

	test('places a right thumb key under the right index-finger column', async ({ page }) => {
		await page.goto('/layouts/magic_sturdy');

		const preview = page.getByRole('img', { name: 'magic_sturdy keyboard preview' });
		const thumbKey = preview
			.locator('[data-keyboard-row="3"] .keyboard-preview__key')
			.filter({ hasText: '@' });
		const rightIndexKey = preview.locator('[data-keyboard-row="2"] [data-key-column="6"]');
		await expect(rightIndexKey).toHaveText('h');
		const [thumbBox, rightIndexBox] = await Promise.all([
			thumbKey.boundingBox(),
			rightIndexKey.boundingBox()
		]);
		expect(thumbBox).not.toBeNull();
		expect(rightIndexBox).not.toBeNull();
		expect(Math.abs(thumbBox!.x - rightIndexBox!.x)).toBeLessThanOrEqual(1);
	});
});
