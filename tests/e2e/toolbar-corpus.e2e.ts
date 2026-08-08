import { STATS_CORPUS_STORAGE_KEY } from '$lib/statsAnalyzers';
import { expect, test } from './fixtures/test';

test('persists stats corpus selection from the results toolbar', async ({ page }) => {
	await page.goto('/?stats=0&testArea=0&likes=0&newIndicator=0');

	const corpus = page.getByRole('radiogroup', { name: 'Stats corpus' });
	await expect(corpus.getByRole('radio', { name: 'Monkeyracer' })).toBeChecked();

	await corpus.getByRole('radio', { name: 'Reddit' }).click();
	await expect(corpus.getByRole('radio', { name: 'Reddit' })).toBeChecked();
	expect(await page.evaluate((key) => localStorage.getItem(key), STATS_CORPUS_STORAGE_KEY)).toBe(
		'reddit'
	);

	await page.reload();
	await expect(
		page.getByRole('radiogroup', { name: 'Stats corpus' }).getByRole('radio', { name: 'Reddit' })
	).toBeChecked();
});
