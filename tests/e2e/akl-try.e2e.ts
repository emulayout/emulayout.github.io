import { expect, test } from './fixtures/test';

function encodeBase64UrlUtf8(value: unknown): string {
	const bytes = new TextEncoder().encode(JSON.stringify(value));
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

test('opens an akl.gg Spark link as an unsaved preview and consumes the hash', async ({ page }) => {
	await page.setViewportSize({ width: 1000, height: 500 });
	const payload = {
		v: 1,
		name: 'Akl handoff',
		author: 'Example author',
		board: 'staggered',
		source: 'https://akl.gg/#example',
		format: 'spark/1',
		layout: {
			keys: [
				{ char: 'q', row: 0, col: 0, finger: 'LP' },
				{ char: 'w', row: 0, col: 1, finger: 'LR' },
				{ char: 'a', row: 1, col: 0, finger: 'LP' },
				{ char: ';', row: 1, col: 9, finger: 'RP' }
			],
			magic: {
				magic_keys: [{ key: ';', default: { kind: 'repeat' }, rules: [{ after: 'q', emit: 'u' }] }]
			}
		}
	};
	await page.goto(`/try#akl=${encodeBase64UrlUtf8(payload)}`);

	await expect(page).toHaveURL(/\/try\?(?=[^#]*name=Akl\+handoff)[^#]+$/);
	await expect(page.getByRole('heading', { name: 'Akl handoff', exact: true })).toBeVisible();
	await expect(page.getByText('Example author', { exact: true })).toBeVisible();
	await expect(page.getByRole('status').filter({ hasText: 'Imported from akl.gg.' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'View on akl.gg' })).toHaveAttribute(
		'href',
		'https://akl.gg/#example'
	);
	await expect(page.getByRole('img', { name: 'Akl handoff keyboard preview' })).toContainText('q');
	await expect(page.getByRole('button', { name: 'Save' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Create', exact: true })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await page.getByRole('button', { name: 'Clear all keys' }).scrollIntoViewIfNeeded();
	expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
	await expect(page.getByRole('button', { name: 'Clear all keys' })).toBeInViewport();

	await page.reload();
	await expect(page.getByRole('heading', { name: 'Akl handoff', exact: true })).toBeVisible();
	await expect(page.getByText('Imported from akl.gg.', { exact: false })).toHaveCount(0);
});

test('reports a nonsensical decoded payload and opens the normal creator', async ({ page }) => {
	await page.goto('/try#akl=e30');
	await expect(page).toHaveURL('/try');
	await expect(
		page.getByRole('status').filter({ hasText: "Couldn't read this akl.gg link." })
	).toBeVisible();
	await expect(page.getByRole('heading', { name: 'New layout', exact: true })).toBeVisible();
});

test('keeps normal key output around imported contextual rules after saving and reloading', async ({
	page
}) => {
	const payload = {
		v: 1,
		name: 'Context import',
		board: 'staggered',
		format: 'spark/1',
		layout: {
			keys: [
				{ char: 'a', row: 1, col: 0, finger: 'LP' },
				{ char: 'b', row: 2, col: 4, finger: 'LI' },
				{ char: '/', row: 2, col: 9, finger: 'RP' },
				{ char: 'x', row: 0, col: 4294967295, finger: 'RP' }
			],
			magic: {
				chiral_keys: [
					{
						key: '/',
						same: { kind: 'char', char: 'e' },
						opposite: { kind: 'char', char: 'i' },
						except: ['b']
					}
				],
				rules: [
					{ inputs: 'ab', output: 'ax' },
					{ inputs: ' b', output: ' x' }
				]
			}
		}
	};
	await page.goto(`/try#akl=${encodeBase64UrlUtf8(payload)}`);
	const notice = page.getByRole('status').filter({ hasText: 'Imported from akl.gg without' });
	await expect(notice).toContainText('keys outside supported keyboard bounds');
	await expect(notice).toContainText('word-start or whitespace-context rules');
	await page.getByRole('tab', { name: 'Layout test area', exact: true }).click();
	const input = page.getByRole('textbox', { name: 'Layout test area', exact: true });
	for (const [keys, expected] of [
		['ab', 'ax'],
		['bb', 'bb'],
		['b/', 'b/'],
		['a/', 'ai']
	]) {
		await input.press('Escape');
		await input.pressSequentially(keys);
		await expect(input).toHaveValue(expected);
	}
	await page.getByRole('button', { name: 'Save', exact: true }).click();
	await expect(page).toHaveURL(/[?&]id=/);
	await page.reload();
	await input.pressSequentially('bb/');
	await expect(input).toHaveValue('bb/');
});
