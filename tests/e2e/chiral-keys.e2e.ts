import { expect, test } from './fixtures/test';

test('uses teal chiral underlines in practice and feel', async ({ page }) => {
	const rules = [
		{
			key: '/',
			sameKind: 'char',
			sameChar: 'e',
			oppositeKind: 'char',
			oppositeChar: 'i',
			except: 'm'
		}
	];
	const params = new URLSearchParams({
		chiral: `v1:${Buffer.from(JSON.stringify(rules)).toString('base64url')}`,
		text: 'ai he'
	});
	await page.goto(`/create?${params}`);
	for (const name of ['Typing practice', 'Layout feel']) {
		await page.getByRole('tab', { name, exact: true }).click();
		const panel = page.getByRole('tabpanel', { name, exact: true });
		const toggle = panel.getByRole('switch', { name: 'Underline chiral group', exact: true });
		await toggle.check();
		const marked = panel.locator('[data-chiral-group="true"]');
		await expect(marked).toHaveCount(4);
		await expect(panel.locator('[data-magic-group="true"]')).toHaveCount(0);
		const teal = await panel.evaluate((el) => {
			const probe = document.createElement('span');
			probe.style.color = 'var(--chiral-key)';
			el.append(probe);
			const color = getComputedStyle(probe).color;
			probe.remove();
			return color;
		});
		await expect(marked.first()).toHaveCSS('text-decoration-color', teal);
		await toggle.uncheck();
		await expect(marked).toHaveCount(0);
	}
});

test('creates, edits, disables, saves and shares compact chiral keys', async ({ page }) => {
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	await page.goto('/create?edit=1');
	await page.getByRole('textbox', { name: 'Layout name', exact: true }).fill('Chiral test');
	await page.getByRole('button', { name: 'Add chiral', exact: true }).click();
	const editor = page.getByRole('region', { name: 'Chiral mappings', exact: true });
	await editor.getByRole('button', { name: 'Add chiral key', exact: true }).click();
	await editor.getByRole('textbox', { name: 'Trigger key', exact: true }).fill('/');
	await editor.getByRole('combobox', { name: 'Same hand', exact: true }).selectOption('char');
	await editor.getByRole('textbox', { name: 'Same-hand output', exact: true }).fill('e');
	await editor.getByRole('combobox', { name: 'Opposite hand', exact: true }).selectOption('char');
	await editor.getByRole('textbox', { name: 'Opposite-hand output', exact: true }).fill('i');
	await editor.getByRole('textbox', { name: 'Exceptions', exact: true }).fill('m');
	await page.getByRole('tab', { name: 'Layout test area', exact: true }).click();
	const input = page.getByRole('textbox', { name: 'Layout test area', exact: true });
	for (const [text, expected] of [
		['a/', 'ai'],
		['h/', 'he'],
		['m/', 'm/'],
		['/', '/']
	]) {
		await input.press('Escape');
		await input.pressSequentially(text);
		await expect(input).toHaveValue(expected);
	}
	await editor.getByRole('checkbox', { name: 'Enable chiral key /', exact: true }).uncheck();
	await input.press('Escape');
	await input.pressSequentially('a/');
	await expect(input).toHaveValue('a/');
	await editor.getByRole('checkbox', { name: 'Enable chiral key /', exact: true }).check();
	await page.getByRole('textbox', { name: 'Row 2, key 1', exact: true }).fill('h');
	await page.getByRole('textbox', { name: 'Row 2, key 6', exact: true }).fill('a');
	await input.press('Escape');
	await input.pressSequentially('h/');
	await expect(input).toHaveValue('ae');
	await page.getByRole('button', { name: 'Share', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Link copied', exact: true })).toBeVisible();
	const url = await page.evaluate(() => navigator.clipboard.readText());
	expect(new URL(url).searchParams.has('chiral')).toBe(true);
	expect(new URL(url).searchParams.has('magic')).toBe(false);
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveURL(/[?&]id=/);
	await page.reload();
	await input.pressSequentially('h/');
	await expect(input).toHaveValue('ae');
	await page.goto(url);
	await expect(page.getByRole('dialog', { name: 'Shared layout' })).toContainText('Chiral');
});
