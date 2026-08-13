import { describe, expect, test } from 'bun:test';
import {
	adaptiveDraftFromSource,
	adaptiveSourceFromDraft,
	compileCreatorInputProfile,
	createCreatorAdaptiveRule,
	createCreatorAdaptiveSection,
	createCreatorMagicRule,
	createCreatorMagicSection,
	createEmptyCreatorAdaptiveDraft,
	createEmptyCreatorMagicDraft,
	creatorDraftsFromSupplemental,
	magicDraftFromSource,
	magicSourceFromDraft
} from '../src/lib/layoutCreatorMappings';
import { validateLayoutSupplemental } from '../src/lib/layoutSupplemental';

describe('magicSourceFromDraft', () => {
	test('omits incomplete rows and compiles a complete rule', () => {
		const draft = createEmptyCreatorMagicDraft();
		draft.sections[0].rules = [
			{ ...createCreatorMagicRule(), after: '', emit: 'k' },
			{ ...createCreatorMagicRule(), after: 'c', emit: 'k' }
		];

		expect(magicSourceFromDraft(draft)).toEqual({
			mappings: { '*': { c: 'k' } }
		});
	});

	test('compiles an emitting fallback without rules', () => {
		const draft = {
			sections: [
				{
					...createCreatorMagicSection('*'),
					rules: [],
					fallbackKind: 'repeat-last' as const
				}
			]
		};

		expect(magicSourceFromDraft(draft)).toEqual({
			mappings: { '*': { rules: {}, fallback: 'repeat-last' } }
		});
	});

	test('compiles a fixed emit fallback as an extended trigger', () => {
		const draft = {
			sections: [
				{
					...createCreatorMagicSection('*'),
					rules: [{ ...createCreatorMagicRule(), after: 'c', emit: 'k' }],
					fallbackKind: 'emit' as const,
					fallbackEmit: 'the'
				}
			]
		};

		expect(magicSourceFromDraft(draft)).toEqual({
			mappings: { '*': { rules: { c: 'k' }, fallback: { emit: 'the' } } }
		});
	});

	test('round-trips compact rules and extended fallbacks from catalog source', () => {
		const source = {
			mappings: {
				'*': { c: 'k', t: 'ion' },
				'@': { rules: { a: 'o' }, fallback: 'repeat-last' as const }
			}
		};
		const draft = magicDraftFromSource(source);

		expect(draft.sections.map((section) => section.trigger)).toEqual(['*', '@']);
		expect(draft.sections[0].rules.map((rule) => ({ after: rule.after, emit: rule.emit }))).toEqual(
			[
				{ after: 'c', emit: 'k' },
				{ after: 't', emit: 'ion' }
			]
		);
		expect(draft.sections[0].fallbackKind).toBe('no-op');
		expect(draft.sections[1].fallbackKind).toBe('repeat-last');
		expect(magicSourceFromDraft(draft)).toEqual({
			mappings: {
				'*': { c: 'k', t: 'ion' },
				'@': { rules: { a: 'o' }, fallback: 'repeat-last' }
			}
		});
	});

	test('omits an incomplete emit fallback', () => {
		const draft = {
			sections: [
				{
					...createCreatorMagicSection('*'),
					rules: [],
					fallbackKind: 'emit' as const,
					fallbackEmit: '  '
				}
			]
		};

		expect(magicSourceFromDraft(draft)).toBeUndefined();
	});
});

