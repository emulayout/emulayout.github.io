import type { Locator } from '@playwright/test';
import { expect, test } from './fixtures/test';

function savedLayoutTab(creations: Locator, name: string): Locator {
	return creations.getByRole('tab', { name: `${name}. Press Delete to delete this layout.` });
}

test('opens the layout creator from the app bar with practice and keyboard chrome', async ({
	page
}) => {
	await page.goto('/');

	const discoverLink = page.getByRole('link', { name: 'Discover' });
	const createLink = page.getByRole('link', { name: 'Create', exact: true });
	await expect(discoverLink).toHaveAttribute('href', '/');
	await expect(discoverLink).toHaveAttribute('aria-current', 'page');
	await expect(createLink).toHaveAttribute('href', '/create?edit=1');
	await expect(createLink).not.toHaveAttribute('aria-current', 'page');
	await createLink.click();

	await expect(page).toHaveURL('/create?edit=1');
	await expect(page).toHaveTitle('New layout · Emulayout');
	await expect(discoverLink).not.toHaveAttribute('aria-current', 'page');
	await expect(createLink).toHaveAttribute('aria-current', 'page');

	const creations = page.getByRole('tablist', { name: 'Layout creations' });
	const newLayoutTab = creations.getByRole('tab', { name: 'New layout', exact: true });
	await expect(newLayoutTab).toHaveAttribute('aria-selected', 'true');
	await expect(newLayoutTab).toHaveAttribute('aria-controls', 'layout-creator-panel');
	await expect(page.getByRole('button', { name: '+ New layout' })).toHaveCount(0);

	const panel = page.getByRole('tabpanel', { name: 'New layout' });
	await expect(panel).toBeVisible();
	const sectionTabs = panel.getByRole('tablist', { name: 'Layout detail sections' });
	await expect(sectionTabs.getByRole('tab', { name: 'Typing practice' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(sectionTabs.getByRole('tab', { name: 'Layout test area' })).toBeVisible();
	await expect(sectionTabs.getByRole('tab', { name: 'Layout feel' })).toBeVisible();
	await expect(sectionTabs.getByRole('tab', { name: 'Stats' })).toHaveCount(0);
	await expect(panel.getByRole('radiogroup', { name: 'Typing mode' })).toHaveCount(0);
	await expect(panel.getByRole('textbox', { name: 'Typing practice input' })).toBeFocused();
	await expect(panel.locator('[data-practice-word]')).toHaveCount(10);
	await expect(panel.locator('.typing-practice-copy')).toHaveCSS('font-size', '22px');
	await expect(panel.locator('.layout-test-area')).toHaveCSS('height', '40px');
	await expect(panel.getByLabel('Typing practice status')).toHaveCSS('font-size', '14px');
	await expect(panel.getByRole('textbox', { name: 'Layout name' })).toHaveValue('New layout');
	await expect(panel.getByRole('combobox', { name: 'Author name' })).toHaveValue('');
	await expect(panel.getByRole('button', { name: 'Preview' })).toBeVisible();
	await expect(panel.getByRole('group', { name: 'Layout keys' })).toBeVisible();
	await expect(panel.getByRole('combobox', { name: 'Base layout (optional)' })).toBeVisible();
	await expect(panel.getByRole('button', { name: /^Input layout:/ })).toBeVisible();
	await expect(panel.getByRole('button', { name: 'Practice lesson settings' })).toBeVisible();
	await expect(panel.getByRole('button', { name: 'Save layout' })).toBeVisible();
	await expect(panel.getByRole('button', { name: 'Undo changes' })).toHaveCount(0);

	const magicKey = panel.getByRole('button', { name: 'Add magic' });
	const adaptiveKey = panel.getByRole('button', { name: 'Add adaptive' });
	await expect(magicKey).toHaveAttribute('aria-expanded', 'false');
	await expect(adaptiveKey).toHaveAttribute('aria-expanded', 'false');
	await magicKey.click();
	await expect(panel.getByRole('button', { name: 'Hide magic mappings' })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	await expect(panel.locator('[data-keyboard-input-slot="1,11"]')).toHaveCount(0);
	await expect(panel.getByRole('region', { name: 'Magic key mappings' })).toBeVisible();
	await expect(panel.getByRole('combobox', { name: 'Fallback' })).toHaveValue('no-op');
	await expect(panel.getByRole('region', { name: 'Adaptive swap mappings' })).toHaveCount(0);
	await adaptiveKey.click();
	await expect(panel.getByRole('button', { name: 'Hide adaptive mappings' })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	await expect(panel.getByRole('region', { name: 'Adaptive swap mappings' })).toBeVisible();
	await expect(panel.locator('[data-creator-missing-mapping-keys]')).toHaveCount(0);
});

test('keeps editing and custom lessons available when the shared word list fails', async ({
	page
}) => {
	await page.route('**/languages/english1k.json', async (route) => {
		await route.fulfill({ status: 503, body: 'Unavailable' });
	});
	await page.goto('/create?edit=1');

	const panel = page.getByRole('tabpanel', { name: 'New layout' });
	await expect(panel.getByRole('alert')).toHaveText('Unable to load practice words.');
	await expect(panel.getByRole('group', { name: 'Layout keys' })).toBeVisible();

	await panel.getByRole('button', { name: 'Use custom text' }).click();
	const dialog = page.getByRole('dialog', { name: 'Practice lesson' });
	await dialog.getByRole('radio', { name: 'Custom text' }).click();
	await dialog.getByRole('textbox', { name: 'Practice text' }).fill('hello world');
	await dialog.getByRole('button', { name: 'Save' }).click();
	await expect(panel.locator('[data-practice-word]')).toHaveText(['hello', 'world']);

	await panel.getByRole('tab', { name: 'Layout feel' }).click();
	await expect(panel.getByRole('textbox', { name: 'Layout feel input' })).toBeVisible();
	await panel.getByRole('button', { name: 'Preview' }).click();
	await expect(panel.getByRole('textbox', { name: 'Layout feel input' })).toBeVisible();
});

test('warns when a letter is missing from the layout', async ({ page }) => {
	await page.goto('/create?edit=1');
	const panel = page.getByRole('tabpanel', { name: 'New layout' });
	const warning = panel.locator('[data-creator-missing-mapping-keys]');
	await expect(warning).toHaveCount(0);

	await panel.getByRole('textbox', { name: 'Row 2, key 2', exact: true }).fill('');
	await expect(warning).toBeVisible();
	await expect(warning.getByText('Missing from this layout:')).toBeVisible();
	await expect(warning.locator('kbd')).toHaveText('s');

	await panel.getByRole('textbox', { name: 'Row 2, key 2', exact: true }).fill('s');
	await expect(warning).toHaveCount(0);

	await panel.getByRole('button', { name: 'Add magic' }).click();
	await panel.getByRole('textbox', { name: 'Magic trigger' }).fill('#');
	await expect(warning).toHaveCount(0);
});

test('typing @ onto a key adds a magic mapping with repeat fallback', async ({ page }) => {
	await page.goto('/create?edit=1');
	const panel = page.getByRole('tabpanel', { name: 'New layout' });

	await panel.getByRole('textbox', { name: 'Row 1, key 1', exact: true }).fill('@');
	await expect(panel.getByRole('button', { name: 'Hide magic mappings' })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	await expect(panel.getByRole('region', { name: 'Magic key mappings' })).toBeVisible();
	await expect(panel.getByRole('textbox', { name: 'Magic trigger' })).toHaveCount(1);
	await expect(panel.getByRole('textbox', { name: 'Magic trigger' })).toHaveValue('@');
	await expect(panel.getByRole('textbox', { name: 'Preceding' })).toHaveCount(0);
	await expect(panel.getByRole('combobox', { name: 'Fallback' })).toHaveValue('repeat-last');
	await panel.getByRole('button', { name: 'Add mapping' }).click();
	await expect(panel.getByRole('textbox', { name: 'Preceding' })).toHaveCount(1);

	await panel.getByRole('textbox', { name: 'Row 1, key 2', exact: true }).fill('*');
	await expect(panel.getByRole('textbox', { name: 'Magic trigger' })).toHaveCount(2);
	await expect(panel.getByRole('textbox', { name: 'Magic trigger' }).nth(1)).toHaveValue('*');
	await expect(panel.getByRole('combobox', { name: 'Fallback' }).nth(1)).toHaveValue('no-op');

	await panel.getByRole('textbox', { name: 'Row 1, key 1', exact: true }).fill('');
	await expect(panel.getByRole('textbox', { name: 'Magic trigger' })).toHaveCount(2);
	await expect(panel.getByRole('textbox', { name: 'Magic trigger' }).first()).toHaveValue('@');
});

test('selecting a base layout seeds its magic and adaptive mappings', async ({ page }) => {
	await page.goto('/create?edit=1');
	const panel = page.getByRole('tabpanel', { name: 'New layout' });
	const baseLayout = panel.getByRole('combobox', { name: 'Base layout (optional)' });

	await baseLayout.fill('vylet');
	await panel.getByRole('option', { name: 'vylet', exact: true }).click();
	await expect(panel.getByRole('button', { name: 'Hide magic mappings' })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	await expect(panel.getByRole('region', { name: 'Magic key mappings' })).toBeVisible();
	await expect(panel.getByRole('textbox', { name: 'Preceding' }).first()).toHaveValue('c');
	await expect(panel.getByRole('textbox', { name: 'Emit' }).first()).toHaveValue('k');
});

test('applies keyboard options to the edit keyboard', async ({ page }) => {
	await page.goto('/create?edit=1');
	const panel = page.getByRole('tabpanel', { name: 'New layout' });
	const editor = panel.getByRole('group', { name: 'Layout keys' });
	const options = panel.getByRole('group', { name: 'Keyboard options' });
	const nextKeyToggle = options.getByRole('switch', { name: 'Highlight next key' });
	const homeKeyToggle = options.getByRole('switch', { name: 'Color home keys' });
	const practiceWords = panel.locator('[data-practice-word]');
	await expect(practiceWords).toHaveCount(10);
	const targetWord = (await practiceWords.first().textContent())!;
	const nextCharacter = Array.from(targetWord)[0]!;

	await expect(homeKeyToggle).toBeChecked();
	await expect(editor.locator('[data-key-home="true"]')).toHaveCount(8);
	await expect(
		editor.locator('[data-keyboard-input-row="1"] [data-key-char="g"]')
	).not.toHaveAttribute('data-key-home', 'true');
	await homeKeyToggle.uncheck();
	await expect(editor.locator('[data-key-home="true"]')).toHaveCount(0);
	await homeKeyToggle.check();

	await expect(nextKeyToggle).not.toBeChecked();
	await expect(editor.locator('[data-key-next="true"]')).toHaveCount(0);
	await nextKeyToggle.check();
	await expect(editor.locator(`[data-key-char="${nextCharacter}"]`)).toHaveAttribute(
		'data-key-next',
		'true'
	);

	await panel.getByRole('textbox', { name: 'Row 1, key 1', exact: true }).fill('@');
	await expect(options.getByRole('switch', { name: 'Show special keys' })).toBeChecked();
	await expect(editor.locator('[data-key-char="@"]')).toHaveAttribute(
		'data-key-feedback',
		'repeat'
	);
	await panel.getByRole('textbox', { name: 'Row 1, key 2', exact: true }).fill('*');
	await expect(editor.locator('[data-key-char="*"]')).toHaveAttribute('data-key-feedback', 'magic');
});

test('previewing a draft restores the practice keyboard and mapping preview', async ({ page }) => {
	await page.goto('/create?edit=1');
	const panel = page.getByRole('tabpanel', { name: 'New layout' });
	const nameField = panel.getByRole('textbox', { name: 'Layout name' });

	await nameField.fill('Custom draft');
	await expect(page).toHaveTitle('Custom draft · Emulayout');
	await expect(page.getByRole('tab', { name: 'Custom draft', exact: true })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	const namedPanel = page.getByRole('tabpanel', { name: 'Custom draft' });
	await namedPanel.getByRole('combobox', { name: 'Base layout (optional)' }).fill('vylet');
	await namedPanel.getByRole('option', { name: 'vylet', exact: true }).click();
	await expect(namedPanel.getByRole('textbox', { name: 'Preceding' }).first()).toBeVisible();

	await namedPanel.getByRole('button', { name: 'Preview' }).click();
	await expect(namedPanel.getByRole('button', { name: 'Edit' })).toBeVisible();
	await expect(namedPanel.getByRole('heading', { name: 'Custom draft' })).toBeVisible();
	await expect(
		namedPanel.getByRole('img', { name: 'Custom draft keyboard preview' })
	).toBeVisible();
	const previewTabs = namedPanel.getByRole('tablist', { name: 'Layout detail sections' });
	await expect(previewTabs.getByRole('tab', { name: 'Typing practice' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(previewTabs.getByRole('tab', { name: 'Layout test area' })).toBeVisible();
	await expect(previewTabs.getByRole('tab', { name: 'Layout feel' })).toBeVisible();
	await expect(previewTabs.getByRole('tab', { name: 'Stats' })).toHaveCount(0);
	await expect(namedPanel.getByText('Stats unavailable')).toBeVisible();
	await expect(namedPanel.getByText('Local layouts have no analyzer stats.')).toBeVisible();
	await expect(
		namedPanel.getByRole('radiogroup', { name: 'Stats analyzer for Custom draft' })
	).toHaveCount(0);
	await expect(
		namedPanel.getByRole('link', { name: 'See more stats on cminibrowser' })
	).toHaveCount(0);
	await expect(namedPanel.getByRole('radiogroup', { name: 'Typing mode' })).toHaveCount(0);
	await expect(namedPanel.locator('.typing-practice-copy')).toHaveCSS('font-size', '40px');
	await expect(namedPanel.locator('.layout-test-area')).toHaveCSS('height', '72px');
	await expect(namedPanel.getByRole('textbox', { name: 'Layout name' })).toHaveCount(0);
	await expect(namedPanel.getByRole('combobox', { name: 'Author name' })).toHaveCount(0);
	await expect(namedPanel.getByRole('group', { name: 'Layout keys' })).toHaveCount(0);
	await expect(namedPanel.getByRole('combobox', { name: 'Base layout (optional)' })).toHaveCount(0);
	await expect(namedPanel.getByRole('button', { name: 'Hide magic mappings' })).toHaveCount(0);
	await expect(namedPanel.getByRole('textbox', { name: 'Preceding' })).toHaveCount(0);
	await expect(namedPanel.getByRole('combobox', { name: 'Fallback' })).toHaveCount(0);
	await expect(namedPanel.getByRole('region', { name: 'Magic key mappings' })).toBeVisible();
	await expect(namedPanel.getByRole('button', { name: /^Input layout:/ })).toBeVisible();

	await namedPanel.getByRole('button', { name: 'Edit' }).click();
	await expect(namedPanel.getByRole('textbox', { name: 'Layout name' })).toHaveValue(
		'Custom draft'
	);
	await expect(namedPanel.getByRole('group', { name: 'Layout keys' })).toBeVisible();
	await expect(namedPanel.getByRole('textbox', { name: 'Preceding' }).first()).toHaveValue('c');

	await namedPanel.getByRole('button', { name: 'Hide magic mappings' }).click();
	await expect(namedPanel.getByRole('button', { name: 'Show magic mappings' })).toBeVisible();
	await expect(namedPanel.getByRole('region', { name: 'Magic key mappings' })).toHaveCount(0);
	await namedPanel.getByRole('button', { name: 'Preview' }).click();
	await expect(namedPanel.getByRole('region', { name: 'Magic key mappings' })).toBeVisible();
	await expect(namedPanel.getByRole('textbox', { name: 'Preceding' })).toHaveCount(0);
});

test('keeps creator edits in the URL across reload', async ({ page }) => {
	await page.goto('/create?edit=1');
	const panel = page.getByRole('tabpanel', { name: 'New layout' });

	await panel.getByRole('textbox', { name: 'Layout name' }).fill('Shared draft');
	await expect(page).toHaveTitle('Shared draft · Emulayout');
	const namedPanel = page.getByRole('tabpanel', { name: 'Shared draft' });
	await namedPanel.getByRole('combobox', { name: 'Author name' }).fill('derek');
	await expect(page.getByRole('tab', { name: 'Shared draft', exact: true })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await namedPanel.getByRole('textbox', { name: 'Row 1, key 1', exact: true }).fill('w');
	await namedPanel.getByRole('combobox', { name: 'Keyboard type' }).selectOption('ortho');
	await namedPanel.getByRole('button', { name: 'Add magic' }).click();
	await namedPanel.getByRole('textbox', { name: 'Preceding' }).first().fill('c');
	await namedPanel.getByRole('textbox', { name: 'Emit' }).first().fill('k');
	await namedPanel.getByRole('button', { name: 'Add adaptive' }).click();
	await namedPanel.getByRole('button', { name: 'Hide magic mappings' }).click();
	await namedPanel.getByRole('button', { name: 'Hide adaptive mappings' }).click();
	await expect(namedPanel.getByRole('button', { name: 'Show magic mappings' })).toBeVisible();
	await expect(namedPanel.getByRole('button', { name: 'Show adaptive mappings' })).toBeVisible();

	await expect(page).toHaveURL(/\/create\?/);
	await expect(page).toHaveURL(/name=Shared(\+|%20)draft/);
	await expect(page).toHaveURL(/author=derek/);
	await expect(page).toHaveURL(/type=ortho/);
	await expect(page).toHaveURL(/keys=/);
	await expect(page).toHaveURL(/magic=/);
	await expect(page).toHaveURL(/adaptive=1/);

	await page.reload();
	await expect(page).toHaveTitle('Shared draft · Emulayout');
	const restored = page.getByRole('tabpanel', { name: 'Shared draft' });
	await expect(restored.getByRole('textbox', { name: 'Layout name' })).toHaveValue('Shared draft');
	await expect(restored.getByRole('combobox', { name: 'Author name' })).toHaveValue('derek');
	await expect(restored.getByRole('textbox', { name: 'Row 1, key 1', exact: true })).toHaveValue(
		'w'
	);
	await expect(restored.getByRole('combobox', { name: 'Keyboard type' })).toHaveValue('ortho');
	await expect(restored.getByRole('button', { name: 'Hide magic mappings' })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	await expect(restored.getByRole('textbox', { name: 'Preceding' }).first()).toHaveValue('c');
	await expect(restored.getByRole('textbox', { name: 'Emit' }).first()).toHaveValue('k');
	await expect(restored.getByRole('button', { name: 'Hide adaptive mappings' })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
});

test('lets the creator set a custom practice lesson', async ({ page }) => {
	await page.goto('/create?edit=1');
	const panel = page.getByRole('tabpanel', { name: 'New layout' });

	await panel.getByRole('button', { name: 'Practice lesson settings' }).click();
	const dialog = page.getByRole('dialog', { name: 'Practice lesson' });
	await dialog.getByRole('radio', { name: 'Custom text' }).click();
	await dialog.getByRole('textbox', { name: 'Practice text' }).fill('hello creator world');
	await dialog.getByRole('button', { name: 'Save' }).click();

	await expect(page).toHaveURL(/text=hello(\+|%20)creator(\+|%20)world/);
	await expect(panel.locator('[data-practice-word]')).toHaveText(['hello', 'creator', 'world']);
	await expect(dialog).toHaveCount(0);

	await page.reload();
	const restored = page.getByRole('tabpanel', { name: 'New layout' });
	await expect(restored.locator('[data-practice-word]')).toHaveText(['hello', 'creator', 'world']);
});

test('saves layouts locally and switches among them with tabs', async ({ page }) => {
	await page.goto('/create?edit=1');
	const creations = page.getByRole('tablist', { name: 'Layout creations' });
	const panel = page.getByRole('tabpanel', { name: 'New layout' });

	await panel.getByRole('textbox', { name: 'Layout name' }).fill('Alpha');
	const alphaPanel = page.getByRole('tabpanel', { name: 'Alpha' });
	await alphaPanel.getByRole('button', { name: 'Save layout' }).click();

	await expect(page).toHaveURL(/\/create\?id=/);
	await expect(alphaPanel.getByRole('button', { name: 'Duplicate layout' })).toBeVisible();
	await expect(alphaPanel.getByRole('button', { name: 'Undo changes' })).toHaveCount(0);
	await expect(creations.getByRole('tab')).toHaveCount(1);

	await alphaPanel.getByRole('textbox', { name: 'Layout name' }).fill('Alpha edited');
	const editedPanel = page.getByRole('tabpanel', { name: 'Alpha edited' });
	await expect(editedPanel.getByRole('button', { name: 'Update layout' })).toBeVisible();
	await expect(editedPanel.getByRole('button', { name: 'Undo changes' })).toBeVisible();
	await editedPanel.getByRole('button', { name: 'More save options' }).click();
	await page.getByRole('menuitem', { name: 'Save as new layout' }).click();

	await expect(creations.getByRole('tab')).toHaveCount(2);
	await expect(savedLayoutTab(creations, 'Alpha')).toHaveAttribute('aria-selected', 'false');
	await expect(savedLayoutTab(creations, 'Alpha edited')).toHaveAttribute('aria-selected', 'true');
	await expect(editedPanel.getByRole('button', { name: 'Duplicate layout' })).toBeVisible();

	await savedLayoutTab(creations, 'Alpha').click();
	const restoredAlpha = page.getByRole('tabpanel', { name: 'Alpha' });
	await expect(restoredAlpha.getByRole('heading', { name: 'Alpha' })).toBeVisible();
	await expect(restoredAlpha.getByRole('button', { name: 'Edit' })).toBeVisible();
	await expect(savedLayoutTab(creations, 'Alpha')).toHaveAttribute('aria-selected', 'true');

	await savedLayoutTab(creations, 'Alpha edited').click();
	const restoredEdited = page.getByRole('tabpanel', { name: 'Alpha edited' });
	await expect(restoredEdited.getByRole('heading', { name: 'Alpha edited' })).toBeVisible();
	await expect(restoredEdited.getByRole('button', { name: 'Edit' })).toBeVisible();

	await page.getByRole('button', { name: '+ New layout' }).click();
	await expect(creations.getByRole('tab', { name: 'New layout', exact: true })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(savedLayoutTab(creations, 'Alpha')).toBeVisible();
	await expect(savedLayoutTab(creations, 'Alpha edited')).toBeVisible();
	const newPanel = page.getByRole('tabpanel', { name: 'New layout' });
	await expect(newPanel.getByRole('textbox', { name: 'Layout name' })).toHaveValue('New layout');
	await expect(newPanel.getByRole('button', { name: 'Preview' })).toBeVisible();
	await expect(newPanel.getByRole('button', { name: 'Save layout' })).toBeVisible();
	await expect(newPanel.getByRole('button', { name: 'Undo changes' })).toHaveCount(0);
});

test('undoes dirty edits on a saved layout', async ({ page }) => {
	await page.goto('/create?edit=1');
	const panel = page.getByRole('tabpanel', { name: 'New layout' });
	await panel.getByRole('textbox', { name: 'Layout name' }).fill('Alpha');
	const namedPanel = page.getByRole('tabpanel', { name: 'Alpha' });
	await namedPanel.getByRole('button', { name: 'Save layout' }).click();
	await expect(namedPanel.getByRole('button', { name: 'Undo changes' })).toHaveCount(0);

	await namedPanel.getByRole('textbox', { name: 'Layout name' }).fill('Alpha edited');
	const editedPanel = page.getByRole('tabpanel', { name: 'Alpha edited' });
	await expect(editedPanel.getByRole('button', { name: 'Update layout' })).toBeVisible();
	await editedPanel.getByRole('button', { name: 'Undo changes' }).click();

	await expect(namedPanel.getByRole('textbox', { name: 'Layout name' })).toHaveValue('Alpha');
	await expect(namedPanel.getByRole('button', { name: 'Duplicate layout' })).toBeVisible();
	await expect(namedPanel.getByRole('button', { name: 'Update layout' })).toHaveCount(0);
	await expect(namedPanel.getByRole('button', { name: 'Undo changes' })).toHaveCount(0);
	await expect(page).toHaveURL(/\/create\?id=/);
	await expect(page).not.toHaveURL(/name=/);
});

test('duplicates a saved layout into Edit with an incremented name', async ({ page }) => {
	await page.goto('/create?edit=1');
	const creations = page.getByRole('tablist', { name: 'Layout creations' });
	const panel = page.getByRole('tabpanel', { name: 'New layout' });

	await panel.getByRole('textbox', { name: 'Layout name' }).fill('Test 3');
	const namedPanel = page.getByRole('tabpanel', { name: 'Test 3' });
	await namedPanel.getByRole('button', { name: 'Save layout' }).click();
	await namedPanel.getByRole('button', { name: 'Duplicate layout' }).click();

	const copyPanel = page.getByRole('tabpanel', { name: 'Test 4' });
	await expect(copyPanel.getByRole('textbox', { name: 'Layout name' })).toHaveValue('Test 4');
	await expect(copyPanel.getByRole('button', { name: 'Preview' })).toBeVisible();
	await expect(savedLayoutTab(creations, 'Test 3')).toBeVisible();
	await expect(savedLayoutTab(creations, 'Test 4')).toHaveAttribute('aria-selected', 'true');
	await expect(page).toHaveURL(/\/create\?id=/);
	await expect(page).toHaveURL(/edit=1/);
});

test('switches the creator typing area to the layout test area', async ({ page }) => {
	await page.goto('/create?edit=1');
	const panel = page.getByRole('tabpanel', { name: 'New layout' });
	const sectionTabs = panel.getByRole('tablist', { name: 'Layout detail sections' });
	const practiceInput = panel.getByRole('textbox', { name: 'Typing practice input' });
	await practiceInput.press('q');
	await expect(practiceInput).toHaveValue('q');

	await sectionTabs.getByRole('tab', { name: 'Layout test area' }).click();
	await expect(page).toHaveURL(/tab=test/);
	const testField = panel.getByRole('textbox', { name: 'Layout test area' });
	await expect(sectionTabs.getByRole('tab', { name: 'Layout test area' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(testField).toBeVisible();
	await expect(panel.getByRole('textbox', { name: 'Typing practice input' })).toHaveCount(0);
	await expect(panel.locator('[data-practice-word]')).toHaveCount(0);
	await expect(panel.getByRole('button', { name: 'Practice lesson settings' })).toHaveCount(0);
	await expect(panel.getByRole('group', { name: 'Layout keys' })).toBeVisible();
	await expect(panel.getByRole('textbox', { name: 'Layout name' })).toBeVisible();

	await testField.press('q');
	await expect(testField).toHaveValue('q');

	await panel.getByRole('button', { name: 'Preview' }).click();
	await expect(sectionTabs.getByRole('tab', { name: 'Layout test area' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(panel.getByRole('textbox', { name: 'Layout test area' })).toBeVisible();
	await expect(panel.getByRole('group', { name: 'Layout keys' })).toHaveCount(0);
	await panel.getByRole('button', { name: 'Edit' }).click();
	await expect(sectionTabs.getByRole('tab', { name: 'Layout test area' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(panel.getByRole('group', { name: 'Layout keys' })).toBeVisible();

	await page.reload();
	const restoredPanel = page.getByRole('tabpanel', { name: 'New layout' });
	const restoredTabs = restoredPanel.getByRole('tablist', { name: 'Layout detail sections' });
	await expect(page).toHaveURL(/tab=test/);
	await expect(restoredTabs.getByRole('tab', { name: 'Layout test area' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(restoredPanel.getByRole('textbox', { name: 'Layout test area' })).toBeVisible();

	await restoredTabs.getByRole('tab', { name: 'Layout feel' }).click();
	await expect(page).toHaveURL(/tab=feel/);
	await expect(restoredPanel.getByRole('group', { name: 'Layout keys' })).toBeVisible();
	await expect(restoredPanel.getByRole('textbox', { name: 'Layout name' })).toBeVisible();
	await restoredTabs.getByRole('tab', { name: 'Layout test area' }).click();

	await restoredTabs.getByRole('tab', { name: 'Typing practice' }).click();
	await expect(page).not.toHaveURL(/tab=/);
	const restoredInput = restoredPanel.getByRole('textbox', { name: 'Typing practice input' });
	await expect(restoredInput).toBeFocused();
	await expect(restoredInput).toHaveValue('');
	await expect(restoredPanel.getByLabel('Elapsed time: 00:00')).toBeVisible();
	await expect(restoredPanel.getByLabel('0 of 10 words complete')).toBeVisible();
	await expect(panel.getByRole('textbox', { name: 'Layout test area' })).toHaveCount(0);
	await expect(panel.locator('[data-practice-word]')).toHaveCount(10);
	await expect(panel.getByRole('group', { name: 'Layout keys' })).toBeVisible();
});

test('restores an unchecked Adaptive swap after saving and reloading', async ({ page }) => {
	await page.goto('/create?edit=1');
	const panel = page.getByRole('tabpanel', { name: 'New layout' });

	await panel.getByRole('textbox', { name: 'Layout name' }).fill('Disabled swap');
	const namedPanel = page.getByRole('tabpanel', { name: 'Disabled swap' });
	await namedPanel.getByRole('button', { name: 'Add adaptive' }).click();
	await namedPanel.getByRole('textbox', { name: 'Trigger' }).fill('l');
	await namedPanel.getByRole('textbox', { name: 'Left' }).fill('y');
	await namedPanel.getByRole('textbox', { name: 'Right' }).fill('j');
	const enableMapping = namedPanel.getByRole('checkbox', { name: 'Enable mapping' });
	await expect(enableMapping).toBeChecked();
	await enableMapping.uncheck();
	await namedPanel.getByRole('button', { name: 'Save layout' }).click();

	await expect(page).toHaveURL(/\/create\?id=/);
	await expect(namedPanel.getByRole('button', { name: 'Duplicate layout' })).toBeVisible();

	await page.reload();
	const restored = page.getByRole('tabpanel', { name: 'Disabled swap' });
	await expect(restored.getByRole('heading', { name: 'Disabled swap' })).toBeVisible();
	await expect(restored.getByRole('button', { name: 'Edit' })).toBeVisible();
	await restored.getByRole('button', { name: 'Edit' }).click();
	await expect(restored.getByRole('checkbox', { name: 'Enable mapping' })).not.toBeChecked();
	await expect(restored.getByRole('button', { name: 'Duplicate layout' })).toBeVisible();
	await expect(restored.getByRole('button', { name: 'Update layout' })).toHaveCount(0);
});

test('keeps a recoverable URL when browser storage rejects a save', async ({ page }) => {
	await page.addInitScript(() => {
		const setItem = Storage.prototype.setItem;
		Storage.prototype.setItem = function (key: string, value: string) {
			if (key === 'emulayout:saved-layouts') {
				throw new DOMException('Storage unavailable', 'QuotaExceededError');
			}
			return setItem.call(this, key, value);
		};
	});
	await page.goto('/create?edit=1');
	const panel = page.getByRole('tabpanel', { name: 'New layout' });

	await panel.getByRole('textbox', { name: 'Layout name' }).fill('Unsaved recovery');
	const renamedPanel = page.getByRole('tabpanel', { name: 'Unsaved recovery' });
	await renamedPanel.getByRole('button', { name: 'Save layout' }).click();

	await expect(renamedPanel.getByRole('alert')).toContainText('Your draft is still in the URL');
	await expect(page).toHaveURL(/name=Unsaved(\+|%20)recovery/);
	await expect(page).not.toHaveURL(/(?:\?|&)id=/);
	await page.reload();
	await expect(page).toHaveTitle('Unsaved recovery · Emulayout');
});

test('merges saved layouts created in two open tabs', async ({ page, context }) => {
	const secondPage = await context.newPage();
	await Promise.all([page.goto('/create?edit=1'), secondPage.goto('/create?edit=1')]);

	await page.getByRole('textbox', { name: 'Layout name' }).fill('Alpha');
	await page.getByRole('button', { name: 'Save layout' }).click();
	await expect(
		savedLayoutTab(secondPage.getByRole('tablist', { name: 'Layout creations' }), 'Alpha')
	).toBeVisible();

	await secondPage.getByRole('textbox', { name: 'Layout name' }).fill('Beta');
	await secondPage.getByRole('button', { name: 'Save layout' }).click();
	const firstCreations = page.getByRole('tablist', { name: 'Layout creations' });
	const secondCreations = secondPage.getByRole('tablist', { name: 'Layout creations' });
	await expect(savedLayoutTab(secondCreations, 'Alpha')).toBeVisible();
	await expect(savedLayoutTab(secondCreations, 'Beta')).toBeVisible();
	await expect(savedLayoutTab(firstCreations, 'Beta')).toBeVisible();
});

test('preserves dirty edits when another tab deletes the saved layout', async ({
	page,
	context
}) => {
	await page.goto('/create?edit=1');
	await page.getByRole('textbox', { name: 'Layout name' }).fill('Alpha');
	await page.getByRole('button', { name: 'Save layout' }).click();
	const savedUrl = page.url();

	const secondPage = await context.newPage();
	await secondPage.goto(savedUrl);
	await expect(
		savedLayoutTab(secondPage.getByRole('tablist', { name: 'Layout creations' }), 'Alpha')
	).toHaveAttribute('aria-selected', 'true');

	await page.getByRole('textbox', { name: 'Layout name' }).fill('Alpha draft');
	await savedLayoutTab(
		secondPage.getByRole('tablist', { name: 'Layout creations' }),
		'Alpha'
	).press('Delete');
	await secondPage
		.getByRole('dialog', { name: 'Delete layout' })
		.getByRole('button', { name: 'Delete' })
		.click();

	await expect(page.getByRole('tabpanel', { name: 'Alpha draft' })).toBeVisible();
	await expect(page.getByRole('textbox', { name: 'Layout name' })).toHaveValue('Alpha draft');
	await expect(page.getByRole('button', { name: 'Save layout' })).toBeVisible();
	await expect(page).not.toHaveURL(/(?:\?|&)id=/);
	await expect(page).toHaveURL(/name=Alpha(?:\+|%20)draft/);
});

test('deletes a saved layout from its tab', async ({ page }) => {
	await page.goto('/create?edit=1');
	const creations = page.getByRole('tablist', { name: 'Layout creations' });
	const panel = page.getByRole('tabpanel', { name: 'New layout' });

	await panel.getByRole('textbox', { name: 'Layout name' }).fill('Alpha');
	await page.getByRole('button', { name: 'Save layout' }).click();
	await expect(savedLayoutTab(creations, 'Alpha')).toHaveAttribute('aria-selected', 'true');

	await page.getByRole('textbox', { name: 'Layout name' }).fill('Beta');
	await page.getByRole('button', { name: 'More save options' }).click();
	await page.getByRole('menuitem', { name: 'Save as new layout' }).click();
	await expect(savedLayoutTab(creations, 'Beta')).toHaveAttribute('aria-selected', 'true');

	await savedLayoutTab(creations, 'Alpha').focus();
	await savedLayoutTab(creations, 'Alpha').press('Delete');
	const dialog = page.getByRole('dialog', { name: 'Delete layout' });
	await expect(dialog).toContainText('Delete Alpha?');
	await dialog.getByRole('button', { name: 'Delete' }).click();
	await expect(dialog).toHaveCount(0);
	await expect(savedLayoutTab(creations, 'Alpha')).toHaveCount(0);
	await expect(savedLayoutTab(creations, 'Beta')).toHaveAttribute('aria-selected', 'true');

	await savedLayoutTab(creations, 'Beta').press('Delete');
	await page
		.getByRole('dialog', { name: 'Delete layout' })
		.getByRole('button', { name: 'Delete' })
		.click();
	await expect(creations.getByRole('tab', { name: 'New layout', exact: true })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(page).toHaveURL('/create?edit=1');
	await expect(
		page.getByRole('tabpanel', { name: 'New layout' }).getByRole('button', { name: 'Save layout' })
	).toBeVisible();
	await expect(page.getByRole('button', { name: '+ New layout' })).toHaveCount(0);
});

test('preview shows the author on the summary card as plain text', async ({ page }) => {
	await page.goto('/create?edit=1');
	const panel = page.getByRole('tabpanel', { name: 'New layout' });
	const authorField = panel.getByRole('combobox', { name: 'Author name' });

	await authorField.fill('derek');
	await panel.getByRole('button', { name: 'Preview' }).click();
	await expect(panel.getByRole('heading', { name: 'New layout' })).toBeVisible();
	await expect(panel.getByText('derek', { exact: true })).toBeVisible();
	await expect(panel.getByRole('link', { name: 'derek', exact: true })).toHaveCount(0);

	await panel.getByRole('button', { name: 'Edit' }).click();
	await authorField.fill('mini');
	const authorOptions = panel.getByRole('listbox', { name: 'Author name' });
	await expect(authorOptions.getByRole('option')).toHaveCount(1);
	await expect(authorOptions.getByRole('option', { name: 'cmini', exact: true })).toBeVisible();
	await authorOptions.getByRole('option', { name: 'cmini', exact: true }).click();
	await panel.getByRole('button', { name: 'Preview' }).click();
	await expect(panel.getByText('cmini', { exact: true })).toBeVisible();
	await expect(panel.getByRole('link', { name: 'cmini', exact: true })).toHaveCount(0);
});
