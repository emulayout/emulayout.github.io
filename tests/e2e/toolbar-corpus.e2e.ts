import { STATS_CORPUS_STORAGE_KEY } from '$lib/statsAnalyzers';
import { expect, test } from './fixtures/test';

test('persists stats corpus selection from the results toolbar', async ({ page }) => {
	await page.goto('/?stats=0&testArea=0&likes=0&newIndicator=0');

	const corpus = page.getByRole('combobox', { name: 'Corpus' });
	await expect(corpus).toHaveValue('monkeyracer');

	await corpus.selectOption({ label: 'Reddit' });
	await expect(corpus).toHaveValue('reddit');
	expect(await page.evaluate((key) => localStorage.getItem(key), STATS_CORPUS_STORAGE_KEY)).toBe(
		'reddit'
	);

	await page.reload();
	await expect(page.getByRole('combobox', { name: 'Corpus' })).toHaveValue('reddit');
});
