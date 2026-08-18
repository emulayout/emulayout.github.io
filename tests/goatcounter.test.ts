import { describe, expect, test } from 'bun:test';
import {
	goatcounterCountRequestUrl,
	goatcounterFilterEvent,
	goatcounterPageTitle,
	goatcounterPageviewForNavigation,
	goatcounterPageviewPath,
	goatcounterPracticeSettingEvent,
	goatcounterSafeReferrer,
	goatcounterSortEvent,
	LAYOUT_CREATOR_TITLE,
	LAYOUT_SHOW_TITLE,
	LAYOUTS_INDEX_TITLE
} from '../src/lib/goatcounter';

function url(pathname: string, search = '') {
	return { url: { pathname, search } };
}

describe('goatcounterPageviewPath', () => {
	test('strips index filter, display, and share query params', () => {
		expect(goatcounterPageviewPath('/', '?analyzer=cmini&sfbMax=2&viewName=Home')).toBe('/');
		expect(goatcounterPageviewPath('/', '?selected=lela&view=abc')).toBe('/');
	});

	test('collapses show pages and drops default practice tab', () => {
		expect(goatcounterPageviewPath('/layouts/lela')).toBe('/layouts');
		expect(goatcounterPageviewPath('/layouts/lela', '?tab=practice')).toBe('/layouts');
		expect(goatcounterPageviewPath('/layouts/other', '?tab=practice&text=hello+world')).toBe(
			'/layouts'
		);
	});

	test('keeps the layout creator path', () => {
		expect(goatcounterPageviewPath('/create')).toBe('/create');
		expect(goatcounterPageviewPath('/create', '?draft=ignored')).toBe('/create');
		expect(goatcounterPageviewPath('/create', '?name=Shared+draft&keys=v1:m;0,0::w')).toBe(
			'/create'
		);
		expect(goatcounterPageviewPath('/create', '?text=hello+world&special=40')).toBe('/create');
		expect(goatcounterPageviewPath('/create', '?id=layout-uuid&name=Shared+draft')).toBe('/create');
	});

	test('keeps non-default detail tabs without layout names or practice text', () => {
		expect(goatcounterPageviewPath('/layouts/lela', '?tab=stats')).toBe('/layouts?tab=stats');
		expect(goatcounterPageviewPath('/layouts/other', '?tab=test&text=custom')).toBe(
			'/layouts?tab=test'
		);
		expect(goatcounterPageviewPath('/layouts/lela', '?tab=feel')).toBe('/layouts?tab=feel');
		expect(goatcounterPageviewPath('/layouts/lela', '?tab=nope')).toBe('/layouts');
	});
});

describe('goatcounterPageviewForNavigation', () => {
	test('counts the initial load and client route changes', () => {
		expect(goatcounterPageviewForNavigation(null, url('/'))).toBe('/');
		expect(goatcounterPageviewForNavigation({ url: null }, url('/layouts/lela'))).toBe('/layouts');
		expect(goatcounterPageviewForNavigation({ url: null }, url('/create'))).toBe('/create');
		expect(goatcounterPageviewForNavigation(null, { url: null })).toBeNull();
		expect(goatcounterPageviewForNavigation(url('/'), url('/layouts/lela', '?tab=practice'))).toBe(
			'/layouts'
		);
		expect(
			goatcounterPageviewForNavigation(
				url('/layouts/lela', '?tab=practice'),
				url('/layouts/lela', '?tab=stats')
			)
		).toBe('/layouts?tab=stats');
	});

	test('ignores same-page query churn and layout-to-layout show navigations', () => {
		expect(
			goatcounterPageviewForNavigation(url('/', '?analyzer=cmini'), url('/', '?sfbMax=2'))
		).toBeNull();
		expect(
			goatcounterPageviewForNavigation(url('/layouts/lela'), url('/layouts/graphite'))
		).toBeNull();
		expect(
			goatcounterPageviewForNavigation(
				url('/layouts/lela', '?tab=stats'),
				url('/layouts/lela', '?tab=stats&text=hello')
			)
		).toBeNull();
	});
});

describe('goatcounterPageTitle', () => {
	test('uses Layouts index, Layout show, and Layout creator without layout names', () => {
		expect(goatcounterPageTitle('/', '?analyzer=cmini')).toBe(LAYOUTS_INDEX_TITLE);
		expect(goatcounterPageTitle('/layouts/lela', '?tab=practice&text=hello')).toBe(
			LAYOUT_SHOW_TITLE
		);
		expect(goatcounterPageTitle('/layouts/lela', '?tab=stats')).toBe(LAYOUT_SHOW_TITLE);
		expect(goatcounterPageTitle('/create')).toBe(LAYOUT_CREATOR_TITLE);
	});
});

describe('goatcounterSafeReferrer', () => {
	test('keeps cross-origin referrers and drops same-origin URLs', () => {
		expect(
			goatcounterSafeReferrer(
				'https://www.google.com/search?q=emulayout',
				'https://emulayout.github.io'
			)
		).toBe('https://www.google.com/search?q=emulayout');
		expect(
			goatcounterSafeReferrer(
				'https://emulayout.github.io/layouts/lela?tab=practice&text=hello+world',
				'https://emulayout.github.io'
			)
		).toBe('');
		expect(goatcounterSafeReferrer('not a url', 'https://emulayout.github.io')).toBe('');
	});
});

describe('goatcounterCountRequestUrl', () => {
	test('removes location.search while keeping the sanitized path and title', () => {
		const href = goatcounterCountRequestUrl(
			'https://emulayout.goatcounter.com/count?p=%2Flayouts&q=%3Ftab%3Dpractice%26text%3Dhello&t=Layout+show&r=https%3A%2F%2Fwww.google.com%2F'
		);
		const url = new URL(href);
		expect(url.searchParams.has('q')).toBe(false);
		expect(url.searchParams.get('p')).toBe('/layouts');
		expect(url.searchParams.get('t')).toBe(LAYOUT_SHOW_TITLE);
		expect(url.searchParams.get('r')).toBe('https://www.google.com/');
	});
});

describe('goatcounter feature event names', () => {
	test('names filters and sorts without values', () => {
		expect(goatcounterFilterEvent('name')).toBe('filter-name');
		expect(goatcounterFilterEvent('stat-sfb')).toBe('filter-stat-sfb');
		expect(goatcounterSortEvent('cyano-sfb')).toBe('sort-cyano-sfb');
	});

	test('names practice settings from option keys', () => {
		expect(goatcounterPracticeSettingEvent('highlightNextKey')).toBe(
			'practice-setting-highlight-next-key'
		);
		expect(goatcounterPracticeSettingEvent('showAdaptiveSwaps')).toBe(
			'practice-setting-show-adaptive-swaps'
		);
	});
});
