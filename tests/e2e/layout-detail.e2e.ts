import { expect, test } from './fixtures/test';
import { LAYOUT_DETAIL_VERSION, layoutDetailFileId } from '../../src/lib/layoutDetails';
import { LAYOUT_DETAIL_STATS_ANALYZERS_STORAGE_KEY } from '../../src/lib/layoutDetailStatsPrefs';
import { STATS_CORPUS_STORAGE_KEY } from '../../src/lib/statsAnalyzers';
import {
	COMPACT_STAT_FIELD_COUNT,
	CYANOPHAGE_COMPACT_STAT_FIELD_COUNT,
	MANA2_COMPACT_STAT_FIELD_COUNT
} from '../../src/lib/statsDerivation';
import { colemakDh, qwerty } from './fixtures/catalog-data';

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
	const testTab = page.getByRole('tab', { name: 'Layout test area' });
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
	const testPanel = page.getByRole('tabpanel', { name: 'Layout test area' });
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

test('uses the detail tab query as the selected-section source of truth', async ({ page }) => {
	await page.goto('/layouts/Colemak-DH?tab=stats&selected=lela');

	const practiceTab = page.getByRole('tab', { name: 'Typing practice' });
	const testTab = page.getByRole('tab', { name: 'Layout test area' });
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

test('places summary highlights and finger usage side by side only when the detail card is wide', async ({
	page
}) => {
	const cmini = Array(COMPACT_STAT_FIELD_COUNT).fill(10_000);
	await page.route('**/layout-details/*.json', async (route) => {
		await route.fulfill({
			json: {
				version: LAYOUT_DETAIL_VERSION,
				layout: qwerty,
				authorName: 'cmini',
				likeCount: 0,
				stats: { cmini: { monkeyracer: cmini, reddit: cmini } }
			}
		});
	});

	await page.setViewportSize({ width: 850, height: 900 });
	await page.goto('/layouts/QWERTY');

	const summary = page.locator('[data-layout-name="QWERTY"]');
	const stats = summary.getByRole('region', { name: 'cmini core statistics' });
	const metricGrid = stats.locator('.core-stats-grid');
	const fingerUsage = stats.locator('.finger-chart-area');
	await expect(stats).toHaveClass(/core-stats--wide-focused/);

	const [wideGridBox, wideFingerBox] = await Promise.all([
		metricGrid.boundingBox(),
		fingerUsage.boundingBox()
	]);
	expect(wideGridBox).not.toBeNull();
	expect(wideFingerBox).not.toBeNull();
	expect(wideFingerBox!.x).toBeGreaterThanOrEqual(wideGridBox!.x + wideGridBox!.width);
	expect(
		Math.min(wideGridBox!.y + wideGridBox!.height, wideFingerBox!.y + wideFingerBox!.height)
	).toBeGreaterThan(Math.max(wideGridBox!.y, wideFingerBox!.y));

	await page.setViewportSize({ width: 640, height: 900 });
	await expect(stats).toHaveClass(/core-stats--wide-focused/);
	const [narrowGridBox, narrowFingerBox] = await Promise.all([
		metricGrid.boundingBox(),
		fingerUsage.boundingBox()
	]);
	expect(narrowGridBox).not.toBeNull();
	expect(narrowFingerBox).not.toBeNull();
	expect(narrowFingerBox!.y).toBeGreaterThanOrEqual(narrowGridBox!.y + narrowGridBox!.height);

	await page.setViewportSize({ width: 850, height: 900 });
	await page.goto('/');
	await expect(page.locator('.core-stats').first()).toBeVisible();
	await expect(page.locator('.core-stats--wide-focused')).toHaveCount(0);
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
