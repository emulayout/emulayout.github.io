import { expect, test } from './fixtures/test';
import { LAYOUT_DETAIL_VERSION } from '../../src/lib/layoutDetails';
import { LAYOUT_TEST_AREA_DISPLAY_OPTIONS_STORAGE_KEY } from '../../src/lib/layoutTestAreaPrefs';
import { adaptivePreview, angleLeftThumb, missingOrthoColumn } from './fixtures/catalog-data';

test.use({ catalogVariant: 'core' });

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

	const testPanel = page.getByRole('tabpanel', { name: 'Layout test area' });
	const testArea = testPanel.getByPlaceholder('Layout test area');
	const preview = testPanel.getByRole('img', { name: 'adaptive-preview keyboard preview' });
	const yKey = preview.locator('[data-key-char="y"]');
	const jKey = preview.locator('[data-key-char="j"]');
	const colorHomeKeysToggle = testPanel.getByRole('switch', { name: 'Color home keys' });
	const showSpecialKeysToggle = testPanel.getByRole('switch', { name: 'Show special keys' });
	const previewToggle = testPanel.getByRole('switch', { name: 'Preview Adaptive swaps' });
	const pathToggle = testPanel.getByRole('switch', { name: 'Show swap paths' });
	const mappings = testPanel.locator('.layout-keyboard-workspace-mappings');
	const swapPath = preview.locator('[data-swap-path="j:y"]');
	const baseBackground = await yKey.evaluate((key) => getComputedStyle(key).backgroundImage);

	await expect(colorHomeKeysToggle).toBeChecked();
	await expect(showSpecialKeysToggle).toBeChecked();
	await expect(mappings).toBeVisible();
	await expect(preview.locator('[data-key-home="true"]')).toHaveCount(8);
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
	await showSpecialKeysToggle.uncheck();
	await expect(mappings).toHaveCount(0);
	await expect(yKey).toHaveText('y');
	await expect(jKey).toHaveText('j');
	await expect(swapPath).toHaveCount(0);
	await showSpecialKeysToggle.check();
	await expect(mappings).toBeVisible();
	await testArea.focus();
	await page.keyboard.press('Escape');
	await page.keyboard.press('l');
	await expect(yKey).toHaveText('j');
	await expect(jKey).toHaveText('y');
	await expect(swapPath).toHaveCount(1);

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

	await colorHomeKeysToggle.uncheck();
	await showSpecialKeysToggle.uncheck();
	expect(
		await page.evaluate(
			(key) => localStorage.getItem(key),
			LAYOUT_TEST_AREA_DISPLAY_OPTIONS_STORAGE_KEY
		)
	).not.toBeNull();
	await page.reload();
	const restoredTestOptions = page
		.getByRole('tabpanel', { name: 'Layout test area' })
		.getByRole('group', { name: 'Keyboard options' });
	await expect(
		restoredTestOptions.getByRole('switch', { name: 'Color home keys' })
	).not.toBeChecked();
	await expect(
		restoredTestOptions.getByRole('switch', { name: 'Show special keys' })
	).not.toBeChecked();
	await expect(
		restoredTestOptions.getByRole('switch', { name: 'Preview Adaptive swaps' })
	).toBeChecked();
	await expect(restoredTestOptions.getByRole('switch', { name: 'Show swap paths' })).toBeChecked();
	await expect(
		page
			.getByRole('tabpanel', { name: 'Layout test area' })
			.locator('.layout-keyboard-workspace-mappings')
	).toHaveCount(0);
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

test.describe('full-catalog keyboard previews', () => {
	test.use({ catalogVariant: 'full' });

	test('uses the shared keyboard workspace in the test area', async ({ page }) => {
		await page.setViewportSize({ width: 1600, height: 900 });
		await page.goto('/layouts/vylet?tab=test');

		const panel = page.getByRole('tabpanel', { name: 'Layout test area' });
		const workspace = panel.locator('.layout-keyboard-workspace');
		const keyboardCluster = panel.locator('.layout-keyboard-workspace-cluster');
		const mappings = panel.locator('.layout-keyboard-workspace-mappings');
		const options = panel.getByRole('group', { name: 'Keyboard options' });
		const testArea = panel.locator('.layout-test-area');
		const preview = panel.getByRole('img', { name: 'vylet keyboard preview' });
		const [workspaceBox, clusterBox, mappingsBox, optionsBox, testAreaBox, previewBox] =
			await Promise.all([
				workspace.boundingBox(),
				keyboardCluster.boundingBox(),
				mappings.boundingBox(),
				options.boundingBox(),
				testArea.boundingBox(),
				preview.boundingBox()
			]);

		expect(workspaceBox).not.toBeNull();
		expect(clusterBox).not.toBeNull();
		expect(mappingsBox).not.toBeNull();
		expect(optionsBox).not.toBeNull();
		expect(testAreaBox).not.toBeNull();
		expect(previewBox).not.toBeNull();
		expect(previewBox!.y).toBeGreaterThan(testAreaBox!.y + testAreaBox!.height);
		expect(mappingsBox!.x).toBeGreaterThanOrEqual(clusterBox!.x + clusterBox!.width);
		expect(Math.abs(mappingsBox!.y - clusterBox!.y)).toBeLessThanOrEqual(1);
		expect(optionsBox!.y).toBeGreaterThanOrEqual(previewBox!.y + previewBox!.height);

		await page.setViewportSize({ width: 700, height: 900 });
		const [narrowWorkspaceBox, narrowClusterBox, narrowMappingsBox] = await Promise.all([
			workspace.boundingBox(),
			keyboardCluster.boundingBox(),
			mappings.boundingBox()
		]);
		expect(narrowWorkspaceBox).not.toBeNull();
		expect(narrowClusterBox).not.toBeNull();
		expect(narrowMappingsBox).not.toBeNull();
		expect(narrowMappingsBox!.y).toBeGreaterThanOrEqual(
			narrowClusterBox!.y + narrowClusterBox!.height
		);
		expect(narrowMappingsBox!.x).toBeCloseTo(narrowWorkspaceBox!.x, 0);
		expect(narrowMappingsBox!.width).toBeCloseTo(narrowWorkspaceBox!.width, 0);
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
		const thumbKey = preview.locator('[data-keyboard-row="3"] [data-key-char="@"]');
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
