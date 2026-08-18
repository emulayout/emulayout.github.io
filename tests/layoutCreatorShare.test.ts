import { describe, expect, test } from 'bun:test';
import { updateKeyboardInputKey } from '../src/lib/keyboardInputConfig';
import {
	createCreatorAdaptiveRule,
	createCreatorMagicRule,
	createCreatorMagicSection
} from '../src/lib/layoutCreatorMappings';
import {
	createDefaultCreatorUrlSnapshot,
	creatorUrlContentEqual,
	type CreatorUrlSnapshot
} from '../src/lib/layoutCreatorUrl';
import {
	buildCreatorShareUrl,
	CREATOR_SHARE_PARAM,
	readCreatorShareFromSearch
} from '../src/lib/layoutCreatorShare';

function sharedSnapshot(): CreatorUrlSnapshot {
	const defaults = createDefaultCreatorUrlSnapshot();
	const magicSection = createCreatorMagicSection('*');
	magicSection.rules = [{ ...createCreatorMagicRule(), after: 'c', emit: 'k' }];
	return {
		...defaults,
		name: 'Portable layout',
		author: 'Layout author',
		preview: false,
		section: 'feel',
		includeMagicKey: true,
		includeAdaptiveKey: true,
		magicDraft: { sections: [magicSection] },
		adaptiveDraft: {
			rules: [{ ...createCreatorAdaptiveRule(), trigger: 'l', left: 'y', right: 'j' }],
			groups: []
		},
		keyConfig: updateKeyboardInputKey(defaults.keyConfig, '0,0', 'z'),
		practiceLesson: { customText: null, specialWordsPercent: 40 },
		disabledMappingIds: ['["magic-rule","*","c"]']
	};
}

describe('creator layout sharing', () => {
	test('builds a portable content URL and restores it as a Preview offer', () => {
		const snapshot = sharedSnapshot();
		const url = new URL(
			buildCreatorShareUrl(snapshot, 'https://example.test/create?id=browser-local&edit=1#draft')
		);

		expect(url.pathname).toBe('/create');
		expect(url.hash).toBe('');
		expect(url.searchParams.get(CREATOR_SHARE_PARAM)).toBe('1');
		expect(url.searchParams.has('id')).toBe(false);
		expect(url.searchParams.has('edit')).toBe(false);
		expect(url.searchParams.has('tab')).toBe(false);
		expect(url.searchParams.get('name')).toBe('Portable layout');
		expect(url.searchParams.get('author')).toBe('Layout author');
		expect(url.searchParams.has('keys')).toBe(true);
		expect(url.searchParams.has('magic')).toBe(true);
		expect(url.searchParams.has('adaptive')).toBe(true);
		expect(url.searchParams.has('off')).toBe(true);

		const restored = readCreatorShareFromSearch(url.searchParams);
		expect(restored).not.toBeNull();
		expect(restored?.preview).toBe(true);
		expect(restored?.section).toBe('practice');
		expect(restored && creatorUrlContentEqual(restored, snapshot)).toBe(true);
	});

	test('ignores ordinary creator URLs and unknown share versions', () => {
		expect(readCreatorShareFromSearch(new URLSearchParams('name=Draft'))).toBeNull();
		expect(readCreatorShareFromSearch(new URLSearchParams('name=Draft&share=2'))).toBeNull();
	});
});
