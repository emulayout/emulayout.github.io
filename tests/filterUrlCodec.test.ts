import { describe, expect, test } from 'bun:test';
import {
	decodeViewFilterSnapshot,
	encodeViewFilterSnapshot,
	parseStatLimitsParam
} from '$lib/filterUrlCodec';
import { createDefaultViewSnapshot } from '$lib/filterSnapshot';

describe('view filter URL codec', () => {
	test('omits defaults and restores the canonical default snapshot', () => {
		const defaults = createDefaultViewSnapshot();

		expect(encodeViewFilterSnapshot(defaults)).toBe('');
		expect(decodeViewFilterSnapshot('')).toEqual({ snapshot: defaults });
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
		snapshot.magicKeyFilter = 'excluded';
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
		expect(decoded.snapshot.magicKeyFilter).toBe('excluded');
		expect(decoded.snapshot.characterSetFilter).toBe('international');
		expect(decoded.snapshot.boardTypeFilter).toBe('ortho');
		expect(decoded.snapshot.nameFilterInput).toBe('Canary & Friends');
		expect(decoded.snapshot.nameFilter).toBe('Canary & Friends');
		expect(decoded.snapshot.selectedAuthors).toEqual([12, 34]);
		expect(decoded.snapshot.sortBy).toBe('name');
		expect(decoded.snapshot.sortOrder).toBe('asc');
		expect(decoded.snapshot.sortOrderManual).toBe(true);
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

	test('ignores malformed enum, grid, sort, similarity, and stat-limit values', () => {
		const params = new URLSearchParams({
			include: '00a,99z,xxq,0',
			thumbKeys: 'sometimes',
			magicKey: 'maybe',
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
		expect(snapshot.characterSetFilter).toBe('english');
		expect(snapshot.boardTypeFilter).toBe('all');
		expect(snapshot.sortBy).toBe('date');
		expect(snapshot.sortOrder).toBe('desc');
		expect(snapshot.similarityFilterOperator).toBe('gt');
		expect(snapshot.similarityFilterValue).toBe('50');
		expect(snapshot.similarityMirrorMode).toBe('excluded');
		expect(snapshot.statLimits.likes).toEqual({ operator: 'gt', value: '' });
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
