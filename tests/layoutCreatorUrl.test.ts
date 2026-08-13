import { describe, expect, test } from 'bun:test';
import {
	buildKeyboardInputConfig,
	clearKeyboardInputConfig,
	createDefaultKeyboardInputConfig,
	updateKeyboardInputKey
} from '../src/lib/keyboardInputConfig';
import { LAYOUT_CREATOR_NEW_LAYOUT_NAME } from '../src/lib/layoutCreator';
import {
	createCreatorAdaptiveRule,
	createCreatorAdaptiveSection,
	createCreatorMagicRule,
	createCreatorMagicSection,
	createEmptyCreatorAdaptiveDraft,
	createEmptyCreatorMagicDraft
} from '../src/lib/layoutCreatorMappings';
import {
	createDefaultCreatorUrlSnapshot,
	creatorSearchFromSnapshot,
	readCreatorUrlSnapshot,
	writeCreatorUrlParams,
	type CreatorUrlSnapshot
} from '../src/lib/layoutCreatorUrl';

function roundTrip(snapshot: CreatorUrlSnapshot): CreatorUrlSnapshot {
	return readCreatorUrlSnapshot(writeCreatorUrlParams(snapshot));
}

describe('creator URL state', () => {
	test('omits defaults so a blank canvas stays /create', () => {
		expect(writeCreatorUrlParams(createDefaultCreatorUrlSnapshot()).toString()).toBe('');
		expect(creatorSearchFromSnapshot(createDefaultCreatorUrlSnapshot())).toBe('');
	});

	test('round-trips a renamed locked draft with an edited key', () => {
		const snapshot: CreatorUrlSnapshot = {
			...createDefaultCreatorUrlSnapshot(),
			name: 'Shared draft',
			locked: true,
			keyConfig: updateKeyboardInputKey(createDefaultKeyboardInputConfig(), '0,0', 'w')
		};

		const params = writeCreatorUrlParams(snapshot);
		expect(params.get('name')).toBe('Shared draft');
		expect(params.get('locked')).toBe('1');
		expect(params.get('keys')?.startsWith('v1:m;')).toBe(true);
		expect(params.has('base')).toBe(false);

		const restored = roundTrip(snapshot);
		expect(restored.name).toBe('Shared draft');
		expect(restored.locked).toBe(true);
		expect(restored.keyConfig.baseLayoutName).toBe('QWERTY');
		expect(restored.keyConfig.baseLayoutModified).toBe(true);
		expect(restored.keyConfig.keys.find((key) => key.slot === '0,0')?.value).toBe('w');
		expect(restored.keyConfig.keys.find((key) => key.slot === '0,1')?.value).toBe('w');
	});

	test('round-trips keyboard type, a catalog base, and a cleared board', () => {
		const fromBase: CreatorUrlSnapshot = {
			...createDefaultCreatorUrlSnapshot(),
			keyConfig: buildKeyboardInputConfig({
				baseLayoutName: 'vylet',
				baseLayoutModified: false,
				keyboardType: 'ortho',
				keys: [
					{ slot: '0,0', value: 'w' },
					{ slot: '0,1', value: 'l' },
					{ slot: '0,12', value: '', inert: true }
				]
			})
		};
		const restoredBase = roundTrip(fromBase);
		expect(restoredBase.keyConfig.baseLayoutName).toBe('vylet');
		expect(restoredBase.keyConfig.keyboardType).toBe('ortho');
		expect(restoredBase.keyConfig.keys.find((key) => key.slot === '0,0')?.value).toBe('w');
		expect(restoredBase.keyConfig.keys.find((key) => key.slot === '0,12')?.inert).toBe(true);

		const cleared: CreatorUrlSnapshot = {
			...createDefaultCreatorUrlSnapshot(),
			name: 'Magic lela',
			keyConfig: clearKeyboardInputConfig(createDefaultKeyboardInputConfig())
		};
		const clearedParams = writeCreatorUrlParams(cleared);
		expect(clearedParams.get('name')).toBe('Magic lela');
		expect(clearedParams.get('keys')).toBe('v1:-');
		expect(clearedParams.toString()).toBe('name=Magic+lela&keys=v1%3A-');

		const restoredCleared = roundTrip(cleared);
		expect(restoredCleared.keyConfig.baseLayoutName).toBeNull();
		expect(restoredCleared.keyConfig.keys.every((key) => key.value === '')).toBe(true);
	});

	test('restores a verbose empty-key query from before empty slots were omitted', () => {
		const params = new URLSearchParams('name=Magic+lela&keys=v1:-;0,0::;0,1::;3,0:l:;3,1:r:');
		const restored = readCreatorUrlSnapshot(params);
		expect(restored.name).toBe('Magic lela');
		expect(restored.keyConfig.baseLayoutName).toBeNull();
		expect(restored.keyConfig.keys.every((key) => key.value === '')).toBe(true);
		expect(restored.keyConfig.keys.find((key) => key.slot === '3,0')?.thumbHand).toBe('l');
	});

	test('round-trips magic and adaptive drafts including incomplete rows', () => {
		const magicSection = createCreatorMagicSection('*');
		magicSection.fallbackKind = 'emit';
		magicSection.fallbackEmit = 'the';
		magicSection.rules = [
			{ ...createCreatorMagicRule(), after: 'c', emit: 'k' },
			{ ...createCreatorMagicRule(), after: '', emit: '' }
		];
		const extraSection = createCreatorMagicSection('#');
		extraSection.rules = [{ ...createCreatorMagicRule(), after: 't', emit: 'ion' }];

		const adaptiveRule = { ...createCreatorAdaptiveRule(), trigger: 'l', left: 'y', right: 'j' };
		const group = createCreatorAdaptiveSection('SFB');
		group.id = 'sfb';
		group.rules = [{ ...createCreatorAdaptiveRule(), trigger: 's', left: 'c', right: 'd' }];

		const snapshot: CreatorUrlSnapshot = {
			...createDefaultCreatorUrlSnapshot(),
			includeMagicKey: true,
			includeAdaptiveKey: true,
			magicDraft: { sections: [magicSection, extraSection] },
			adaptiveDraft: { rules: [adaptiveRule, createCreatorAdaptiveRule()], groups: [group] }
		};

		const restored = roundTrip(snapshot);
		expect(restored.includeMagicKey).toBe(true);
		expect(restored.includeAdaptiveKey).toBe(true);
		expect(restored.magicDraft.sections).toHaveLength(2);
		expect(restored.magicDraft.sections[0]?.fallbackKind).toBe('emit');
		expect(restored.magicDraft.sections[0]?.fallbackEmit).toBe('the');
		expect(restored.magicDraft.sections[0]?.rules[0]).toMatchObject({ after: 'c', emit: 'k' });
		expect(restored.magicDraft.sections[0]?.rules[1]).toMatchObject({ after: '', emit: '' });
		expect(restored.magicDraft.sections[1]?.trigger).toBe('#');
		expect(restored.adaptiveDraft.rules[0]).toMatchObject({ trigger: 'l', left: 'y', right: 'j' });
		expect(restored.adaptiveDraft.rules[1]).toMatchObject({ trigger: '', left: '', right: '' });
		expect(restored.adaptiveDraft.groups[0]).toMatchObject({ id: 'sfb', label: 'SFB' });
		expect(restored.adaptiveDraft.groups[0]?.rules[0]).toMatchObject({
			trigger: 's',
			left: 'c',
			right: 'd'
		});
	});

	test('stores feature flags without mapping payloads for empty drafts', () => {
		const snapshot: CreatorUrlSnapshot = {
			...createDefaultCreatorUrlSnapshot(),
			includeMagicKey: true,
			includeAdaptiveKey: true,
			magicDraft: createEmptyCreatorMagicDraft(),
			adaptiveDraft: createEmptyCreatorAdaptiveDraft()
		};
		const params = writeCreatorUrlParams(snapshot);
		expect(params.get('magic')).toBe('1');
		expect(params.get('adaptive')).toBe('1');
		expect(roundTrip(snapshot).includeMagicKey).toBe(true);
		expect(roundTrip(snapshot).includeAdaptiveKey).toBe(true);
	});

	test('ignores malformed mapping and key params', () => {
		const params = new URLSearchParams({
			name: LAYOUT_CREATOR_NEW_LAYOUT_NAME,
			keys: 'nope',
			magic: 'v1:%%%',
			adaptive: 'v1:not-json',
			type: 'split'
		});
		const restored = readCreatorUrlSnapshot(params);
		expect(restored).toMatchObject({
			name: LAYOUT_CREATOR_NEW_LAYOUT_NAME,
			includeMagicKey: false,
			includeAdaptiveKey: false
		});
		expect(restored.keyConfig.keyboardType).toBe('staggered');
		expect(restored.keyConfig.keys.find((key) => key.slot === '0,0')?.value).toBe('q');
	});

	test('preserves a semicolon key value through the query string', () => {
		const snapshot: CreatorUrlSnapshot = {
			...createDefaultCreatorUrlSnapshot(),
			keyConfig: updateKeyboardInputKey(createDefaultKeyboardInputConfig(), '1,9', ';')
		};
		const restored = readCreatorUrlSnapshot(
			new URLSearchParams(creatorSearchFromSnapshot(snapshot).slice(1))
		);
		expect(restored.keyConfig.keys.find((key) => key.slot === '1,9')?.value).toBe(';');
	});
});
