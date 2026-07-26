import { expect, test } from '../fixtures/test';

const lightweightView = '/?stats=0&testArea=0&likes=0&newIndicator=0';

test('combines AND, OR, and exclude key-position filters', async ({ page }) => {
	await page.goto(lightweightView);

	const cards = page.locator('[data-layout-name]');
	const resultsStatus = page.locator('#results-status');

	async function expectVisibleLayouts(expectedNames: string[]) {
		await expect
			.poll(async () =>
				(
					await cards.evaluateAll((elements) =>
						elements.map((element) => element.getAttribute('data-layout-name') ?? '')
					)
				).sort()
			)
			.toEqual([...expectedNames].sort());
		await expect(resultsStatus).toContainText(`Showing ${expectedNames.length} layouts`);
	}

	await page.getByRole('button', { name: 'Include keys (AND)', exact: true }).click();
	const andFilters = page.getByRole('region', { name: 'Include keys (AND)' });
	const andPinkyHome = andFilters.getByRole('textbox', { name: 'Key column 0, row 1' });

	await andPinkyHome.fill('c');
	await expectVisibleLayouts(['lela', 'Megamak']);

	await andPinkyHome.fill('cn');
	await expectVisibleLayouts(['lela', 'Megamak', 'turnip', 'nokwts', 'night', 'graphite']);

	await page.getByRole('button', { name: 'Include keys (OR)', exact: true }).click();
	const orFilters = page.getByRole('region', { name: 'Include keys (OR)' });
	const orLeftIndexHome = orFilters.getByRole('textbox', { name: 'Key column 3, row 1' });
	const orRightMiddleHome = orFilters.getByRole('textbox', { name: 'Key column 7, row 1' });

	await orLeftIndexHome.fill('t');
	await orRightMiddleHome.fill('e');
	await expectVisibleLayouts(['lela', 'Megamak', 'nokwts', 'night']);

	await page.getByRole('button', { name: 'Exclude keys', exact: true }).click();
	const excludeFilters = page.getByRole('region', { name: 'Exclude keys' });
	const excludeRightRingHome = excludeFilters.getByRole('textbox', {
		name: 'Key column 8, row 1'
	});

	await excludeRightRingHome.fill('e');
	await expectVisibleLayouts(['Megamak', 'nokwts']);
	await expect(page).toHaveURL(/(?:\?|&)include=[^&]+(?:&|$)/);
	await expect(page).toHaveURL(/(?:\?|&)includeOr=[^&]+(?:&|$)/);
	await expect(page).toHaveURL(/(?:\?|&)exclude=[^&]+(?:&|$)/);

	await page.reload();

	await page.getByRole('button', { name: /^Include keys \(AND\)/ }).click();
	await page.getByRole('button', { name: /^Include keys \(OR\)/ }).click();
	await page.getByRole('button', { name: /^Exclude keys/ }).click();

	await expect(andPinkyHome).toHaveValue('cn');
	await expect(orLeftIndexHome).toHaveValue('t');
	await expect(orRightMiddleHome).toHaveValue('e');
	await expect(excludeRightRingHome).toHaveValue('e');
	await expectVisibleLayouts(['Megamak', 'nokwts']);
});
