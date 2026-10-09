import { expect, test } from 'bun:test';
import { createDefaultCreatorSnapshot, creatorContentFromSnapshot } from '$lib/creatorContent';
import { buildCreatorShareUrl, readCreatorShareFromSearch } from '$lib/layoutCreatorShare';
import {
	serializeSavedLayoutsDocument,
	parseSavedLayoutsDocument
} from '$lib/layoutCreatorStorage';
import { sharedTypingPracticeLessonMatches } from '$lib/typingPracticeLesson';
import { compileLayoutInputProfile } from '$lib/layoutInputBehaviors';
import { chiralMappingId } from '$lib/chiralKeys';
import {
	selectTypingPracticeLessonWords,
	typingPracticeRemappingPools
} from '$lib/typingPracticeSpecialWords';
import {
	normalizeRemappingPreferences,
	parseRemappingPreferences,
	remappingPreferencesSignature
} from '$lib/typingPracticeRemappingPreferences';
import {
	normalizeTypingPracticeLessonSettings,
	parseTypingPracticeLessonSettings,
	serializeTypingPracticeLessonSettings,
	resolveTypingPracticeLessonSettings,
	typingPracticeLessonOverridesFromSearchParams,
	writeTypingPracticeLessonParams,
	writeTypingPracticeLessonOverrideParams
} from '$lib/typingPracticeText';

const preferences = { split: true, magic: 100, adaptive: 50, chiral: 0 };
const profile = compileLayoutInputProfile(
	{
		magicKeys: { mappings: { '*': { c: 'k' } } },
		adaptiveSwaps: { mappings: { n: { "'": 'h' } } },
		chiralKeys: {
			keys: [
				{
					key: '/',
					same: { kind: 'char', char: 'e' },
					opposite: { kind: 'char', char: 'i' },
					except: ['m']
				}
			]
		}
	},
	{ a: { col: 0 }, h: { col: 5 }, m: { col: 6 }, '/': { col: 9 } }
);
const words = ['luck', 'sick', 'back', "can't", 'ai', 'he', 'me', 'rest'];

test('creator saves and portable shares retain relative settings', () => {
	const snapshot = {
		...createDefaultCreatorSnapshot(),
		practiceLesson: normalizeTypingPracticeLessonSettings({
			specialWordsPercent: 80,
			remappingPreferences: preferences
		})
	};
	const share = new URL(buildCreatorShareUrl(snapshot, 'https://example.com/create'));
	expect(readCreatorShareFromSearch(share.searchParams)?.practiceLesson).toEqual(
		snapshot.practiceLesson
	);
	const saved = serializeSavedLayoutsDocument([
		{ id: 'test', name: 'Test', createdAt: 1, snapshot: creatorContentFromSnapshot(snapshot) }
	]);
	expect(parseSavedLayoutsDocument(JSON.parse(saved))[0].snapshot.practiceLesson).toEqual(
		snapshot.practiceLesson
	);
});

test('weight changes invalidate shared random lessons but not custom text', () => {
	const stored = {
		customText: null,
		specialWordsPercent: 100,
		wordCount: 10,
		remappingSignature: '100,50,0',
		specialCandidateSignature: '',
		unreachableKeysSignature: ''
	};
	expect(sharedTypingPracticeLessonMatches(stored, true, null, 100, 10, '100,50,0')).toBe(true);
	expect(sharedTypingPracticeLessonMatches(stored, true, null, 100, 10, '0,50,100')).toBe(false);
	expect(
		sharedTypingPracticeLessonMatches({ ...stored, customText: 'hello' }, true, 'hello', 0, 10, '')
	).toBe(true);
});

test('overlapping words remain selectable without requiring every selected type to match', () => {
	const overlap = compileLayoutInputProfile(
		{
			magicKeys: { mappings: { '*': { a: 'i' } } },
			chiralKeys: { keys: [{ key: '/', opposite: { kind: 'char', char: 'i' } }] }
		},
		{ a: { col: 0 }, '/': { col: 9 } }
	);
	expect(typingPracticeRemappingPools(['ai'], overlap)).toEqual({
		magic: ['ai'],
		adaptive: [],
		chiral: ['ai']
	});
	const selected = selectTypingPracticeLessonWords({
		words: ['ai', 'rest'],
		profile: overlap,
		count: 10,
		specialWordsPercent: 100,
		remappingPreferences: { split: true, magic: 100, adaptive: 0, chiral: 100 }
	});
	expect(selected).toEqual(Array(10).fill('ai'));
});

