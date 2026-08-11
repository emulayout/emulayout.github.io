import { describe, expect, test } from 'bun:test';
import { adaptiveRuleMappingId, magicRuleMappingId } from '$lib/inputMappingControls';
import { compileLayoutInputProfile } from '$lib/layoutInputBehaviors';
import type { TypingPracticeRandomSource } from '$lib/typingPractice';
import {
	filterTypingPracticeSpecialWords,
	isTypingPracticeSpecialWord,
	selectTypingPracticeLessonWords
} from '$lib/typingPracticeSpecialWords';

const profile = compileLayoutInputProfile({
	magicKeys: { mappings: { '*': { c: 'k' } } },
	adaptiveSwaps: { mappings: { n: { "'": 'h' } } }
});

function seededRandom(seed: number): TypingPracticeRandomSource {
	let state = seed;
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
}

describe('typing-practice special words', () => {
	test('matches enabled Magic rules anywhere in the word', () => {
		expect(isTypingPracticeSpecialWord('luck', profile)).toBe(true);
		expect(isTypingPracticeSpecialWord('cost', profile)).toBe(false);
		expect(isTypingPracticeSpecialWord('luck', undefined)).toBe(false);
	});

	test('matches enabled Adaptive swaps', () => {
		expect(isTypingPracticeSpecialWord("can't", profile)).toBe(true);
		expect(isTypingPracticeSpecialWord('canht', profile)).toBe(true);
		expect(isTypingPracticeSpecialWord('canto', profile)).toBe(false);
	});

	test('ignores mappings disabled for the session', () => {
		expect(isTypingPracticeSpecialWord('luck', profile, [magicRuleMappingId('*', 'c')])).toBe(
			false
		);
		const adaptiveRule = profile.adaptiveSwaps!.rules[0];
		expect(
			isTypingPracticeSpecialWord("can't", profile, [
				adaptiveRuleMappingId(undefined, adaptiveRule)
			])
		).toBe(false);
	});

	test('filters a pool to special words only', () => {
		expect(filterTypingPracticeSpecialWords(['luck', 'cost', "can't"], profile)).toEqual([
			'luck',
			"can't"
		]);
		expect(filterTypingPracticeSpecialWords(['luck'], undefined)).toEqual([]);
	});

	test('a zero balance selects ordinary random words and honors exclusions', () => {
		const words = ['luck', 'cost', 'rest', 'mind'];
		const lesson = selectTypingPracticeLessonWords({
			words,
			count: 3,
			specialWordsPercent: 0,
			profile,
			excludedWords: ['cost'],
			random: seededRandom(1)
		});
		expect(lesson).toHaveLength(3);
		expect(lesson).not.toContain('cost');
	});

	test('an intermediate balance mixes the requested share of special words', () => {
		const words = ['luck', 'sick', "can't", 'cost', 'rest', 'mind', 'gold', 'tree'];
		const lesson = selectTypingPracticeLessonWords({
			words,
			count: 6,
			specialWordsPercent: 50,
			profile,
			random: seededRandom(7)
		});
		const special = lesson.filter((word) => isTypingPracticeSpecialWord(word, profile));
		expect(lesson).toHaveLength(6);
		expect(special).toHaveLength(3);
		expect(new Set(lesson).size).toBe(6);
	});

	test('a full balance uses only special words and cycles a small candidate pool', () => {
		const words = ['luck', 'sick', 'cost', 'rest', 'mind', 'gold'];
		const lesson = selectTypingPracticeLessonWords({
			words,
			count: 6,
			specialWordsPercent: 100,
			profile,
			random: seededRandom(3)
		});
		expect(lesson).toHaveLength(6);
		expect(lesson.every((word) => word === 'luck' || word === 'sick')).toBe(true);
		expect(lesson.filter((word) => word === 'luck')).toHaveLength(3);
		expect(lesson.filter((word) => word === 'sick')).toHaveLength(3);
	});

	test('a full balance reuses candidates when the previous lesson excluded them all', () => {
		const lesson = selectTypingPracticeLessonWords({
			words: ['luck', 'cost', 'rest'],
			count: 2,
			specialWordsPercent: 100,
			profile,
			excludedWords: ['luck'],
			random: seededRandom(5)
		});
		expect(lesson).toEqual(['luck', 'luck']);
	});

	test('falls back to ordinary words when nothing matches the active special keys', () => {
		const words = ['cost', 'rest', 'mind'];
		const disabledEverything = [
			magicRuleMappingId('*', 'c'),
			adaptiveRuleMappingId(undefined, profile.adaptiveSwaps!.rules[0])
		];
		const lesson = selectTypingPracticeLessonWords({
			words: [...words, 'luck'],
			count: 3,
			specialWordsPercent: 100,
			profile,
			disabledMappingIds: disabledEverything,
			random: seededRandom(9)
		});
		expect(lesson).toHaveLength(3);

		const noProfileLesson = selectTypingPracticeLessonWords({
			words,
			count: 2,
			specialWordsPercent: 100,
			random: seededRandom(9)
		});
		expect(noProfileLesson).toHaveLength(2);
	});
});
