import { expect, test } from './fixtures/test';

test('opens the layout creator from the app bar with practice and keyboard chrome', async ({
	page
}) => {
	await page.goto('/');

	const createLink = page.getByRole('link', { name: 'Create layout' });
	await expect(createLink).toHaveAttribute('href', '/create');
	await expect(createLink).not.toHaveAttribute('aria-current', 'page');
	await createLink.click();

	await expect(page).toHaveURL('/create');
	await expect(page).toHaveTitle('Create layout · Emulayout');
	await expect(createLink).toHaveAttribute('aria-current', 'page');

	const creations = page.getByRole('tablist', { name: 'Layout creations' });
	const newLayoutTab = creations.getByRole('tab', { name: 'New layout' });
	await expect(newLayoutTab).toHaveAttribute('aria-selected', 'true');
	await expect(newLayoutTab).toHaveAttribute('aria-controls', 'layout-creator-panel');

	const panel = page.getByRole('tabpanel', { name: 'New layout' });
	await expect(panel).toBeVisible();
	await expect(panel.getByRole('textbox', { name: 'Typing practice input' })).toBeFocused();
	await expect(panel.locator('[data-practice-word]')).toHaveCount(10);
	await expect(panel.getByRole('textbox', { name: 'Layout name' })).toHaveValue('New layout');
	await expect(panel.getByRole('button', { name: 'Lock layout' })).toHaveAttribute(
		'aria-pressed',
		'false'
	);
	await expect(panel.getByRole('group', { name: 'Layout keys' })).toBeVisible();
	await expect(panel.getByRole('combobox', { name: 'Base layout (optional)' })).toBeVisible();
	await expect(panel.getByRole('button', { name: /^Input layout:/ })).toBeVisible();

	const magicKey = panel.getByRole('button', { name: 'Add magic key' });
	const adaptiveKey = panel.getByRole('button', { name: 'Add adaptive key' });
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

test('locking a draft restores the practice keyboard and mapping preview', async ({ page }) => {
	await page.goto('/create');
	const panel = page.getByRole('tabpanel', { name: 'New layout' });
	const nameField = panel.getByRole('textbox', { name: 'Layout name' });

	await nameField.fill('Custom draft');
	await panel.getByRole('combobox', { name: 'Base layout (optional)' }).fill('vylet');
	await panel.getByRole('option', { name: 'vylet', exact: true }).click();
	await expect(panel.getByRole('textbox', { name: 'Preceding' }).first()).toBeVisible();

	await panel.getByRole('button', { name: 'Lock layout' }).click();
	await expect(panel.getByRole('button', { name: 'Unlock layout' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(panel.getByRole('heading', { name: 'Custom draft' })).toBeVisible();
	await expect(panel.getByRole('img', { name: 'Custom draft keyboard preview' })).toBeVisible();
	await expect(panel.getByRole('textbox', { name: 'Layout name' })).toHaveCount(0);
	await expect(panel.getByRole('group', { name: 'Layout keys' })).toHaveCount(0);
	await expect(panel.getByRole('combobox', { name: 'Base layout (optional)' })).toHaveCount(0);
	await expect(panel.getByRole('button', { name: 'Remove magic key' })).toHaveCount(0);
	await expect(panel.getByRole('textbox', { name: 'Preceding' })).toHaveCount(0);
	await expect(panel.getByRole('combobox', { name: 'Fallback' })).toHaveCount(0);
	await expect(panel.getByRole('region', { name: 'Magic key mappings' })).toBeVisible();
	await expect(panel.getByRole('button', { name: /^Input layout:/ })).toBeVisible();

	await panel.getByRole('button', { name: 'Unlock layout' }).click();
	await expect(panel.getByRole('textbox', { name: 'Layout name' })).toHaveValue('Custom draft');
	await expect(panel.getByRole('group', { name: 'Layout keys' })).toBeVisible();
	await expect(panel.getByRole('textbox', { name: 'Preceding' }).first()).toHaveValue('c');
});
