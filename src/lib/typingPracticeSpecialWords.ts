import type { LayoutInputProfile } from '$lib/layoutInputBehaviors';
import {
	selectRandomTypingPracticeWords,
	type TypingPracticeRandomSource
} from '$lib/typingPractice';
import { buildTypingPracticeAdaptiveGroupIndexes } from '$lib/typingPracticeAdaptiveGroups';
import { buildTypingPracticeMagicGroupIndexes } from '$lib/typingPracticeMagicGroups';

/**
 * Whether part of the word can be produced by an enabled Magic rule or
 * Adaptive swap. Mappings disabled for the current page session do not count,
 * so focusing on one group narrows which words qualify.
 */
export function isTypingPracticeSpecialWord(
	word: string,
	profile: LayoutInputProfile | undefined,
	disabledMappingIds: readonly string[] = []
): boolean {
	if (!profile) return false;
	return (
		buildTypingPracticeMagicGroupIndexes(word, profile.magicKeys, disabledMappingIds).size > 0 ||
		buildTypingPracticeAdaptiveGroupIndexes(word, profile, disabledMappingIds).size > 0
	);
}

export function filterTypingPracticeSpecialWords(
	words: readonly string[],
	profile: LayoutInputProfile | undefined,
	disabledMappingIds: readonly string[] = []
): string[] {
	if (!profile?.magicKeys && !profile?.adaptiveSwaps) return [];
	return words.filter((word) => isTypingPracticeSpecialWord(word, profile, disabledMappingIds));
}

export function clampTypingPracticeSpecialWordsPercent(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(Math.max(Math.round(value), 0), 100);
}

export interface TypingPracticeLessonWordOptions {
	words: readonly string[];
	count: number;
	/** Share of lesson words that must contain a special-key match; 100 means only such words. */
	specialWordsPercent: number;
	profile?: LayoutInputProfile;
	disabledMappingIds?: readonly string[];
	excludedWords?: readonly string[];
	random?: TypingPracticeRandomSource;
}

function selectOnlySpecialWords(
	pool: readonly string[],
	count: number,
	random: TypingPracticeRandomSource
): string[] {
	const selection: string[] = [];
	while (selection.length < count) {
		const batch = selectRandomTypingPracticeWords(
			pool,
			Math.min(count - selection.length, pool.length),
			random
		);
		if (batch.length === 0) break;
		selection.push(...batch);
	}
	return selection;
}

/**
 * Pick lesson words honoring the requested special-word balance.
 *
 * At 100% the lesson uses only words with an enabled special-key match,
 * cycling through them when fewer unique candidates exist than the lesson
 * needs. Below 100% the requested share is drawn from the candidates and the
 * remainder from ordinary words, then the lesson order is shuffled. Excluded
 * words (the previous lesson) are skipped unless doing so would empty a pool.
 * With no matching candidates the selection falls back to ordinary random
 * words so practice keeps working.
 */
export function selectTypingPracticeLessonWords({
	words,
	count,
	specialWordsPercent,
	profile,
	disabledMappingIds = [],
	excludedWords = [],
	random = Math.random
}: TypingPracticeLessonWordOptions): string[] {
	const percent = clampTypingPracticeSpecialWordsPercent(specialWordsPercent);
	const excluded = new Set(excludedWords);
	const unexcludedWords = words.filter((word) => !excluded.has(word));
	const candidates =
		percent > 0 ? filterTypingPracticeSpecialWords(words, profile, disabledMappingIds) : [];
	if (candidates.length === 0) {
		return selectRandomTypingPracticeWords(unexcludedWords, count, random);
	}

	const unexcludedCandidates = candidates.filter((word) => !excluded.has(word));
	const specialPool = unexcludedCandidates.length > 0 ? unexcludedCandidates : candidates;
	if (percent >= 100) {
		return selectOnlySpecialWords(specialPool, count, random);
	}

	const specialTarget = Math.min(Math.round((count * percent) / 100), specialPool.length);
	const specialWords = selectRandomTypingPracticeWords(specialPool, specialTarget, random);
	const candidateSet = new Set(candidates);
	const unexcludedOthers = unexcludedWords.filter((word) => !candidateSet.has(word));
	const otherPool =
		unexcludedOthers.length > 0
			? unexcludedOthers
			: words.filter((word) => !candidateSet.has(word));
	const otherWords = selectRandomTypingPracticeWords(
		otherPool,
		count - specialWords.length,
		random
	);

	const lesson = [...specialWords, ...otherWords];
	return selectRandomTypingPracticeWords(lesson, lesson.length, random);
}
