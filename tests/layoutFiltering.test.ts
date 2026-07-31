import { describe, expect, test } from 'bun:test';
import { createDefaultViewSnapshot } from '$lib/filterSnapshot';
import { filterLayouts, sortLayouts, type LayoutFilterCriteria } from '$lib/layoutFiltering';
import type { LayoutData } from '$lib/layout';
import type { StatsMaps } from '$lib/layout';
import { BOT_STAT_KEYS, COMPACT_STAT_FIELD_COUNT } from '$lib/statsDerivation';

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
		hasRepeatKey = false,
		hasMagicKeyMappings = false,
		hasAdaptiveSwap = false,
		hasAdaptiveSwapMappings = false,
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
		hasRepeatKey: boolean;
		hasMagicKeyMappings: boolean;
		hasAdaptiveSwap: boolean;
		hasAdaptiveSwapMappings: boolean;
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
		hasRepeatKey,
		hasMagicKeyMappings,
		hasAdaptiveSwap,
		hasAdaptiveSwapMappings,
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
		repeatKeyFilter: snapshot.repeatKeyFilter,
		magicKeyFilter: snapshot.magicKeyFilter,
		adaptiveSwapFilter: snapshot.adaptiveSwapFilter,
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
		fingerWorkloadPreferences: snapshot.appliedFingerWorkloadPreferences,
		canUseLikes: false,
		...overrides
	};
}

function makeCminiStats(
	usage: Partial<Record<'LP' | 'LR' | 'LM' | 'LI' | 'RP' | 'RR' | 'RM' | 'RI', number>>
): number[] {
	const compact = Array(COMPACT_STAT_FIELD_COUNT).fill(0);
	const set = (key: string, value: number) => {
		const index = BOT_STAT_KEYS.indexOf(key as (typeof BOT_STAT_KEYS)[number]);
		if (index < 0) throw new Error(`Unknown cmini stat: ${key}`);
		compact[index] = Math.round(value * 10_000);
	};
	set('alternate', 0.1);
	for (const [key, value] of Object.entries(usage)) set(key, value);
	return compact;
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

	test('filters repeat keys independently from magic keys', () => {
		const plain = makeLayout('Plain');
		const repeat = makeLayout('Repeat', { hasRepeatKey: true });
		const magic = makeLayout('Magic', { hasMagicKey: true });

		expect(
			filterLayouts([plain, repeat, magic], makeCriteria({ repeatKeyFilter: 'required' })).map(
				(layout) => layout.name
			)
		).toEqual(['Repeat']);
		expect(
			filterLayouts([plain, repeat, magic], makeCriteria({ magicKeyFilter: 'required' })).map(
				(layout) => layout.name
			)
		).toEqual(['Magic']);
	});

	test('distinguishes all adaptive layouts from those with known mappings', () => {
		const ordinary = makeLayout('ordinary');
		const unknown = makeLayout('adaptive-unknown', { hasAdaptiveSwap: true });
		const mapped = makeLayout('adaptive-mapped', {
			hasAdaptiveSwap: true,
			hasAdaptiveSwapMappings: true
		});
		const layouts = [ordinary, unknown, mapped];

		expect(filterLayouts(layouts, makeCriteria({ adaptiveSwapFilter: 'required' }))).toEqual([
			unknown,
			mapped
		]);
		expect(filterLayouts(layouts, makeCriteria({ adaptiveSwapFilter: 'required-mapped' }))).toEqual(
			[mapped]
		);
		expect(filterLayouts(layouts, makeCriteria({ adaptiveSwapFilter: 'excluded' }))).toEqual([
			ordinary
		]);
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

	test('chains relative finger workload with absolute percentage limits', () => {
		const ordered = makeLayout('Ordered');
		const highPinky = makeLayout('High pinky');
		const wrongRightOrder = makeLayout('Wrong right order');
		const layouts = [ordered, highPinky, wrongRightOrder];
		const criteria = makeCriteria();
		criteria.fingerWorkloadPreferences.cmini = {
			left: {
				pinky: 'lightest',
				ring: 'light',
				middle: 'heavy',
				index: 'medium'
			},
			right: {
				pinky: 'lightest',
				ring: 'light',
				middle: 'heavy',
				index: 'medium'
			}
		};
		criteria.statLimits.LP = { operator: 'lt', value: '4.5' };
		criteria.statLimits.RP = { operator: 'lt', value: '4.5' };

		const statsMaps: StatsMaps = {
			cmini: {
				Ordered: makeCminiStats({
					LP: 0.03,
					LR: 0.08,
					LI: 0.17,
					LM: 0.22,
					RP: 0.02,
					RR: 0.07,
					RI: 0.18,
					RM: 0.23
				}),
				'High pinky': makeCminiStats({
					LP: 0.05,
					LR: 0.08,
					LI: 0.17,
					LM: 0.22,
					RP: 0.04,
					RR: 0.07,
					RI: 0.18,
					RM: 0.23
				}),
				'Wrong right order': makeCminiStats({
					LP: 0.03,
					LR: 0.08,
					LI: 0.17,
					LM: 0.22,
					RP: 0.02,
					RR: 0.07,
					RI: 0.24,
					RM: 0.23
				})
			}
		};

		expect(filterLayouts(layouts, criteria, statsMaps, true).map((layout) => layout.name)).toEqual([
			'Ordered'
		]);
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
