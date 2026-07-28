import { describe, expect, test } from 'bun:test';
import {
	chipSourceFromViewSnapshot,
	clearActiveFilterChip,
	getActiveFilterChips,
	type ActiveFilterClearTarget
} from '$lib/activeFilterChips';
import { createDefaultViewSnapshot } from '$lib/filterSnapshot';

describe('active filter chips', () => {
	test('builds chip models from a view snapshot and source selection', () => {
		const snapshot = createDefaultViewSnapshot();
		snapshot.nameFilter = 'Canary';
		snapshot.selectedAuthors = [12, 34];
		snapshot.boardTypeFilter = 'ortho';
		snapshot.magicKeyFilter = 'required-mapped';
		snapshot.appliedIncludeGrid[0][0] = 'a';
		snapshot.appliedStatLimits['cyano-sfb'] = { operator: 'lt', value: '1.5' };
		snapshot.similarReferenceName = 'Graphite';
		snapshot.appliedSimilarityFilterValue = '70';

		const chips = getActiveFilterChips(
			chipSourceFromViewSnapshot(snapshot, { sourceLayoutNames: ['Canary'] })
		);

		expect(chips.map(({ id }) => id)).toEqual([
			'source',
			'name',
			'authors',
			'magic',
			'board',
			'keys-and',
			'stat-cyano-sfb',
			'similarity'
		]);
		expect(chips.find(({ id }) => id === 'source')).toMatchObject({
			label: 'Source: custom selection',
			title: '1 layout',
			focus: { target: 'source' }
		});
		expect(chips.find(({ id }) => id === 'stat-cyano-sfb')).toMatchObject({
			label: 'SFB < 1.5%',
			tone: 'cyanophage',
			focus: {
				target: 'stats',
				section: 'general',
				analyzer: 'cyanophage',
				key: 'cyano-sfb'
			}
		});
		expect(chips.find(({ id }) => id === 'similarity')?.label).toBe('Similarity > 70%');
		expect(chips.find(({ id }) => id === 'magic')?.label).toBe('Magic: known mappings');
	});

	test('routes every clear action to its owning store mutation', () => {
		const calls: string[] = [];
		const target: ActiveFilterClearTarget = {
			clearSourceSelection: () => calls.push('source'),
			setNameFilter: (value) => calls.push(`name:${value}`),
			clearAuthors: () => calls.push('authors'),
			setThumbKeyFilter: (value) => calls.push(`thumbs:${value}`),
			setMagicKeyFilter: (value) => calls.push(`magic:${value}`),
			setBoardTypeFilter: (value) => calls.push(`board:${value}`),
			setCharacterSetFilter: (value) => calls.push(`charset:${value}`),
			setShowUnfinished: (value) => calls.push(`unfinished:${value}`),
			clearInclude: () => calls.push('keys:and'),
			clearIncludeOr: () => calls.push('keys:or'),
			clearExclude: () => calls.push('keys:exclude'),
			clearStatLimit: (key) => calls.push(`stat:${key}`),
			clearSimilarReference: () => calls.push('similarity')
		};

		clearActiveFilterChip(target, { kind: 'source' });
		clearActiveFilterChip(target, { kind: 'name' });
		clearActiveFilterChip(target, { kind: 'authors' });
		clearActiveFilterChip(target, { kind: 'thumbKey' });
		clearActiveFilterChip(target, { kind: 'magicKey' });
		clearActiveFilterChip(target, { kind: 'boardType' });
		clearActiveFilterChip(target, { kind: 'characterSet' });
		clearActiveFilterChip(target, { kind: 'showUnfinished' });
		clearActiveFilterChip(target, { kind: 'keyFilter', filter: 'and' });
		clearActiveFilterChip(target, { kind: 'keyFilter', filter: 'or' });
		clearActiveFilterChip(target, { kind: 'keyFilter', filter: 'exclude' });
		clearActiveFilterChip(target, { kind: 'statLimit', key: 'cyano-sfb' });
		clearActiveFilterChip(target, { kind: 'similarity' });

		expect(calls).toEqual([
			'source',
			'name:',
			'authors',
			'thumbs:optional',
			'magic:optional',
			'board:all',
			'charset:english',
			'unfinished:false',
			'keys:and',
			'keys:or',
			'keys:exclude',
			'stat:cyano-sfb',
			'similarity'
		]);
	});
});
