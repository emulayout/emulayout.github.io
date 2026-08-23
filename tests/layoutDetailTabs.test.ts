import { describe, expect, test } from 'bun:test';
import {
	layoutDetailPageHref,
	layoutDetailPageHrefWithLessonOverrides,
	parseCreatorDetailSection
} from '../src/lib/layoutDetailTabs';

describe('layoutDetailPageHref', () => {
	test('carries custom practice text and drops an unused special-word balance', () => {
		expect(layoutDetailPageHref('/layouts/lela')).toBe('/layouts/lela?tab=practice');
		expect(
			layoutDetailPageHref('/layouts/lela', 'practice', {
				customText: ' hello  world ',
				specialWordsPercent: 40
			})
		).toBe('/layouts/lela?tab=practice&text=hello+world');
		expect(
			layoutDetailPageHref('/layouts/lela', 'practice', {
				customText: null,
				specialWordsPercent: 0,
				wordCount: 25
			})
		).toBe('/layouts/lela?tab=practice&words=25');
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

	test('retains explicitly supplied default lesson overrides', () => {
		expect(
			layoutDetailPageHrefWithLessonOverrides('/layouts/lela', 'practice', {
				specialWordsPercent: 0,
				wordCount: 10
			})
		).toBe('/layouts/lela?tab=practice&special=0&words=10');
	});
});

describe('parseCreatorDetailSection', () => {
	test('keeps Practice, Test, and Feel and maps Stats to Practice', () => {
		expect(parseCreatorDetailSection(null)).toBe('practice');
		expect(parseCreatorDetailSection('test')).toBe('test');
		expect(parseCreatorDetailSection('feel')).toBe('feel');
		expect(parseCreatorDetailSection('stats')).toBe('practice');
		expect(parseCreatorDetailSection('nope')).toBe('practice');
	});
});
