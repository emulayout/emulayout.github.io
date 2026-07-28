import { describe, expect, test } from 'bun:test';
import { createDefaultViewSnapshot } from '$lib/filterSnapshot';
import { filterLayouts, sortLayouts, type LayoutFilterCriteria } from '$lib/layoutFiltering';
import type { LayoutData } from '$lib/layout';

function makeLayout(
	name: string,
	{
		user = 1,
		board = 'angle',
		positions = [
			['0,0', 'a'],
			['0,1', 'b']
		],
		leftThumbKeys = [
			{ key: 'e', col: 3 },
			{ key: 't', col: 4 }
		],
		rightThumbKeys = [{ key: 'n', col: 5 }],
		characterSet = 'english',
		hasAllLetters = true,
		hasMagicKey = false,
		hasMagicKeyMappings = false,
		updatedAt = '2026-01-01'
	}: Partial<{
		user: number;
		board: LayoutData['board'];
		positions: Array<[string, string]>;
		leftThumbKeys: LayoutData['thumbKeysByHand']['l'];
		rightThumbKeys: LayoutData['thumbKeysByHand']['r'];
		characterSet: LayoutData['characterSet'];
		hasAllLetters: boolean;
		hasMagicKey: boolean;
		hasMagicKeyMappings: boolean;
		updatedAt: string;
	}> = {}
): LayoutData {
	return {
		name,
		user,
		board,
		keys: {},
		positionBySlot: new Map(positions),
		thumbKeysByHand: { l: leftThumbKeys, r: rightThumbKeys },
		hasThumbKeys: leftThumbKeys.length > 0 || rightThumbKeys.length > 0,
		characterSet,
		hasAllLetters,
		hasMagicKey,
		hasMagicKeyMappings,
		cyanophageCompatible: true,
		updatedAt
	};
}

function makeCriteria(overrides: Partial<LayoutFilterCriteria> = {}): LayoutFilterCriteria {
	const snapshot = createDefaultViewSnapshot();
	return {
		layoutSource: 'all',
		selectedLayoutNames: new Set(),
		sourceLayoutNames: null,
		showUnfinished: snapshot.showUnfinished,
		thumbKeyFilter: snapshot.thumbKeyFilter,
		magicKeyFilter: snapshot.magicKeyFilter,
		characterSetFilter: snapshot.characterSetFilter,
		boardTypeFilter: snapshot.boardTypeFilter,
		nameFilter: snapshot.nameFilter,
		selectedAuthors: new Set(),
		includeGrid: snapshot.appliedIncludeGrid,
		excludeGrid: snapshot.appliedExcludeGrid,
		includeOrGrid: snapshot.appliedIncludeOrGrid,
		includeOrLeftThumbKeys: snapshot.appliedIncludeOrLeftThumbKeys,
		includeOrRightThumbKeys: snapshot.appliedIncludeOrRightThumbKeys,
		includeLeftThumbKeys: snapshot.appliedIncludeLeftThumbKeys,
		includeRightThumbKeys: snapshot.appliedIncludeRightThumbKeys,
		excludeLeftThumbKeys: snapshot.appliedExcludeLeftThumbKeys,
		excludeRightThumbKeys: snapshot.appliedExcludeRightThumbKeys,
		statLimits: snapshot.appliedStatLimits,
		canUseLikes: false,
		...overrides
	};
}

