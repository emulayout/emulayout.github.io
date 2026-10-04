import { expect, test } from './fixtures/test';

const payload = {
	v: 1,
	format: 'spark/1',
	name: 'Space chiral',
	board: 'ortho',
	layout: {
		keys: [
			{ char: 'a', row: 1, col: 0, finger: 'LP' },
			{ char: 'h', row: 1, col: 5, finger: 'RI' },
			{ char: 'e', row: 0, col: 2, finger: 'LM' },
			{ char: '/', row: 2, col: 9, finger: 'RP' },
			{ char: ' ', row: 3, col: 0, finger: 'LT' }
		],
		magic: {
			chiral_keys: [
				{
					key: ' ',
					same: { kind: 'char', char: 'e' },
					opposite: { kind: 'char', char: 'i' },
					except: ['e']
				},
				{ key: '/', same: { kind: 'char', char: ' ' }, opposite: { kind: 'char', char: ' ' } }
			]
		}
	}
};

test('imports native Space chirals, types them, edits them and retains them on reload', async ({
	page
}) => {
	await page.goto(`/try#akl=${Buffer.from(JSON.stringify(payload)).toString('base64url')}`);
	await page.getByRole('tab', { name: 'Layout test area', exact: true }).click();
	const input = page.getByRole('textbox', { name: 'Layout test area', exact: true });
	for (const [typed, expected] of [
		['a ', 'ae'],
		['h ', 'hi'],
		['a/', 'a '],
		[' ', ' ']
	]) {
		await input.press('Escape');
		await input.pressSequentially(typed);
		await expect(input).toHaveValue(expected);
	}
	await page.getByRole('button', { name: 'Edit', exact: true }).click();
	const editor = page.getByRole('region', { name: 'Chiral mappings', exact: true });
	await expect(editor.getByText('Trigger: Space', { exact: true })).toBeVisible();
	await editor.getByRole('checkbox', { name: 'Enable chiral key Space', exact: true }).uncheck();
	await input.press('Escape');
	await input.pressSequentially('a ');
	await expect(input).toHaveValue('a ');
	await editor.getByRole('checkbox', { name: 'Enable chiral key Space', exact: true }).check();
	await editor.getByRole('textbox', { name: 'Same-hand output', exact: true }).first().fill(' ');
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await page.reload();
	await input.pressSequentially('a ');
	await expect(input).toHaveValue('a ');
});

test('Space chiral takes priority over simulated thumbs and advances only on emitted space', async ({
	page
}) => {
	await page.goto(`/try#akl=${Buffer.from(JSON.stringify(payload)).toString('base64url')}`);
	await expect(page).toHaveURL(/document=/);
	const url = new URL(page.url());
	url.searchParams.set('text', 'ae ae');
	await page.goto(url.toString());
	const panel = page.getByRole('tabpanel', { name: 'Typing practice', exact: true });
	const input = panel.getByRole('textbox', { name: 'Typing practice input', exact: true });
	await panel.getByRole('switch', { name: 'Simulate thumb keys', exact: true }).check();
	await input.pressSequentially('a ');
	await expect(input).toHaveValue('ae');
	await input.press('Space');
	await expect(panel.getByLabel('1 of 2 words complete')).toHaveText('1/2');
	await input.pressSequentially('a');
	await input.press('Space');
	await expect(panel.getByLabel('Typing practice results')).toBeVisible();
	await page.getByRole('tab', { name: 'Layout feel', exact: true }).click();
	const feelPanel = page.getByRole('tabpanel', { name: 'Layout feel', exact: true });
	const feelInput = feelPanel.getByRole('textbox', { name: 'Layout feel input', exact: true });
	await feelInput.press('Escape');
	await feelInput.pressSequentially('a ');
	await expect(feelInput).toHaveValue('a ');
	await feelInput.press('Space');
	await expect(feelPanel.getByLabel('1 of 2 words complete')).toHaveText('1/2');

	// A chiral-emitted separator remains context for the next word's Space trigger.
	url.searchParams.set('text', 'a ea');
	await page.goto(url.toString());
	await input.pressSequentially('a/');
	await expect(panel.getByLabel('1 of 2 words complete')).toHaveText('1/2');
	await input.press('Space');
	await expect(input).toHaveValue('e');
});
