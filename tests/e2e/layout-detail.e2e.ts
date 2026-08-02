import { expect, test } from './fixtures/test';
import { LAYOUT_DETAIL_VERSION } from '../../src/lib/layoutDetails';
import { angleLeftThumb, missingOrthoColumn, repeatKey } from './fixtures/catalog-data';

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
	await expect(keyboardDetailsLink).toHaveAttribute('href', '/layouts/Colemak-DH');
	await keyboardDetailsLink.click();

	await expect(page).toHaveURL('/layouts/Colemak-DH');
	await expect(page.getByRole('heading', { name: 'Emulayout', exact: true })).toBeVisible();
	await expect(page.getByRole('article', { name: 'Colemak-DH details' })).toBeVisible();
	await expect(page.locator('.layout-detail-title')).toHaveCount(0);
	await expect(page.getByRole('checkbox', { name: 'Select Colemak-DH' })).toHaveCount(0);
	await expect(page.getByRole('tabpanel', { name: 'Layout results' })).toHaveCount(0);

	await page.getByRole('link', { name: 'Back to layouts' }).click();

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

	await expect(page).toHaveURL('/layouts/QWERTY');
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

test('defaults to the Test area and switches detail sections with tab keyboard navigation', async ({
	page
}) => {
	await page.goto('/layouts/Colemak-DH');

	const testTab = page.getByRole('tab', { name: 'Test area' });
	const statsTab = page.getByRole('tab', { name: 'Stats' });
	await expect(testTab).toHaveAttribute('aria-selected', 'true');
	const testPanel = page.getByRole('tabpanel', { name: 'Test area' });
	await expect(testPanel).toBeVisible();

	const detailPage = page.locator('[data-layout-detail]');
	const testArea = page.getByPlaceholder('Layout test area');
	const testAreaContainer = testPanel.locator('.layout-test-area');
	const keyboardPreview = page.getByRole('img', { name: 'Colemak-DH keyboard preview' });
	const summaryCard = detailPage.locator('[data-layout-name="Colemak-DH"]');
	const detailTabs = page.getByRole('tablist', { name: 'Layout detail sections' });
	const [cardBox, tabsBox, previewBox, testAreaContainerBox] = await Promise.all([
		summaryCard.boundingBox(),
		detailTabs.boundingBox(),
		keyboardPreview.boundingBox(),
		testAreaContainer.boundingBox()
	]);
	expect(cardBox).not.toBeNull();
	expect(tabsBox).not.toBeNull();
	expect(previewBox).not.toBeNull();
	expect(testAreaContainerBox).not.toBeNull();
	await expect(keyboardPreview).toHaveAttribute('data-geometry', 'ortho');
	expect(tabsBox!.x).toBeGreaterThan(cardBox!.x + cardBox!.width);
	expect(testAreaContainerBox!.x).toBeGreaterThan(cardBox!.x + cardBox!.width);
	expect(testAreaContainerBox!.y + testAreaContainerBox!.height).toBeLessThanOrEqual(previewBox!.y);
	expect(Math.abs(previewBox!.x - testAreaContainerBox!.x)).toBeLessThanOrEqual(1);
	expect(Math.abs(previewBox!.width - testAreaContainerBox!.width)).toBeLessThanOrEqual(1);
	const keyboardBoard = keyboardPreview.locator('.keyboard-preview__board');
	await expect(keyboardBoard).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await expect(keyboardBoard).toHaveCSS('border-top-style', 'none');
	await expect(keyboardBoard).toHaveCSS('box-shadow', 'none');
	await expect(testPanel.locator('[data-layout-name="Colemak-DH"]')).toHaveCount(0);
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
	await expect(detailPage.getByRole('link', { name: 'Type on Colemak Camp' })).toHaveAttribute(
		'href',
		/^https:\/\/emulayout\.github\.io\/colemakcamp\//
	);

	await testArea.focus();
	await page.keyboard.press('a');
	await expect(testArea).toHaveValue('a');

	await testTab.focus();
	await testTab.press('ArrowRight');
	await expect(statsTab).toBeFocused();
	await expect(statsTab).toHaveAttribute('aria-selected', 'true');
	const statsPanel = page.getByRole('tabpanel', { name: 'Stats' });
	await expect(statsPanel).toBeVisible();
	await expect(page.getByText('Show analyzers', { exact: true })).toBeVisible();
	await expect(statsPanel.locator('[data-layout-name="Colemak-DH"]')).toHaveCount(0);
	await expect(summaryCard).toBeVisible();
	await expect(detailPage.getByRole('link', { name: 'View in Cyanophage' })).toBeVisible();
	await expect(detailPage.getByRole('link', { name: 'Type on Colemak Camp' })).toBeVisible();
	await expect(testArea).toHaveCount(0);

	await statsTab.press('ArrowLeft');
	await expect(testTab).toBeFocused();
	await expect(testTab).toHaveAttribute('aria-selected', 'true');

	await page.getByRole('link', { name: 'Back to layouts' }).click();
	await expect(
		page.getByRole('radiogroup', { name: 'Analyzer' }).getByRole('radio', { name: 'cmini' })
	).toHaveAttribute('aria-checked', 'true');
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
	await page.goto('/layouts/repeat-key');

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

test('removes and reapplies angle mod from the summary card action', async ({ page }) => {
	await page.goto('/layouts/lela');
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
	const requestedPaths: string[] = [];
	page.on('request', (request) => requestedPaths.push(new URL(request.url()).pathname));
	await page.goto('/layouts/QWERTY');

	await page.getByRole('button', { name: 'Quick find layouts' }).click();
	const quickFind = page.getByRole('dialog', { name: 'Quick find' });
	await quickFind.getByRole('combobox', { name: 'Search layout names' }).fill('lela');

	await expect(quickFind.locator('[data-layout-name="lela"]')).toBeVisible();
	expect(requestedPaths).toContain('/layout-names.json');
	expect(requestedPaths.filter((path) => path.startsWith('/layout-details/')).length).toBe(2);
	expect(requestedPaths).not.toContain('/all-layouts.json');
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
