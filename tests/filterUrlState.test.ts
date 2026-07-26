import { describe, expect, test } from 'bun:test';
import {
	hasSavedViewFilterUrlOverrides,
	readGlobalFilterUrlState,
	writeGlobalFilterUrlState,
	writeSavedViewUrlState
} from '$lib/filterUrlState';

describe('saved-view URL ownership', () => {
	test('does not treat global URL state as a saved-view filter override', () => {
		const params = new URLSearchParams({
			view: 'my-view',
			selected: 'Colemak,Canary',
			analyzer: 'cyanophage',
			stats: '0',
			testArea: '0',
			likes: '0',
			newIndicator: '0',
			stickySimilar: '0'
		});

		expect(hasSavedViewFilterUrlOverrides(params)).toBe(false);
	});

	test('recognizes filter and source overrides', () => {
		expect(hasSavedViewFilterUrlOverrides(new URLSearchParams({ include: '00a' }))).toBe(true);
		expect(hasSavedViewFilterUrlOverrides(new URLSearchParams({ layouts: 'Canary' }))).toBe(true);
	});

	test('encodes dirty saved-view source selections', () => {
		const selected = new URLSearchParams();
		writeSavedViewUrlState(selected, 'my-view', ['Canary', 'Colemak']);
		expect(selected.get('view')).toBe('my-view');
		expect(selected.get('layouts')).toBe('Canary,Colemak');

		const cleared = new URLSearchParams();
		writeSavedViewUrlState(cleared, 'my-view', null);
		expect(cleared.has('layouts')).toBe(true);
		expect(cleared.get('layouts')).toBe('');
	});
});

describe('global filter URL state', () => {
	test('round-trips global settings alongside a clean saved view', () => {
		const params = new URLSearchParams({ view: 'my-view' });

		writeGlobalFilterUrlState(params, {
			statsAnalyzer: 'cyanophage',
			hideLayoutStats: true,
			hideLayoutTestArea: true,
			hideLayoutLikes: true,
			hideNewLayoutIndicator: true,
			stickySimilarityCard: false,
			selectedLayoutNames: ['Colemak', 'Canary']
		});

		expect(params.get('view')).toBe('my-view');
		expect(params.get('selected')).toBe('Colemak,Canary');
		expect(readGlobalFilterUrlState(params)).toEqual({
			statsAnalyzer: 'cyanophage',
			hideLayoutStats: true,
			hideLayoutTestArea: true,
			hideLayoutLikes: true,
			hideNewLayoutIndicator: true,
			stickySimilarityCard: false,
			selectedLayoutNames: ['Colemak', 'Canary']
		});
	});

	test('omits default global settings', () => {
		const params = new URLSearchParams({
			analyzer: 'mana2',
			stats: '0',
			selected: 'Canary'
		});

		writeGlobalFilterUrlState(params, {
			statsAnalyzer: 'cmini',
			hideLayoutStats: false,
			hideLayoutTestArea: false,
			hideLayoutLikes: false,
			hideNewLayoutIndicator: false,
			stickySimilarityCard: true,
			selectedLayoutNames: []
		});

		expect(params.toString()).toBe('');
	});
});
