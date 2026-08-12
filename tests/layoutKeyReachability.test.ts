import { describe, expect, test } from 'bun:test';
import { decodeLayout, type CompactLayout } from '$lib/layoutCodec';
import { createDefaultKeyboardInputConfig } from '$lib/keyboardInputConfig';
import { feelKeystrokeAccepts, planFeelWord } from '$lib/layoutFeel';
import {
	collectReachableTargetCharacters,
	filterWordsByReachableCharacters,
	typingPracticeWordsForReachability,
	unreachableLayoutKeyTitle,
	unreachableTargetLayoutKeys
} from '$lib/layoutKeyReachability';
import { createLayoutTestKeyMaps } from '$lib/layoutTestEmulator';

const nightLike: CompactLayout = [
	'night-like',
	1,
	2,
	'2026-01-01T00:00:00Z',
	4,
	['q', 'w', 'e', 'r'],
	[0, 0, 0, 3],
	[0, 1, 2, 0],
	'l'
];

describe('layout key reachability', () => {
	test('marks unassigned thumbs unreachable and keeps main-grid letters reachable', () => {
		const layout = decodeLayout(nightLike);
		const keyMaps = createLayoutTestKeyMaps('q w e');
		const reachable = collectReachableTargetCharacters(
			keyMaps,
			layout,
			createDefaultKeyboardInputConfig(),
			{ simulateThumbKeys: false }
		);
		const unreachable = unreachableTargetLayoutKeys(layout, reachable);

		expect(reachable.has('q')).toBe(true);
		expect(reachable.has('w')).toBe(true);
		expect(reachable.has('e')).toBe(true);
		expect(reachable.has(' ')).toBe(true);
		expect(unreachable.has('r')).toBe(true);
		expect(unreachable.has('q')).toBe(false);
	});

	test('treats thumbs as reachable while Simulate thumb keys is on', () => {
		const layout = decodeLayout(nightLike);
		const keyMaps = createLayoutTestKeyMaps('q w e');
		const reachable = collectReachableTargetCharacters(
			keyMaps,
			layout,
			createDefaultKeyboardInputConfig(),
			{ simulateThumbKeys: true }
		);
		const unreachable = unreachableTargetLayoutKeys(layout, reachable);

		expect(reachable.has('r')).toBe(true);
		expect(unreachable.has('r')).toBe(false);
	});

	test('filters random-lesson words that need unreachable characters', () => {
		const unreachable = new Set(['r']);
		expect(filterWordsByReachableCharacters(['rare', 'we', 'error', 'oak'], unreachable)).toEqual([
			'we',
			'oak'
		]);
		expect(typingPracticeWordsForReachability(['rare', 'error'], unreachable)).toEqual([
			'rare',
			'error'
		]);
	});

	test('adds a Simulate thumb keys hint for unreachable thumbs', () => {
		expect(unreachableLayoutKeyTitle({ isThumb: false })).toContain('excluded from random lessons');
		expect(unreachableLayoutKeyTitle({ isThumb: true })).toContain('Simulate thumb keys');
	});

	test('feeds reachability into Feel soft-lock and random-word filtering', () => {
		const layout = decodeLayout(nightLike);
		const keyMaps = createLayoutTestKeyMaps('q w e');
		const unreachable = unreachableTargetLayoutKeys(
			layout,
			collectReachableTargetCharacters(keyMaps, layout, createDefaultKeyboardInputConfig(), {
				simulateThumbKeys: false
			})
		);

		expect(unreachable.has('r')).toBe(true);
		expect(filterWordsByReachableCharacters(['rare', 'we', 'error'], unreachable)).toEqual(['we']);

		const plan = planFeelWord('rare', ['r', 'a', 'r', 'e'], undefined, [], {}, unreachable);
		expect(plan.keystrokes[0]?.unreachable).toBe(true);
		expect(plan.keystrokes[0]?.feel).toBe('r');
		expect(feelKeystrokeAccepts(plan.keystrokes[0]!, 'r')).toBe(false);
		expect(feelKeystrokeAccepts(plan.keystrokes[1]!, 'a')).toBe(true);
	});
});
