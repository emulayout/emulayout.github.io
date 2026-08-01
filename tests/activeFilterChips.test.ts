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
		snapshot.repeatKeyFilter = 'required';
		snapshot.adaptiveSwapFilter = 'required-mapped';
		snapshot.appliedIncludeGrid[0][0] = 'a';
		snapshot.appliedStatLimits['cyano-sfb'] = { operator: 'lt', value: '1.5' };
		snapshot.appliedStatLimits['cyano-lh'] = { operator: 'gt', value: '45' };
		snapshot.appliedStatLimits['cyano-LI'] = { operator: 'lt', value: '24' };
		snapshot.appliedFingerWorkload.analyzer = 'cyanophage';
		snapshot.appliedFingerWorkload.preference.left.pinky = 'lightest';
		snapshot.appliedFingerWorkload.preference.left.middle = 'heavy';
		snapshot.appliedFingerWorkload.preference.right.pinky = 'lightest';
		snapshot.appliedFingerWorkload.preference.right.middle = 'heavy';
		snapshot.similarReferenceName = 'Graphite';
		snapshot.appliedSimilarityFilterValue = '70';

		const chips = getActiveFilterChips(
			chipSourceFromViewSnapshot(snapshot, { sourceLayoutNames: ['Canary'] })
		);

		expect(chips.map(({ id }) => id)).toEqual([
			'source',
			'name',
			'authors',
			'repeat',
			'magic',
			'adaptive',
			'board',
			'keys-and',
			'stat-cyano-sfb',
			'hand-cyano-lh',
			'finger-cyano-LI',
			'finger-workload',
			'similarity'
		]);
		expect(chips.find(({ id }) => id === 'source')).toMatchObject({
			label: 'Source: custom selection',
			title: '1 layout',
			focus: { target: 'source' }
		});
		expect(chips.find(({ id }) => id === 'stat-cyano-sfb')).toMatchObject({
			label: 'SFB ≤ 1.5%',
			tone: 'cyanophage',
			focus: {
				target: 'stats',
				section: 'general',
				analyzer: 'cyanophage',
				key: 'cyano-sfb'
			}
		});
		expect(chips.find(({ id }) => id === 'hand-cyano-lh')).toMatchObject({
			label: 'LH ≥ 45%',
			focus: {
				target: 'stats',
				section: 'hand-usage',
				analyzer: 'cyanophage',
				key: 'cyano-lh'
			}
		});
		expect(chips.find(({ id }) => id === 'finger-cyano-LI')).toMatchObject({
			label: 'LH Index ≤ 24%',
			focus: {
				target: 'stats',
				section: 'finger-usage',
				analyzer: 'cyanophage',
				key: 'cyano-LI'
			}
		});
		expect(chips.find(({ id }) => id === 'finger-workload')).toMatchObject({
			label: 'Workload (Cyanophage): Both M > P',
			focus: {
				target: 'stats',
				section: 'finger-workload',
				analyzer: 'cyanophage',
				workload: true
			}
		});
		expect(chips.find(({ id }) => id === 'similarity')?.label).toBe('Similarity ≥ 70%');
		expect(chips.find(({ id }) => id === 'magic')?.label).toBe('Magic: known mappings');
		expect(chips.find(({ id }) => id === 'repeat')?.label).toBe('Repeat required');
		expect(chips.find(({ id }) => id === 'adaptive')?.label).toBe('Adaptive: known mappings');
	});

	test('uses standalone labels for stats whose row abbreviations need group context', () => {
		const snapshot = createDefaultViewSnapshot();
		for (const key of [
			'rollIn',
			'oneIn',
			'rtlIn',
			'red',
			'cyano-roll-in',
			'cyano-redirect',
			'mana-lsb',
			'mana-redirect',
			'altNoThumbs',
			'redirectNoThumbs',
			'inroll2'
		] as const) {
			snapshot.appliedStatLimits[key] = { operator: 'lt', value: '1' };
		}

		const labelsById = Object.fromEntries(
			getActiveFilterChips(chipSourceFromViewSnapshot(snapshot)).map(({ id, label }) => [id, label])
		);

		expect(labelsById['stat-rollIn']).toBe('Roll in ≤ 1%');
		expect(labelsById['stat-oneIn']).toBe('One-hand in ≤ 1%');
		expect(labelsById['stat-rtlIn']).toBe('Roll total in ≤ 1%');
		expect(labelsById['stat-red']).toBe('Red ≤ 1%');
		expect(labelsById['stat-cyano-roll-in']).toBe('Roll in ≤ 1%');
		expect(labelsById['stat-cyano-redirect']).toBe('Red ≤ 1%');
		expect(labelsById['stat-mana-lsb']).toBe('Stretch big ≤ 1');
		expect(labelsById['stat-mana-redirect']).toBe('Red ≤ 1%');
		expect(labelsById['stat-altNoThumbs']).toBe('Alt NoT ≤ 1%');
		expect(labelsById['stat-redirectNoThumbs']).toBe('Red NoT ≤ 1%');
		expect(labelsById['stat-inroll2']).toBe('Roll in 2 ≤ 1%');
	});

	test('routes every clear action to its owning store mutation', () => {
		const calls: string[] = [];
		const target: ActiveFilterClearTarget = {
			clearSourceSelection: () => calls.push('source'),
			setNameFilter: (value) => calls.push(`name:${value}`),
			clearAuthors: () => calls.push('authors'),
			setThumbKeyFilter: (value) => calls.push(`thumbs:${value}`),
			setMagicKeyFilter: (value) => calls.push(`magic:${value}`),
			setRepeatKeyFilter: (value) => calls.push(`repeat:${value}`),
			setAdaptiveSwapFilter: (value) => calls.push(`adaptive:${value}`),
			setBoardTypeFilter: (value) => calls.push(`board:${value}`),
			setCharacterSetFilter: (value) => calls.push(`charset:${value}`),
			setShowUnfinished: (value) => calls.push(`unfinished:${value}`),
			clearInclude: () => calls.push('keys:and'),
			clearIncludeOr: () => calls.push('keys:or'),
			clearExclude: () => calls.push('keys:exclude'),
			clearStatLimit: (key) => calls.push(`stat:${key}`),
			clearFingerWorkloadPreference: () => calls.push('workload'),
			clearSimilarReference: () => calls.push('similarity')
		};

		clearActiveFilterChip(target, { kind: 'source' });
		clearActiveFilterChip(target, { kind: 'name' });
		clearActiveFilterChip(target, { kind: 'authors' });
		clearActiveFilterChip(target, { kind: 'thumbKey' });
		clearActiveFilterChip(target, { kind: 'magicKey' });
		clearActiveFilterChip(target, { kind: 'repeatKey' });
		clearActiveFilterChip(target, { kind: 'adaptiveSwap' });
		clearActiveFilterChip(target, { kind: 'boardType' });
		clearActiveFilterChip(target, { kind: 'characterSet' });
		clearActiveFilterChip(target, { kind: 'showUnfinished' });
		clearActiveFilterChip(target, { kind: 'keyFilter', filter: 'and' });
		clearActiveFilterChip(target, { kind: 'keyFilter', filter: 'or' });
		clearActiveFilterChip(target, { kind: 'keyFilter', filter: 'exclude' });
		clearActiveFilterChip(target, { kind: 'statLimit', key: 'cyano-sfb' });
		clearActiveFilterChip(target, { kind: 'fingerWorkload' });
		clearActiveFilterChip(target, { kind: 'similarity' });

		expect(calls).toEqual([
			'source',
			'name:',
			'authors',
			'thumbs:optional',
			'magic:optional',
			'repeat:optional',
			'adaptive:optional',
			'board:all',
			'charset:english',
			'unfinished:false',
			'keys:and',
			'keys:or',
			'keys:exclude',
			'stat:cyano-sfb',
			'workload',
			'similarity'
		]);
	});
});
