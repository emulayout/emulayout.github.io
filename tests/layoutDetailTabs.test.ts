import { describe, expect, test } from 'bun:test';
import { layoutDetailPageHref } from '../src/lib/layoutDetailTabs';

describe('layoutDetailPageHref', () => {
	test('carries custom practice text and drops an unused special-word balance', () => {
		expect(layoutDetailPageHref('/layouts/lela')).toBe('/layouts/lela?tab=practice');
		expect(
			layoutDetailPageHref('/layouts/lela', 'practice', {
				customText: ' hello  world ',
				specialWordsPercent: 40
			})
		).toBe('/layouts/lela?tab=practice&text=hello+world');
	});

	test('carries the special-word balance only when it is active', () => {
		expect(
			layoutDetailPageHref('/layouts/lela', 'stats', { customText: null, specialWordsPercent: 40 })
		).toBe('/layouts/lela?tab=stats&special=40');
		expect(
			layoutDetailPageHref('/layouts/lela', 'practice', {
				customText: null,
				specialWordsPercent: 0
			})
		).toBe('/layouts/lela?tab=practice');
		expect(
			layoutDetailPageHref('/layouts/lela', 'feel', { customText: null, specialWordsPercent: 40 })
		).toBe('/layouts/lela?tab=feel&special=40');
		expect(
			layoutDetailPageHref('/layouts/lela', 'feel', {
				customText: ' hello  world ',
				specialWordsPercent: 40
			})
		).toBe('/layouts/lela?tab=feel&text=hello+world');
	});
});