describe('filterLayouts', () => {
	test('intersects selected-layout and named-view source membership', () => {
		const layouts = [makeLayout('Alpha'), makeLayout('Beta'), makeLayout('Gamma')];
		const criteria = makeCriteria({
			layoutSource: 'selected',
			selectedLayoutNames: new Set(['Alpha', 'Beta']),
			sourceLayoutNames: new Set(['Beta', 'Gamma'])
		});

		expect(filterLayouts(layouts, criteria).map((layout) => layout.name)).toEqual(['Beta']);
	});

	test('combines positional AND, OR, exclude, and ordered thumb filters', () => {
		const layout = makeLayout('Alpha');
		const criteria = makeCriteria();
		criteria.includeGrid[0][0] = 'aq';
		criteria.includeOrGrid[0][0] = 'z';
		criteria.includeOrGrid[0][1] = 'b';
		criteria.excludeGrid[0][1] = 'x';
		criteria.includeLeftThumbKeys = ['e', 't', '', ''];

		expect(filterLayouts([layout], criteria)).toEqual([layout]);

		criteria.includeLeftThumbKeys = ['t', 'e', '', ''];
		expect(filterLayouts([layout], criteria)).toEqual([]);

		criteria.includeLeftThumbKeys = ['e', 't', '', ''];
		criteria.excludeGrid[0][1] = 'b';
		expect(filterLayouts([layout], criteria)).toEqual([]);
	});

	test('applies metadata, name, and author filters', () => {
		const layouts = [
			makeLayout('Canary', { user: 12, board: 'ortho' }),
			makeLayout('Canary Wide', { user: 34, board: 'ortho' }),
			makeLayout('Graphite', { user: 12, board: 'angle' })
		];
		const criteria = makeCriteria({
			nameFilter: 'canary',
			selectedAuthors: new Set([12]),
			boardTypeFilter: 'ortho',
			thumbKeyFilter: 'required',
			magicKeyFilter: 'excluded'
		});

		expect(filterLayouts(layouts, criteria).map((layout) => layout.name)).toEqual(['Canary']);
	});

	test('distinguishes all magic layouts from those with known mappings', () => {
		const plain = makeLayout('Plain');
		const unknown = makeLayout('Unknown magic', { hasMagicKey: true });
		const mapped = makeLayout('Mapped magic', {
			hasMagicKey: true,
			hasMagicKeyMappings: true
		});

		expect(
			filterLayouts([plain, unknown, mapped], makeCriteria({ magicKeyFilter: 'required' })).map(
				(layout) => layout.name
			)
		).toEqual(['Unknown magic', 'Mapped magic']);
		expect(
			filterLayouts(
				[plain, unknown, mapped],
				makeCriteria({ magicKeyFilter: 'required-mapped' })
			).map((layout) => layout.name)
		).toEqual(['Mapped magic']);
	});

	test('hides unfinished layouts unless allowed by the current character rules', () => {
		const plain = makeLayout('Plain', { hasAllLetters: false });
		const magic = makeLayout('Magic', { hasAllLetters: false, hasMagicKey: true });

		expect(filterLayouts([plain, magic], makeCriteria()).map((layout) => layout.name)).toEqual([
			'Magic'
		]);
		expect(
			filterLayouts([plain], makeCriteria({ showUnfinished: true })).map((layout) => layout.name)
		).toEqual(['Plain']);
	});

	test('uses strict likes thresholds and holds analyzer-filtered results until stats are ready', () => {
		const layouts = [makeLayout('Ten'), makeLayout('Eleven')];
		const likesCriteria = makeCriteria({ canUseLikes: true });
		likesCriteria.statLimits.likes = { operator: 'gt', value: '10' };

		expect(
			filterLayouts(layouts, likesCriteria, {}, false, { Ten: 10, Eleven: 11 }).map(
				(layout) => layout.name
			)
		).toEqual(['Eleven']);

		const statsCriteria = makeCriteria();
		statsCriteria.statLimits['cyano-sfb'] = { operator: 'lt', value: '1' };
		expect(filterLayouts(layouts, statsCriteria, {}, false)).toEqual([]);
	});
});

describe('sortLayouts', () => {
	test('prioritizes exact and prefix name matches before the selected field', () => {
		const layouts = [
			makeLayout('My Canary', { updatedAt: '2026-03-01' }),
			makeLayout('Canary Wide', { updatedAt: '2026-02-01' }),
			makeLayout('Canary', { updatedAt: '2026-01-01' })
		];

		const sorted = sortLayouts(layouts, {
			sortBy: 'date',
			sortOrder: 'desc',
			nameFilter: 'canary'
		});

		expect(sorted.map((layout) => layout.name)).toEqual(['Canary', 'Canary Wide', 'My Canary']);
		expect(layouts.map((layout) => layout.name)).toEqual(['My Canary', 'Canary Wide', 'Canary']);
	});

	test('sorts likes with deterministic name tie-breaking', () => {
		const layouts = [makeLayout('Zulu'), makeLayout('Alpha'), makeLayout('Beta')];

		const sorted = sortLayouts(
			layouts,
			{ sortBy: 'likes', sortOrder: 'desc', nameFilter: '' },
			{},
			{ Zulu: 3, Alpha: 3, Beta: 5 }
		);

		expect(sorted.map((layout) => layout.name)).toEqual(['Beta', 'Alpha', 'Zulu']);
	});
});
