import { expect, test as base } from '@playwright/test';
import { authors, catalog, coreCatalog } from './catalog-data';

type CatalogFixtures = {
	catalogVariant: 'full' | 'core';
	catalogRoutes: void;
};

export const test = base.extend<CatalogFixtures>({
	catalogVariant: ['full', { option: true }],
	catalogRoutes: [
		async ({ catalogVariant, page }, use) => {
			const layouts = catalogVariant === 'core' ? coreCatalog : catalog;

			await page.route('**/all-layouts.json', async (route) => {
				await route.fulfill({ json: layouts });
			});
			await page.route('**/authors.json', async (route) => {
				await route.fulfill({ json: authors });
			});

			await use();
		},
		{ auto: true }
	]
});

export { expect };
