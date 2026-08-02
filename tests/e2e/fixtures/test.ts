import { expect, test as base } from '@playwright/test';
import { validateLayoutSupplemental } from '../../../src/lib/layoutSupplemental';
import { authors, catalog, coreCatalog } from './catalog-data';

const vyletSupplemental = validateLayoutSupplemental({
	schema: 1,
	magicKeys: {
		mappings: {
			'*': {
				c: 'k',
				"'": 'l',
				l: 'l',
				g: 'h',
				p: 't',
				r: 'k',
				s: 'c',
				w: 'r',
				f: 't',
				m: 'b',
				b: 't',
				a: 'x',
				e: 'x',
				i: 'x'
			}
		}
	}
});

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
			await page.route('**/layout-supplemental.json', async (route) => {
				await route.fulfill({ json: { vylet: vyletSupplemental } });
			});

			await use();
		},
		{ auto: true }
	]
});

export { expect };
