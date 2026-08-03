import { expect, test as base } from '@playwright/test';
import { LAYOUT_DETAIL_VERSION, layoutDetailFileId } from '../../../src/lib/layoutDetails';
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

const supplemental = { vylet: vyletSupplemental };

type CatalogFixtures = {
	catalogVariant: 'full' | 'core';
	catalogRoutes: void;
};

export const test = base.extend<CatalogFixtures>({
	catalogVariant: ['full', { option: true }],
	catalogRoutes: [
		async ({ catalogVariant, page }, use) => {
			const layouts = catalogVariant === 'core' ? coreCatalog : catalog;
			const authorById = new Map<number, string>(
				Object.entries(authors).map(([name, id]) => [id, name])
			);

			await page.route('**/all-layouts.json', async (route) => {
				await route.fulfill({ json: layouts });
			});
			await page.route('**/authors.json', async (route) => {
				await route.fulfill({ json: authors });
			});
			await page.route('**/layout-supplemental.json', async (route) => {
				await route.fulfill({ json: supplemental });
			});
			await page.route('**/layout-names.json', async (route) => {
				await route.fulfill({ json: layouts.map((layout) => layout[0]) });
			});
			await page.route('**/layout-details/*.json', async (route) => {
				const filename = new URL(route.request().url()).pathname.split('/').pop();
				const layout = layouts.find(
					(candidate) => `${layoutDetailFileId(candidate[0])}.json` === filename
				);
				if (!layout) {
					await route.fulfill({ status: 404, body: 'Not found' });
					return;
				}
				const name = layout[0];
				await route.fulfill({
					json: {
						version: LAYOUT_DETAIL_VERSION,
						layout,
						authorName: authorById.get(layout[1]) ?? 'Unknown',
						likeCount: 0,
						...(name in supplemental
							? { supplemental: supplemental[name as keyof typeof supplemental] }
							: {}),
						stats: {}
					}
				});
			});

			await use();
		},
		{ auto: true }
	]
});

export { expect };
