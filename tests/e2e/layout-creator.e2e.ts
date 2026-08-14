import { expect, test } from './fixtures/test';

test('opens the layout creator from the app bar with practice and keyboard chrome', async ({
	page
}) => {
	await page.goto('/');

	const discoverLink = page.getByRole('link', { name: 'Discover' });
	const createLink = page.getByRole('link', { name: 'Create', exact: true });
	await expect(discoverLink).toHaveAttribute('href', '/');
	await expect(discoverLink).toHaveAttribute('aria-current', 'page');
	await expect(createLink).toHaveAttribute('href', '/create');
	await expect(createLink).not.toHaveAttribute('aria-current', 'page');
	await createLink.click();

	await expect(page).toHaveURL('/create');
	await expect(page).toHaveTitle('New layout · Emulayout');
	await expect(discoverLink).not.toHaveAttribute('aria-current', 'page');
	await expect(createLink).toHaveAttribute('aria-current', 'page');

	const creations = page.getByRole('tablist', { name: 'Layout creations' });
	const newLayoutTab = creations.getByRole('tab', { name: 'New layout' });
	await expect(newLayoutTab).toHaveAttribute('aria-selected', 'true');
	await expect(newLayoutTab).toHaveAttribute('aria-controls', 'layout-creator-panel');
	await expect(page.getByRole('button', { name: '+ New layout' })).toBeVisible();

	const panel = page.getByRole('tabpanel', { name: 'New layout' });
	await expect(panel).toBeVisible();
	await expect(panel.getByRole('textbox', { name: 'Typing practice input' })).toBeFocused();
	await expect(panel.locator('[data-practice-word]')).toHaveCount(10);
	await expect(panel.getByRole('textbox', { name: 'Layout name' })).toHaveValue('New layout');
	await expect(panel.getByRole('button', { name: 'Preview' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await expect(panel.getByRole('group', { name: 'Layout keys' })).toBeVisible();
	await expect(panel.getByRole('combobox', { name: 'Base layout (optional)' })).toBeVisible();
	await expect(panel.getByRole('button', { name: /^Input layout:/ })).toBeVisible();
	await expect(panel.getByRole('button', { name: 'Practice lesson settings' })).toBeVisible();
	await expect(panel.getByRole('button', { name: 'Save layout' })).toBeVisible();

	const magicKey = panel.getByRole('button', { name: 'Add magic' });
	const adaptiveKey = panel.getByRole('button', { name: 'Add adaptive' });
	await expect(magicKey).toHaveAttribute('aria-pressed', 'false');
	await expect(adaptiveKey).toHaveAttribute('aria-pressed', 'false');
	await magicKey.click();
	await expect(panel.getByRole('button', { name: 'Remove magic key' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(panel.getByRole('region', { name: 'Magic key mappings' })).toBeVisible();
	await expect(panel.getByRole('combobox', { name: 'Fallback' })).toHaveValue('no-op');
	await expect(panel.getByRole('region', { name: 'Adaptive swap mappings' })).toHaveCount(0);
	await adaptiveKey.click();
	await expect(panel.getByRole('button', { name: 'Remove adaptive key' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(panel.getByRole('region', { name: 'Adaptive swap mappings' })).toBeVisible();
});

test('typing @ onto a key adds a magic mapping with repeat fallback', async ({ page }) => {
	await page.goto('/create');
	const panel = page.getByRole('tabpanel', { name: 'New layout' });

	await panel.getByRole('textbox', { name: 'Row 1, key 1' }).fill('@');
	await expect(panel.getByRole('button', { name: 'Remove magic' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(panel.getByRole('region', { name: 'Magic key mappings' })).toBeVisible();
	await expect(panel.getByRole('textbox', { name: 'Magic trigger' })).toHaveCount(1);
	await expect(panel.getByRole('textbox', { name: 'Magic trigger' })).toHaveValue('@');
	await expect(panel.getByRole('textbox', { name: 'Preceding' })).toHaveCount(0);
	await expect(panel.getByRole('combobox', { name: 'Fallback' })).toHaveValue('repeat-last');
	await panel.getByRole('button', { name: 'Add mapping' }).click();
	await expect(panel.getByRole('textbox', { name: 'Preceding' })).toHaveCount(1);

	await panel.getByRole('textbox', { name: 'Row 1, key 2' }).fill('*');
	await expect(panel.getByRole('textbox', { name: 'Magic trigger' })).toHaveCount(2);
	await expect(panel.getByRole('textbox', { name: 'Magic trigger' }).nth(1)).toHaveValue('*');
	await expect(panel.getByRole('combobox', { name: 'Fallback' }).nth(1)).toHaveValue('no-op');

	await panel.getByRole('textbox', { name: 'Row 1, key 1' }).fill('');
	await expect(panel.getByRole('textbox', { name: 'Magic trigger' })).toHaveCount(2);
	await expect(panel.getByRole('textbox', { name: 'Magic trigger' }).first()).toHaveValue('@');
});

test('selecting a base layout seeds its magic and adaptive mappings', async ({ page }) => {
	await page.goto('/create');
	const panel = page.getByRole('tabpanel', { name: 'New layout' });
	const baseLayout = panel.getByRole('combobox', { name: 'Base layout (optional)' });

	await baseLayout.fill('vylet');
	await panel.getByRole('option', { name: 'vylet', exact: true }).click();
	await expect(panel.getByRole('button', { name: 'Remove magic key' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(panel.getByRole('region', { name: 'Magic key mappings' })).toBeVisible();
	await expect(panel.getByRole('textbox', { name: 'Preceding' }).first()).toHaveValue('c');
	await expect(panel.getByRole('textbox', { name: 'Emit' }).first()).toHaveValue('k');
});

test('previewing a draft restores the practice keyboard and mapping preview', async ({ page }) => {
	await page.goto('/create');
	const panel = page.getByRole('tabpanel', { name: 'New layout' });
	const nameField = panel.getByRole('textbox', { name: 'Layout name' });

	await nameField.fill('Custom draft');
	await expect(page).toHaveTitle('Custom draft · Emulayout');
	await expect(page.getByRole('tab', { name: 'Custom draft' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	const namedPanel = page.getByRole('tabpanel', { name: 'Custom draft' });
	await namedPanel.getByRole('combobox', { name: 'Base layout (optional)' }).fill('vylet');
	await namedPanel.getByRole('option', { name: 'vylet', exact: true }).click();
	await expect(namedPanel.getByRole('textbox', { name: 'Preceding' }).first()).toBeVisible();

	await namedPanel.getByRole('button', { name: 'Preview' }).click();
	await expect(namedPanel.getByRole('button', { name: 'Edit' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(namedPanel.getByRole('heading', { name: 'Custom draft' })).toBeVisible();
	await expect(
		namedPanel.getByRole('img', { name: 'Custom draft keyboard preview' })
	).toBeVisible();
	await expect(namedPanel.getByRole('textbox', { name: 'Layout name' })).toHaveCount(0);
	await expect(namedPanel.getByRole('group', { name: 'Layout keys' })).toHaveCount(0);
	await expect(namedPanel.getByRole('combobox', { name: 'Base layout (optional)' })).toHaveCount(0);
	await expect(namedPanel.getByRole('button', { name: 'Remove magic key' })).toHaveCount(0);
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

	await namedPanel.getByRole('button', { name: 'Remove magic key' }).click();
	await expect(namedPanel.getByRole('region', { name: 'Magic key mappings' })).toHaveCount(0);
	await namedPanel.getByRole('button', { name: 'Preview' }).click();
	await expect(namedPanel.getByRole('region', { name: 'Magic key mappings' })).toBeVisible();
	await expect(namedPanel.getByRole('textbox', { name: 'Preceding' })).toHaveCount(0);
});

test('keeps creator edits in the URL across reload', async ({ page }) => {
	await page.goto('/create');
	const panel = page.getByRole('tabpanel', { name: 'New layout' });

	await panel.getByRole('textbox', { name: 'Layout name' }).fill('Shared draft');
	await expect(page).toHaveTitle('Shared draft · Emulayout');
	const namedPanel = page.getByRole('tabpanel', { name: 'Shared draft' });
	await expect(page.getByRole('tab', { name: 'Shared draft' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await namedPanel.getByRole('textbox', { name: 'Row 1, key 1' }).fill('w');
	await namedPanel.getByRole('combobox', { name: 'Keyboard type' }).selectOption('ortho');
	await namedPanel.getByRole('button', { name: 'Add magic' }).click();
	await namedPanel.getByRole('textbox', { name: 'Preceding' }).first().fill('c');
	await namedPanel.getByRole('textbox', { name: 'Emit' }).first().fill('k');
	await namedPanel.getByRole('button', { name: 'Add adaptive' }).click();

	await expect(page).toHaveURL(/\/create\?/);
	await expect(page).toHaveURL(/name=Shared(\+|%20)draft/);
	await expect(page).toHaveURL(/type=ortho/);
	await expect(page).toHaveURL(/keys=/);
	await expect(page).toHaveURL(/magic=/);
	await expect(page).toHaveURL(/adaptive=1/);

	await page.reload();
	await expect(page).toHaveTitle('Shared draft · Emulayout');
	const restored = page.getByRole('tabpanel', { name: 'Shared draft' });
	await expect(restored.getByRole('textbox', { name: 'Layout name' })).toHaveValue('Shared draft');
	await expect(restored.getByRole('textbox', { name: 'Row 1, key 1' })).toHaveValue('w');
	await expect(restored.getByRole('combobox', { name: 'Keyboard type' })).toHaveValue('ortho');
	await expect(restored.getByRole('button', { name: 'Remove magic key' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(restored.getByRole('textbox', { name: 'Preceding' }).first()).toHaveValue('c');
	await expect(restored.getByRole('textbox', { name: 'Emit' }).first()).toHaveValue('k');
	await expect(restored.getByRole('button', { name: 'Remove adaptive key' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('lets the creator set a custom practice lesson', async ({ page }) => {
	await page.goto('/create');
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
	await page.goto('/create');
	const creations = page.getByRole('tablist', { name: 'Layout creations' });
	const panel = page.getByRole('tabpanel', { name: 'New layout' });

	await panel.getByRole('textbox', { name: 'Layout name' }).fill('Alpha');
	const alphaPanel = page.getByRole('tabpanel', { name: 'Alpha' });
	await alphaPanel.getByRole('button', { name: 'Save layout' }).click();

	await expect(page).toHaveURL(/\/create\?id=/);
	await expect(alphaPanel.getByRole('button', { name: 'Duplicate layout' })).toBeVisible();
	await expect(creations.getByRole('tab')).toHaveCount(1);

	await alphaPanel.getByRole('textbox', { name: 'Layout name' }).fill('Alpha edited');
	const editedPanel = page.getByRole('tabpanel', { name: 'Alpha edited' });
	await expect(editedPanel.getByRole('button', { name: 'Update layout' })).toBeVisible();
	await editedPanel.getByRole('button', { name: 'More save options' }).click();
	await page.getByRole('menuitem', { name: 'Save as new layout' }).click();

	await expect(creations.getByRole('tab')).toHaveCount(2);
	await expect(creations.getByRole('tab', { name: 'Alpha' })).toHaveAttribute(
		'aria-selected',
		'false'
	);
	await expect(creations.getByRole('tab', { name: 'Alpha edited' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(editedPanel.getByRole('button', { name: 'Duplicate layout' })).toBeVisible();

	await creations.getByRole('tab', { name: 'Alpha' }).click();
	const restoredAlpha = page.getByRole('tabpanel', { name: 'Alpha' });
	await expect(restoredAlpha.getByRole('textbox', { name: 'Layout name' })).toHaveValue('Alpha');
	await expect(creations.getByRole('tab', { name: 'Alpha' })).toHaveAttribute(
		'aria-selected',
		'true'
	);

	await creations.getByRole('tab', { name: 'Alpha edited' }).click();
	await expect(
		page
			.getByRole('tabpanel', { name: 'Alpha edited' })
			.getByRole('textbox', { name: 'Layout name' })
	).toHaveValue('Alpha edited');

	await page.getByRole('button', { name: '+ New layout' }).click();
	await expect(creations.getByRole('tab', { name: 'New layout' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(creations.getByRole('tab', { name: 'Alpha' })).toBeVisible();
	await expect(creations.getByRole('tab', { name: 'Alpha edited' })).toBeVisible();
	await expect(
		page.getByRole('tabpanel', { name: 'New layout' }).getByRole('button', { name: 'Save layout' })
	).toBeVisible();
});
