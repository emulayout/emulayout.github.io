import { describe, expect, test } from 'bun:test';
import { layoutDetailNavigationState, layoutDetailPageHref } from '../src/lib/layoutDetailTabs';

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

describe('layoutDetailNavigationState', () => {
	test('captures the untouched index URL when navigating from the index', () => {
		expect(
			layoutDetailNavigationState({}, '/', { pathname: '/', search: '?selected=lela' })
		).toEqual({ layoutIndexUrl: '/?selected=lela' });
	});

	test('recaptures the current index URL when the index is the current route', () => {
		expect(
			layoutDetailNavigationState({ layoutIndexUrl: '/?selected=lela' }, '/', {
				pathname: '/',
				search: ''
			})
		).toEqual({ layoutIndexUrl: '/' });
	});

	test('carries the captured URL through detail-to-detail navigation', () => {
		expect(
			layoutDetailNavigationState({ layoutIndexUrl: '/?selected=lela' }, '/layouts/[name]', {
				pathname: '/layouts/lela',
				search: '?tab=practice'
			})
		).toEqual({ layoutIndexUrl: '/?selected=lela' });
	});

	test('leaves the URL unset when the chain did not start on the index', () => {
		expect(
			layoutDetailNavigationState({}, '/layouts/[name]', {
				pathname: '/layouts/lela',
				search: '?tab=practice'
			})
		).toEqual({});
		expect(layoutDetailNavigationState({}, null, { pathname: '/', search: '' })).toEqual({});
	});
});