test('separates native Chiral, Magic and Adaptive candidates and honors disabled mappings', () => {
	const pools = typingPracticeRemappingPools(words, profile);
	expect(pools.magic).toEqual(['luck', 'sick', 'back']);
	expect(pools.adaptive).toEqual(["can't"]);
	expect(pools.chiral).toEqual(['ai', 'he']);
	expect(typingPracticeRemappingPools(words, profile, [chiralMappingId('/')]).chiral).toEqual([]);
});

test('relative sampling chooses types before words, independently of pool size', () => {
	let seed = 2;
	const random = () => {
		seed = (seed * 1664525 + 1013904223) >>> 0;
		return seed / 4294967296;
	};
	const selected = selectTypingPracticeLessonWords({
		words,
		profile,
		count: 3000,
		specialWordsPercent: 100,
		remappingPreferences: preferences,
		random
	});
	expect(selected).toHaveLength(3000);
	const magicCount = selected.filter((word) => ['luck', 'sick', 'back'].includes(word)).length;
	expect(magicCount).toBeGreaterThan(1900);
	expect(magicCount).toBeLessThan(2100);
	expect(selected.filter((word) => word === "can't").length).toBe(3000 - magicCount);
});

test('missing types reallocate and zero weights fall back without banning words', () => {
	const selected = selectTypingPracticeLessonWords({
		words: ['ai', 'rest'],
		profile,
		count: 10,
		specialWordsPercent: 100,
		remappingPreferences: { split: true, magic: 100, adaptive: 100, chiral: 100 }
	});
	expect(selected).toEqual(Array(10).fill('ai'));
	const ordinary = selectTypingPracticeLessonWords({
		words,
		profile,
		count: words.length,
		specialWordsPercent: 100,
		remappingPreferences: { split: true, magic: 0, adaptive: 0, chiral: 0 }
	});
	expect(new Set(ordinary)).toEqual(new Set(words));
});

test('normalizes weights and ignores malformed URL settings', () => {
	expect(
		normalizeRemappingPreferences({ ...preferences, magic: 500, adaptive: -3, chiral: 23.6 })
	).toEqual({ split: true, magic: 100, adaptive: 0, chiral: 24 });
	expect(normalizeRemappingPreferences({ ...preferences, chiral: NaN })).toBeUndefined();
	for (const value of ['junk', '100,50', '100,50,x', '100,50,0,5'])
		expect(parseRemappingPreferences(value)).toBeUndefined();
	expect(typingPracticeLessonOverridesFromSearchParams(new URLSearchParams('remap=bad'))).toEqual(
		{}
	);
	expect(remappingPreferencesSignature({ ...preferences, split: false })).toBe('');
});

test('round-trips local storage, share URLs, and explicit combined selection', () => {
	for (const split of [true, false]) {
		const settings = normalizeTypingPracticeLessonSettings({
			specialWordsPercent: 70,
			remappingPreferences: { ...preferences, split }
		});
		expect(
			parseTypingPracticeLessonSettings(serializeTypingPracticeLessonSettings(settings))
		).toEqual(settings);
		const params = new URLSearchParams();
		writeTypingPracticeLessonParams(params, settings);
		const overrides = typingPracticeLessonOverridesFromSearchParams(params);
		expect(resolveTypingPracticeLessonSettings(null, overrides)).toEqual(settings);
		expect(
			resolveTypingPracticeLessonSettings({ remappingPreferences: preferences }, overrides)
				.remappingPreferences?.split
		).toBe(split);
	}
});

test('URL weights temporarily override stored defaults, absent fields inherit, and custom text wins', () => {
	const stored = normalizeTypingPracticeLessonSettings({
		specialWordsPercent: 70,
		remappingPreferences: preferences
	});
	const before = serializeTypingPracticeLessonSettings(stored);
	const overrides = typingPracticeLessonOverridesFromSearchParams(
		new URLSearchParams('remap=0,0,100')
	);
	expect(resolveTypingPracticeLessonSettings(stored, overrides).remappingPreferences).toEqual({
		split: true,
		magic: 0,
		adaptive: 0,
		chiral: 100
	});
	expect(
		resolveTypingPracticeLessonSettings(stored, { wordCount: 25 }).remappingPreferences
	).toEqual(preferences);
	expect(serializeTypingPracticeLessonSettings(stored)).toBe(before);
	expect(
		resolveTypingPracticeLessonSettings(stored, { ...overrides, customText: 'hello' })
			.remappingPreferences
	).toBeUndefined();
	const params = new URLSearchParams('remap=0,0,100');
	writeTypingPracticeLessonOverrideParams(params, { customText: 'hello' });
	expect(params.has('remap')).toBe(false);
});
