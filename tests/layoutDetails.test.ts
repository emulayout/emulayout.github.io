import { describe, expect, test } from 'bun:test';
import { buildCompactLayoutDetails, layoutDetailFileId } from '../bin/layout-details.js';
import {
	LAYOUT_DETAIL_VERSION,
	decodeLayoutDetail,
	layoutDetailFileId as clientLayoutDetailFileId,
	layoutDetailUrl,
	type CompactLayoutDetail
} from '$lib/layoutDetails';
import type { CompactLayout } from '$lib/layoutCodec';

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
	test('uses the same filesystem-safe id in the generator and browser', () => {
		const name = compactLayout[0];
		expect(layoutDetailFileId(name)).toBe(clientLayoutDetailFileId(name));
		expect(layoutDetailFileId(name)).toMatch(/^[0-9a-f]+$/);
		expect(layoutDetailUrl(name)).toBe(`/layout-details/${layoutDetailFileId(name)}.json`);
	});

	test('merges layout metadata, mappings, and every analyzer into one payload', () => {
		const [detail] = buildCompactLayoutDetails(
			[compactLayout],
			{ derek: 42 },
			{ [compactLayout[0]]: { magicKeys: { '*': { a: 'b' } } } },
			{ [compactLayout[0]]: 7 },
			{
				cmini: { [compactLayout[0]]: [1] },
				cyanophage: { [compactLayout[0]]: [2] },
				mana2: { [compactLayout[0]]: [3] }
			}
		);

		expect(detail).toEqual({
			name: compactLayout[0],
			payload: {
				version: LAYOUT_DETAIL_VERSION,
				layout: compactLayout,
				authorName: 'derek',
				likeCount: 7,
				inputBehavior: { magicKeys: { '*': { a: 'b' } } },
				stats: { cmini: [1], cyanophage: [2], mana2: [3] }
			}
		});
	});

	test('decodes a matching payload and rejects a mismatched route name', () => {
		const payload: CompactLayoutDetail = {
			version: LAYOUT_DETAIL_VERSION,
			layout: compactLayout,
			authorName: 'derek',
			likeCount: 7,
			stats: { cmini: [1] }
		};

		expect(decodeLayoutDetail(payload, compactLayout[0])).toMatchObject({
			authorName: 'derek',
			likeCount: 7,
			stats: { cmini: [1] },
			layout: { name: compactLayout[0], user: 42 }
		});
		expect(decodeLayoutDetail(payload, 'another-layout')).toBeNull();
	});
});
