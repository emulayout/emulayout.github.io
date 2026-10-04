import { expect, test } from '../fixtures/test';
import { qwerty } from '../fixtures/catalog-data';

test('filters chirals independently, restores URL state and clears the active chip', async ({
	page
}) => {
	const mapped = structuredClone(qwerty);
	mapped[0] = 'Chiral mapped';
	mapped[4] = Number(mapped[4]) | 2048 | 4096;
	const unknown = structuredClone(qwerty);
	unknown[0] = 'Chiral unknown';
	unknown[4] = Number(unknown[4]) | 2048;
	await page.route('**/all-layouts.json', (route) =>
		route.fulfill({ json: [qwerty, mapped, unknown] })
	);
	await page.goto('/?stats=0&testArea=0&likes=0&newIndicator=0');
	await page.getByRole('button', { name: 'Keyboard filters', exact: true }).click();
	const panel = page.getByRole('region', { name: 'Keyboard filters' });
	const filter = panel.getByLabel('Chiral keys');
	await expect(panel.locator('select')).toHaveCount(6);
	await filter.selectOption('required');
	await expect(page.locator('[data-layout-name]')).toHaveCount(2);
	await expect(page).toHaveURL(/chiralKey=required(?:&|$)/);
	await expect(filter.locator('option')).toHaveCount(3);
	await expect(page.getByRole('heading', { name: 'Chiral mapped', exact: true })).toBeVisible();
	await page.reload();
	await page.getByRole('button', { name: /^Keyboard filters/ }).click();
	await expect(filter).toHaveValue('required');
	await filter.selectOption('excluded');
	await expect(page.getByRole('heading', { name: 'QWERTY', exact: true })).toBeVisible();
	await expect(page.locator('[data-layout-name]')).toHaveCount(1);
	await page.getByRole('button', { name: 'Clear filter: Chiral excluded', exact: true }).click();
	await expect(filter).toHaveValue('optional');
	await expect(page.locator('[data-layout-name]')).toHaveCount(3);
	await expect(page).not.toHaveURL(/chiralKey=/);
});
