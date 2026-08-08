import { STATS_CORPUS_STORAGE_KEY } from '$lib/statsAnalyzers';
import { expect, test } from './fixtures/test';

test('persists stats corpus selection in display settings', async ({ page }) => {
	await page.goto('/?stats=0&testArea=0&likes=0&newIndicator=0');

	await page.getByRole('button', { name: 'Settings' }).click();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(dialog).toBeVisible();

	const corpusGroup = dialog.getByRole('group', { name: 'Corpus' });
	await expect(corpusGroup.getByRole('button', { name: 'Monkeyracer' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(dialog.getByText(/Applies only to cmini and Mana2 stats/)).toBeVisible();

	await corpusGroup.getByRole('button', { name: 'Reddit' }).click();
	await expect(corpusGroup.getByRole('button', { name: 'Reddit' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	expect(await page.evaluate((key) => localStorage.getItem(key), STATS_CORPUS_STORAGE_KEY)).toBe(
		'reddit'
	);

	await dialog.getByRole('button', { name: 'Close' }).click();
	await page.reload();
	await page.getByRole('button', { name: 'Settings' }).click();
	await expect(
		page.getByRole('dialog', { name: 'Settings' }).getByRole('button', { name: 'Reddit' })
	).toHaveAttribute('aria-pressed', 'true');
});
