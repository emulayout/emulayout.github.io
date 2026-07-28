import { describe, expect, test } from 'bun:test';
import type { LayoutData } from '$lib/layout';
import {
	buildLayoutResults,
	createEmptyLayoutResults,
	type BuildLayoutResultsOptions
} from '$lib/layoutResults';

function makeLayout(name: string): LayoutData {
	return {
		name,
		user: 1,
		board: 'angle',
		keys: {},
		positionBySlot: new Map(),
		thumbKeysByHand: { l: [], r: [] },
		hasThumbKeys: false,
		characterSet: 'english',
		hasAllLetters: true,
		hasMagicKey: false,
		hasMagicKeyMappings: false,
		hasAdaptiveSwap: false,
		hasAdaptiveSwapMappings: false,
		cyanophageCompatible: true,
		updatedAt: '2026-01-01'
	};
}

function makeOptions(
	catalogLayouts: LayoutData[],
	overrides: Partial<BuildLayoutResultsOptions> = {}
): BuildLayoutResultsOptions {
	return {
		catalogLayouts,
		filteredLayouts: catalogLayouts,
		layoutSource: 'all',
		selectedLayoutNames: new Set(),
		includeSelectedInResults: false,
		sourceLayoutNames: null,
		similarReferenceName: null,
		similarityMatches: new Map(),
		similarityFilterOperator: 'gt',
		similarityFilterValue: '',
		sortBy: 'date',
		sortOrder: 'desc',
		sortFilteredLayouts: (layouts) => [...layouts],
		...overrides
	};
}

function itemLabels(result: ReturnType<typeof buildLayoutResults>): string[] {
	return result.items.map((item) =>
		item.kind === 'layout' ? `layout:${item.layout.name}` : `missing:${item.name}`
	);
}

describe('layout result building', () => {
	test('applies similarity membership, strict percentage filtering, and similarity sorting', () => {
		const reference = makeLayout('Reference');
		const alpha = makeLayout('Alpha');
		const beta = makeLayout('Beta');
		const gamma = makeLayout('Gamma');
		const catalog = [reference, alpha, beta, gamma];

		const result = buildLayoutResults(
			makeOptions(catalog, {
				similarReferenceName: reference.name,
				similarityMatches: new Map([
					[alpha.name, { percent: 80, mirrored: false }],
					[beta.name, { percent: 50, mirrored: false }],
					[gamma.name, { percent: 90, mirrored: true }]
				]),
				similarityFilterValue: '50',
				sortBy: 'similarity',
				sortFilteredLayouts: () => {
					throw new Error('ordinary sorting should not run in similarity mode');
				}
			})
		);

		expect(itemLabels(result)).toEqual(['layout:Gamma', 'layout:Alpha']);
	});

	test('counts and optionally injects selected layouts removed by filters', () => {
		const alpha = makeLayout('Alpha');
		const beta = makeLayout('Beta');
		const gamma = makeLayout('Gamma');
		const catalog = [alpha, beta, gamma];
		const filteredLayouts = [alpha];
		const sharedOptions = {
			filteredLayouts,
			selectedLayoutNames: new Set([beta.name, gamma.name]),
			sortFilteredLayouts: (layouts: LayoutData[]) =>
				[...layouts].sort((a, b) => a.name.localeCompare(b.name))
		};

		const hidden = buildLayoutResults(makeOptions(catalog, sharedOptions));
		expect(itemLabels(hidden)).toEqual(['layout:Alpha']);
		expect(hidden.hiddenSelectedCount).toBe(2);
		expect(hidden.forceIncludedNames.size).toBe(0);

		const included = buildLayoutResults(
			makeOptions(catalog, {
				...sharedOptions,
				includeSelectedInResults: true
			})
		);
		expect(itemLabels(included)).toEqual(['layout:Alpha', 'layout:Beta', 'layout:Gamma']);
		expect(included.hiddenSelectedCount).toBe(2);
		expect(included.forceIncludedNames).toEqual(new Set(['Beta', 'Gamma']));
		expect(filteredLayouts).toEqual([alpha]);
	});

	test('preserves source order and distinguishes missing layouts from filtered layouts', () => {
		const alpha = makeLayout('Alpha');
		const beta = makeLayout('Beta');
		const filteredOut = makeLayout('Filtered out');
		const catalog = [alpha, beta, filteredOut];

		const result = buildLayoutResults(
			makeOptions(catalog, {
				filteredLayouts: [alpha, beta],
				sourceLayoutNames: ['Missing', beta.name, filteredOut.name, alpha.name],
				sortFilteredLayouts: (layouts) => [...layouts].reverse()
			})
		);

		expect(itemLabels(result)).toEqual(['missing:Missing', 'layout:Beta', 'layout:Alpha']);
	});

	test('does not apply stale similarity data without an active reference', () => {
		const alpha = makeLayout('Alpha');
		const beta = makeLayout('Beta');

		const result = buildLayoutResults(
			makeOptions([alpha, beta], {
				similarityMatches: new Map([[alpha.name, { percent: 10, mirrored: false }]]),
				similarityFilterValue: '90'
			})
		);

		expect(itemLabels(result)).toEqual(['layout:Alpha', 'layout:Beta']);
		expect(createEmptyLayoutResults()).toEqual({
			items: [],
			forceIncludedNames: new Set(),
			hiddenSelectedCount: 0
		});
	});
});
