import { describe, expect, test } from 'bun:test';
import {
	decodeViewFilterSnapshot,
	encodeViewFilterSnapshot,
	parseStatLimitsParam,
	readViewFilterUrlState,
	writeViewFilterUrlState
} from '$lib/filterUrlCodec';
import { createDefaultViewSnapshot } from '$lib/filterSnapshot';

describe('view filter URL codec', () => {
	test('omits defaults and restores the canonical default snapshot', () => {
		const defaults = createDefaultViewSnapshot();

		expect(encodeViewFilterSnapshot(defaults)).toBe('');
		expect(decodeViewFilterSnapshot('')).toEqual({ snapshot: defaults });
	});

	test('replaces view-owned parameters while preserving unrelated URL state', () => {
		const params = new URLSearchParams({
			selected: 'Colemak,Canary',
			analyzer: 'mana2',
			include: '00x',
			exclude: '00z',
			similar: 'Stale'
		});
		const snapshot = createDefaultViewSnapshot();
		snapshot.appliedIncludeGrid[0][0] = 'a';
		snapshot.showUnfinished = true;

		writeViewFilterUrlState(params, snapshot);

		expect(params.get('selected')).toBe('Colemak,Canary');
		expect(params.get('analyzer')).toBe('mana2');
		expect(params.get('include')).toBe('00a');
		expect(params.get('showUnfinished')).toBe('1');
		expect(params.has('exclude')).toBe(false);
		expect(params.has('similar')).toBe(false);
	});

	test('round-trips applied filters and sorted source membership', () => {
		const snapshot = createDefaultViewSnapshot();
		snapshot.appliedIncludeGrid[0][0] = 'a';
		snapshot.appliedExcludeGrid[2][9] = 'z';
		snapshot.appliedIncludeOrGrid[1][4] = 'th';
		snapshot.appliedIncludeLeftThumbKeys = ['e', 't', '', ''];
		snapshot.appliedIncludeOrRightThumbKeys = ['n', '', '', ''];
		snapshot.showUnfinished = true;
		snapshot.thumbKeyFilter = 'required';
		snapshot.magicKeyFilter = 'required-mapped';
		snapshot.repeatKeyFilter = 'required';
		snapshot.adaptiveSwapFilter = 'required';
		snapshot.characterSetFilter = 'international';
		snapshot.boardTypeFilter = 'ortho';
		snapshot.nameFilter = 'Canary & Friends';
		snapshot.selectedAuthors = [12, 34];
		snapshot.sortBy = 'name';
		snapshot.sortOrder = 'asc';
		snapshot.similarReferenceName = 'Graphite';
		snapshot.similarityFilterOperator = 'lt';
		snapshot.appliedSimilarityFilterValue = '72.5';
		snapshot.similarityWeightHomeKeys = true;
		snapshot.similarReferenceAnglemod = true;
		snapshot.similarityMirrorMode = 'required';
		snapshot.appliedStatLimits.likes = { operator: 'gt', value: '10' };

		const decoded = decodeViewFilterSnapshot(
			encodeViewFilterSnapshot(snapshot, {
				sourceLayoutNames: ['Zulu', ' Canary ', 'Alpha']
			})
		);

		expect(decoded.sourceLayoutNames).toEqual(['Alpha', 'Canary', 'Zulu']);
		expect(decoded.snapshot.includeGrid[0][0]).toBe('a');
		expect(decoded.snapshot.appliedIncludeGrid[0][0]).toBe('a');
		expect(decoded.snapshot.excludeGrid[2][9]).toBe('z');
		expect(decoded.snapshot.includeOrGrid[1][4]).toBe('th');
		expect(decoded.snapshot.includeLeftThumbKeys).toEqual(['e', 't', '', '']);
		expect(decoded.snapshot.includeOrRightThumbKeys).toEqual(['n', '', '', '']);
		expect(decoded.snapshot.showUnfinished).toBe(true);
		expect(decoded.snapshot.thumbKeyFilter).toBe('required');
		expect(decoded.snapshot.magicKeyFilter).toBe('required-mapped');
		expect(decoded.snapshot.repeatKeyFilter).toBe('required');
		expect(decoded.snapshot.adaptiveSwapFilter).toBe('required');
		expect(decoded.snapshot.characterSetFilter).toBe('international');
		expect(decoded.snapshot.boardTypeFilter).toBe('ortho');
		expect(decoded.snapshot.nameFilterInput).toBe('Canary & Friends');
		expect(decoded.snapshot.nameFilter).toBe('Canary & Friends');
		expect(decoded.snapshot.selectedAuthors).toEqual([12, 34]);
		expect(decoded.snapshot.sortBy).toBe('name');
		expect(decoded.snapshot.sortOrder).toBe('asc');
		expect(decoded.snapshot.sortOrderManual).toBe(false);
		expect(decoded.snapshot.similarReferenceName).toBe('Graphite');
		expect(decoded.snapshot.similarityFilterOperator).toBe('lt');
		expect(decoded.snapshot.similarityFilterValue).toBe('72.5');
		expect(decoded.snapshot.appliedSimilarityFilterValue).toBe('72.5');
		expect(decoded.snapshot.similarityWeightHomeKeys).toBe(true);
		expect(decoded.snapshot.similarReferenceAnglemod).toBe(true);
		expect(decoded.snapshot.similarityMirrorMode).toBe('required');
		expect(decoded.snapshot.statLimits.likes).toEqual({ operator: 'gt', value: '10' });
		expect(decoded.snapshot.appliedStatLimits.likes).toEqual({ operator: 'gt', value: '10' });
	});

	test('preserves an explicit non-similarity sort while similarity is active', () => {
		const snapshot = createDefaultViewSnapshot();
		snapshot.similarReferenceName = 'Canary';
		snapshot.sortBy = 'date';
		snapshot.sortOrder = 'desc';

		const encoded = encodeViewFilterSnapshot(snapshot);
		const decoded = decodeViewFilterSnapshot(encoded);

		expect(new URLSearchParams(encoded).get('sort')).toBe('date');
		expect(decoded.snapshot.sortBy).toBe('date');
		expect(decoded.snapshot.sortOrder).toBe('desc');
	});

	test('drops similarity sorting when no reference layout exists', () => {
		const decoded = decodeViewFilterSnapshot('sort=similarity&order=asc');

		expect(decoded.snapshot.similarReferenceName).toBeNull();
		expect(decoded.snapshot.sortBy).toBe('date');
		expect(decoded.snapshot.sortOrder).toBe('asc');
		expect(encodeViewFilterSnapshot(decoded.snapshot)).toBe('sort=date&order=asc');
	});

	test('does not encode similarity sorting without a reference layout', () => {
		const snapshot = createDefaultViewSnapshot();
		snapshot.sortBy = 'similarity';

		expect(encodeViewFilterSnapshot(snapshot)).toBe('');
	});

	test('uses the selected field default when canonical sort order is omitted', () => {
		const { snapshot } = readViewFilterUrlState(new URLSearchParams({ sort: 'cyano-effort' }));

		expect(snapshot.sortBy).toBe('cyano-effort');
		expect(snapshot.sortOrder).toBe('asc');
		expect(snapshot.sortOrderManual).toBe(false);
	});

	test('ignores malformed enum, grid, sort, similarity, and stat-limit values', () => {
		const params = new URLSearchParams({
			include: '00a,99z,xxq,0',
			thumbKeys: 'sometimes',
			magicKey: 'maybe',
			repeatKey: 'maybe',
			adaptiveSwap: 'maybe',
			characterSet: 'emoji',
			boardType: 'curved',
			sort: 'unknown',
			order: 'sideways',
			similar: 'Canary',
			similarFilter: 'eq:50',
			similarMirror: 'maybe',
			statLimits: 'likes:eq:10,unknown:lt:2'
		});

		const { snapshot } = decodeViewFilterSnapshot(params.toString());

		expect(snapshot.includeGrid[0][0]).toBe('a');
		expect(snapshot.includeGrid.flat().filter(Boolean)).toEqual(['a']);
		expect(snapshot.thumbKeyFilter).toBe('optional');
		expect(snapshot.magicKeyFilter).toBe('optional');
		expect(snapshot.repeatKeyFilter).toBe('optional');
		expect(snapshot.adaptiveSwapFilter).toBe('optional');
		expect(snapshot.characterSetFilter).toBe('english');
		expect(snapshot.boardTypeFilter).toBe('all');
		expect(snapshot.sortBy).toBe('similarity');
		expect(snapshot.sortOrder).toBe('desc');
		expect(snapshot.similarityFilterOperator).toBe('gt');
		expect(snapshot.similarityFilterValue).toBe('50');
		expect(snapshot.similarityMirrorMode).toBe('excluded');
		expect(snapshot.statLimits.likes).toEqual({ operator: 'gt', value: '' });
	});

	test('ignores obsolete URL aliases and preserves explicit empty sources', () => {
		const decoded = readViewFilterUrlState(
			new URLSearchParams({
				includeThumbs: 'e|t',
				excludeThumbs: 'n',
				showUnfinished: 'true',
				sort: 'rtl-desc',
				similar: 'Canary',
				similarMirror: 'include',
				layouts: ''
			})
		);

		expect(decoded.snapshot.includeLeftThumbKeys).toEqual(['', '', '', '']);
		expect(decoded.snapshot.excludeLeftThumbKeys).toEqual(['', '', '', '']);
		expect(decoded.snapshot.showUnfinished).toBe(false);
		expect(decoded.snapshot.sortBy).toBe('similarity');
		expect(decoded.snapshot.similarityMirrorMode).toBe('excluded');
		expect(decoded.sourceLayoutNames).toBeNull();
	});
});

describe('stat-limit URL parsing', () => {
	test('keeps valid limits, including values containing colons', () => {
		const limits = parseStatLimitsParam(
			'likes:gt:10,cyano-sfb:lt:1.5,likes:gt:value:with:colons,unknown:lt:5'
		);

		expect(limits.likes).toEqual({ operator: 'gt', value: 'value:with:colons' });
		expect(limits['cyano-sfb']).toEqual({ operator: 'lt', value: '1.5' });
		expect('unknown' in limits).toBe(false);
	});
});
