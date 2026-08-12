import { describe, expect, test } from 'bun:test';
import { buildCompactLayoutDetails, layoutDetailFileId } from '../bin/layout-details.js';
import {
	LAYOUT_DETAIL_VERSION,
	buildCatalogLayoutDetail,
	decodeLayoutDetail,
	layoutDetailFileId as clientLayoutDetailFileId,
	layoutDetailUrl,
	resolveLayoutDetailStats,
	type CompactLayoutDetail
} from '$lib/layoutDetails';
import type { CompactLayout } from '$lib/layoutCodec';
import { layoutDetailPageHref, parseLayoutDetailSection } from '$lib/layoutDetailTabs';
import { validateLayoutSupplemental } from '$lib/layoutSupplemental';

const compactLayout: CompactLayout = [
	"dave's_layout:1",
	42,
	2,
	'2026-08-01T00:00:00Z',
	2,
	['a'],
	[0],
	[0]
];

describe('per-layout detail data', () => {
	test('builds and parses canonical detail-tab URLs', () => {
		expect(layoutDetailPageHref('/layouts/Colemak-DH')).toBe('/layouts/Colemak-DH?tab=practice');
		expect(layoutDetailPageHref('/layouts/Colemak-DH', 'test')).toBe(
			'/layouts/Colemak-DH?tab=test'
		);
		expect(layoutDetailPageHref('/layouts/Colemak-DH', 'feel')).toBe(
			'/layouts/Colemak-DH?tab=feel'
		);
		expect(layoutDetailPageHref('/layouts/Colemak-DH', 'stats')).toBe(
			'/layouts/Colemak-DH?tab=stats'
		);
		expect(
			layoutDetailPageHref('/layouts/Colemak-DH', 'practice', {
				customText: 'hello  brave\nworld'
			})
		).toBe('/layouts/Colemak-DH?tab=practice&text=hello+brave+world');
		expect(layoutDetailPageHref('/layouts/Colemak-DH', 'test', { customText: '   ' })).toBe(
			'/layouts/Colemak-DH?tab=test'
		);
		expect(parseLayoutDetailSection('practice')).toBe('practice');
		expect(parseLayoutDetailSection('stats')).toBe('stats');
		expect(parseLayoutDetailSection('test')).toBe('test');
		expect(parseLayoutDetailSection('feel')).toBe('feel');
		expect(parseLayoutDetailSection('unknown')).toBe('practice');
		expect(parseLayoutDetailSection(null)).toBe('practice');
	});

	test('uses the same filesystem-safe id in the generator and browser', () => {
		const name = compactLayout[0];
		expect(layoutDetailFileId(name)).toBe(clientLayoutDetailFileId(name));
		expect(layoutDetailFileId(name)).toMatch(/^[0-9a-f]+$/);
		expect(layoutDetailUrl(name)).toBe(`/layout-details/${layoutDetailFileId(name)}.json`);
	});

	test('merges layout metadata, mappings, and every analyzer into one payload', () => {
		const supplemental = validateLayoutSupplemental({
			schema: 1,
			variants: [
				{
					id: 'current',
					label: 'Current',
					magicKeys: { mappings: { '*': { a: 'b' } } }
				},
				{
					id: 'original',
					label: 'Original',
					outdated: true,
					adaptiveSwaps: { mappings: { a: { b: 'c' } } }
				}
			]
		});
		const [detail] = buildCompactLayoutDetails(
			[compactLayout],
			{ derek: 42 },
			{ [compactLayout[0]]: supplemental },
			{ [compactLayout[0]]: 7 },
			{
				cmini: {
					monkeyracer: { [compactLayout[0]]: [1] },
					reddit: { [compactLayout[0]]: [4] }
				},
				cyanophage: { [compactLayout[0]]: [2] },
				mana2: {
					monkeyracer: { [compactLayout[0]]: [3] },
					reddit: { [compactLayout[0]]: [5] }
				}
			}
		);

		expect(detail).toEqual({
			name: compactLayout[0],
			payload: {
				version: LAYOUT_DETAIL_VERSION,
				layout: compactLayout,
				authorName: 'derek',
				likeCount: 7,
				supplemental,
				stats: {
					cmini: { monkeyracer: [1], reddit: [4] },
					cyanophage: [2],
					mana2: { monkeyracer: [3], reddit: [5] }
				}
			}
		});
	});

	test('decodes a matching payload and rejects a mismatched route name', () => {
		const payload: CompactLayoutDetail = {
			version: LAYOUT_DETAIL_VERSION,
			layout: compactLayout,
			authorName: 'derek',
			likeCount: 7,
			stats: { cmini: { monkeyracer: [1], reddit: [2] } }
		};

		expect(decodeLayoutDetail(payload, compactLayout[0])).toMatchObject({
			authorName: 'derek',
			likeCount: 7,
			stats: { cmini: { monkeyracer: [1], reddit: [2] } },
			layout: { name: compactLayout[0], user: 42 }
		});
		expect(resolveLayoutDetailStats(payload.stats, 'reddit')).toEqual({
			cmini: [2],
			cyanophage: undefined,
			mana2: undefined
		});
		expect(decodeLayoutDetail(payload, 'another-layout')).toBeNull();
	});

	test('builds a preview from an already-loaded catalog without a detail file', () => {
		const decoded = decodeLayoutDetail({
			version: LAYOUT_DETAIL_VERSION,
			layout: compactLayout,
			authorName: 'derek',
			likeCount: 0,
			stats: {}
		});
		expect(decoded).not.toBeNull();
		const layout = decoded!.layout;
		const name = layout.name;

		expect(
			buildCatalogLayoutDetail(
				name,
				{
					layouts: [layout],
					authorsData: { derek: 42 },
					likesData: { [name]: 11 },
					inputProfiles: new Map()
				},
				{
					cmini: { [name]: [9, 8, 7] },
					mana2: { [name]: [1] }
				},
				'reddit'
			)
		).toMatchObject({
			layout,
			authorName: 'derek',
			likeCount: 11,
			stats: {
				cmini: { reddit: [9, 8, 7] },
				mana2: { reddit: [1] }
			}
		});

		expect(
			buildCatalogLayoutDetail('missing', {
				layouts: [layout],
				authorsData: { derek: 42 },
				likesData: {},
				inputProfiles: new Map()
			})
		).toBeNull();
	});
});
