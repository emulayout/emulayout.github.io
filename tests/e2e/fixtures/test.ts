import { expect, test as base } from '@playwright/test';
import { LAYOUT_DETAIL_VERSION, layoutDetailFileId } from '../../../src/lib/layoutDetails';
import { decodeLayout } from '../../../src/lib/layoutCodec';
import { CYANOPHAGE_COMPACT_STAT_FIELD_COUNT } from '../../../src/lib/statsDerivation';
import { authors, catalog, coreCatalog, vylet } from './catalog-data';

const vyletSupplemental = {
	format: 'spark/1',
	layout: {
		keys: Object.entries(decodeLayout(vylet).keys).map(([char, key]) => ({
			char,
			row: key.row,
			col: key.col,
			finger: ['LP', 'LR', 'LM', 'LI', 'LI', 'RI', 'RI', 'RM', 'RR', 'RP'][key.col] ?? 'RP'
		})),
		magic: {
			magic_keys: [
				{
					key: '*',
					rules: Object.entries({
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
					}).map(([after, emit]) => ({ after, emit }))
				}
			]
		}
	}
};

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
			const authorById = new Map<string, string>(
				Object.entries(authors).map(([name, id]) => [String(id), name])
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
			await page.route('**/layout-stats-cyanophage-*.json', async (route) => {
				await route.fulfill({
					json: Object.fromEntries(
						layouts.map((layout) => [
							layout[0],
							Array(CYANOPHAGE_COMPACT_STAT_FIELD_COUNT).fill(10_000)
						])
					)
				});
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
						authorName: authorById.get(String(layout[1])) ?? 'Unknown',
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
