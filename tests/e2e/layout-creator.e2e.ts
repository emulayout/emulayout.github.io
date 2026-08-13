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
	await adaptiveKey.click();
	await expect(panel.getByRole('button', { name: 'Remove adaptive key' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});