describe('adaptiveSourceFromDraft', () => {
	test('keeps ungrouped rules and labeled sections separate', () => {
		const draft = createEmptyCreatorAdaptiveDraft();
		draft.rules = [{ ...createCreatorAdaptiveRule(), trigger: 'l', left: 'y', right: 'j' }];
		draft.groups = [
			{
				...createCreatorAdaptiveSection('Comfort'),
				rules: [{ ...createCreatorAdaptiveRule(), trigger: 'w', left: 's', right: 'm' }]
			}
		];

		expect(adaptiveSourceFromDraft(draft)).toEqual({
			mappings: { l: { y: 'j' } },
			groups: [{ id: draft.groups[0].id, label: 'Comfort', mappings: { w: { s: 'm' } } }]
		});
	});

	test('round-trips ungrouped rules and labeled groups from catalog source', () => {
		const source = {
			mappings: { l: { y: 'j' } },
			groups: [{ id: 'comfort', label: 'Comfort', mappings: { w: { s: 'm' } } }]
		};
		const draft = adaptiveDraftFromSource(source);

		expect(
			draft.rules.map((rule) => ({ trigger: rule.trigger, left: rule.left, right: rule.right }))
		).toEqual([{ trigger: 'l', left: 'y', right: 'j' }]);
		expect(draft.groups[0]).toMatchObject({ id: 'comfort', label: 'Comfort' });
		expect(adaptiveSourceFromDraft(draft)).toEqual(source);
	});
});

describe('creatorDraftsFromSupplemental', () => {
	test('seeds the default variant mappings', () => {
		const supplemental = {
			vylet: validateLayoutSupplemental({
				schema: 1,
				magicKeys: { mappings: { '*': { c: 'k' } } },
				adaptiveSwaps: { mappings: { l: { y: 'j' } } }
			})
		};
		const seeded = creatorDraftsFromSupplemental(supplemental, 'vylet');

		expect(seeded.hasMagicMappings).toBe(true);
		expect(seeded.hasAdaptiveMappings).toBe(true);
		expect(magicSourceFromDraft(seeded.magicDraft)).toEqual({ mappings: { '*': { c: 'k' } } });
		expect(adaptiveSourceFromDraft(seeded.adaptiveDraft)).toEqual({ mappings: { l: { y: 'j' } } });
	});

	test('returns empty drafts when a layout has no supplemental mappings', () => {
		const seeded = creatorDraftsFromSupplemental({}, 'QWERTY');

		expect(seeded.hasMagicMappings).toBe(false);
		expect(seeded.hasAdaptiveMappings).toBe(false);
		expect(magicSourceFromDraft(seeded.magicDraft)).toBeUndefined();
		expect(adaptiveSourceFromDraft(seeded.adaptiveDraft)).toBeUndefined();
	});
});

describe('compileCreatorInputProfile', () => {
	test('returns undefined until a complete mapping exists', () => {
		expect(
			compileCreatorInputProfile(
				true,
				createEmptyCreatorMagicDraft(),
				true,
				createEmptyCreatorAdaptiveDraft()
			)
		).toBeUndefined();
	});

	test('compiles magic and adaptive independently', () => {
		const magicDraft = {
			sections: [
				{
					...createCreatorMagicSection('*'),
					rules: [{ ...createCreatorMagicRule(), after: 'c', emit: 'k' }]
				}
			]
		};
		const adaptiveDraft = {
			rules: [{ ...createCreatorAdaptiveRule(), trigger: 'l', left: 'y', right: 'j' }],
			groups: []
		};

		const magicOnly = compileCreatorInputProfile(
			true,
			magicDraft,
			false,
			createEmptyCreatorAdaptiveDraft()
		);
		const adaptiveOnly = compileCreatorInputProfile(
			false,
			createEmptyCreatorMagicDraft(),
			true,
			adaptiveDraft
		);

		expect(magicOnly?.magicKeys?.triggers['*']?.rules).toEqual([{ after: 'c', emit: 'k' }]);
		expect(magicOnly?.adaptiveSwaps).toBeUndefined();
		expect(adaptiveOnly?.adaptiveSwaps?.rules).toEqual([{ trigger: 'l', left: 'y', right: 'j' }]);
		expect(adaptiveOnly?.magicKeys).toBeUndefined();
	});

	test('compiles a fallback-only magic trigger', () => {
		const profile = compileCreatorInputProfile(
			true,
			{
				sections: [
					{
						...createCreatorMagicSection('*'),
						rules: [],
						fallbackKind: 'repeat-last'
					}
				]
			},
			false,
			createEmptyCreatorAdaptiveDraft()
		);

		expect(profile?.magicKeys?.triggers['*']?.fallback).toEqual({ kind: 'repeat-last' });
		expect(profile?.magicKeys?.triggers['*']?.rules).toEqual([]);
	});
});
