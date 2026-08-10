import { describe, expect, test } from 'bun:test';
import {
	goatcounterFilterEvent,
	goatcounterPageviewForNavigation,
	goatcounterPageviewPath,
	goatcounterPracticeSettingEvent,
	goatcounterSortEvent
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

	test('keeps non-default detail tabs without layout names or practice text', () => {
		expect(goatcounterPageviewPath('/layouts/lela', '?tab=stats')).toBe('/layouts?tab=stats');
		expect(goatcounterPageviewPath('/layouts/other', '?tab=test&text=custom')).toBe(
			'/layouts?tab=test'
		);
		expect(goatcounterPageviewPath('/layouts/lela', '?tab=nope')).toBe('/layouts');
	});
});

describe('goatcounterPageviewForNavigation', () => {
	test('counts the initial load and client route changes', () => {
		expect(goatcounterPageviewForNavigation(null, url('/'))).toBe('/');
		expect(goatcounterPageviewForNavigation({ url: null }, url('/layouts/lela'))).toBe('/layouts');
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
