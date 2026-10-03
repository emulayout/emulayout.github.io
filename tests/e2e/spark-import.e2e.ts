import { expect, test } from './fixtures/test';

test('imports pasted Spark keys and mappings, rejects invalid input, and preserves raw rows', async ({
	page
}) => {
	await page.goto('/create?edit=1');
	await page.getByRole('textbox', { name: 'Layout name', exact: true }).fill('Pasted layout');
	const trigger = page.getByRole('button', { name: 'Import', exact: true });
	await trigger.click();
	const dialog = page.getByRole('dialog', { name: 'Import layout' });
	await expect(dialog.getByRole('textbox', { name: 'Layout keys' })).toBeFocused();
	await dialog.getByRole('radio', { name: 'Spark schema/1' }).check();
	const json = dialog.getByRole('textbox', { name: 'Spark JSON' });
	await json.fill('{');
	await expect(dialog.getByRole('alert')).toContainText('valid JSON');
	await expect(dialog.getByRole('button', { name: 'Import', exact: true })).toBeDisabled();
	await json.fill(
		JSON.stringify({
			keys: [
				{ char: 'a', row: 1, col: 0, finger: 'LP' },
				{ char: ';', row: 1, col: 9, finger: 'RP' },
				{ char: '/', row: 2, col: 9, finger: 'RP' }
			],
			magic: {
				magic_keys: [{ key: ';', rules: [{ after: 'a', emit: 'b' }] }],
				adaptive_swaps: [{ trigger: 'n', swap: ['h', 'j'] }],
				chiral_keys: [{ key: '/', opposite: { kind: 'char', char: 'i' } }],
				rules: [{ inputs: 'xy', output: 'z' }]
			}
		})
	);
	await expect(dialog.getByRole('status')).toContainText('raw rules that rewrite');
	await dialog.getByRole('radio', { name: 'Key rows' }).check();
	await dialog.getByRole('textbox', { name: 'Layout keys' }).fill('q w e');
	await dialog.getByRole('radio', { name: 'Spark schema/1' }).check();
	await expect(json).toHaveValue(/magic_keys/);
	await dialog.getByRole('button', { name: 'Import', exact: true }).click();
	await expect(trigger).toBeFocused();
	await expect(page.getByRole('textbox', { name: 'Layout name', exact: true })).toHaveValue(
		'Pasted layout'
	);
	await expect(page.getByRole('textbox', { name: 'Row 1, key 1', exact: true })).toHaveValue('');
	await page.getByRole('tab', { name: 'Layout test area', exact: true }).click();
	const input = page.getByRole('textbox', { name: 'Layout test area', exact: true });
	await input.pressSequentially('a/');
	await expect(input).toHaveValue('ai');
	await input.press('Escape');
	await input.pressSequentially('a;');
	await expect(input).toHaveValue('ab');
	await expect.poll(() => new URL(page.url()).searchParams.has('chiral')).toBe(true);
	await page.reload();
	await input.pressSequentially('a/');
	await expect(input).toHaveValue('ai');
	await trigger.click();
	await dialog.getByRole('radio', { name: 'Spark schema/1' }).check();
	await json.fill('{"keys":[]}');
	await dialog.getByRole('button', { name: 'Cancel' }).click();
	await expect(page.getByRole('textbox', { name: 'Row 2, key 1', exact: true })).toHaveValue('a');
});
