import { describe, expect, test } from 'bun:test';
import {
	cloneFingerWorkloadPreferences,
	createDefaultFingerWorkloadPreference,
	createEmptyFingerWorkloadPreferences,
	fingerWorkloadHandPreferencesEqual,
	formatFingerWorkloadPreference,
	hasActiveFingerWorkloadPreference,
	hasActiveFingerWorkloadHandPreference,
	hasConfiguredFingerWorkloadPreference,
	matchesFingerWorkloadPreference,
	normalizeFingerWorkloadPreferences
} from '$lib/fingerWorkload';

describe('finger workload preferences', () => {
	test('default, clone, and normalization keep analyzer preferences independent', () => {
		const preferences = createEmptyFingerWorkloadPreferences();
		preferences.cmini.left.middle = 'heavy';

		const clone = cloneFingerWorkloadPreferences(preferences);
		clone.cmini.left.middle = 'light';
		clone.cyanophage.right.index = 'medium';

		expect(preferences.cmini.left.middle).toBe('heavy');
		expect(preferences.cmini.right.middle).toBe('none');
		expect(preferences.cyanophage.right.index).toBe('none');
		expect(
			normalizeFingerWorkloadPreferences({
				cmini: {
					left: { pinky: 'lightest', middle: 'invalid' },
					right: { middle: 'heavy' }
				},
				mana2: { left: { index: 'heavy' } }
			})
		).toMatchObject({
			cmini: {
				left: { pinky: 'lightest', middle: 'none' },
				right: { middle: 'heavy' }
			},
			mana2: { left: { index: 'heavy' }, right: { index: 'none' } }
		});
	});

	test('requires two distinct configured levels on the same hand before filtering', () => {
		const preference = createDefaultFingerWorkloadPreference();
		expect(hasConfiguredFingerWorkloadPreference(preference)).toBe(false);
		expect(hasActiveFingerWorkloadPreference(preference)).toBe(false);

		preference.left.middle = 'heavy';
		expect(hasConfiguredFingerWorkloadPreference(preference)).toBe(true);
		expect(hasActiveFingerWorkloadPreference(preference)).toBe(false);

		preference.left.index = 'heavy';
		expect(hasActiveFingerWorkloadPreference(preference)).toBe(false);

		preference.right.index = 'medium';
		expect(hasActiveFingerWorkloadPreference(preference)).toBe(false);

		preference.left.index = 'medium';
		expect(hasActiveFingerWorkloadPreference(preference)).toBe(true);
		expect(hasActiveFingerWorkloadHandPreference(preference.left)).toBe(true);
		expect(hasActiveFingerWorkloadHandPreference(preference.right)).toBe(false);
	});

	test('matches each hand against its own independent preference', () => {
		const preference = {
			left: {
				pinky: 'lightest',
				ring: 'light',
				middle: 'heavy',
				index: 'medium'
			},
			right: {
				pinky: 'heavy',
				ring: 'medium',
				middle: 'light',
				index: 'lightest'
			}
		} as const;
		const matching = {
			LP: 0.03,
			LR: 0.07,
			LI: 0.18,
			LM: 0.22,
			RP: 0.23,
			RR: 0.18,
			RI: 0.02,
			RM: 0.08
		};

		expect(matchesFingerWorkloadPreference(matching, preference)).toBe(true);
		expect(matchesFingerWorkloadPreference({ ...matching, RP: 0.01 }, preference)).toBe(false);
		expect(formatFingerWorkloadPreference(preference)).toBe('LH M > I > R > P · RH P > R > M > I');
	});

	test('does not compare fingers assigned the same level or no preference', () => {
		const preference = {
			left: {
				pinky: 'none',
				ring: 'light',
				middle: 'heavy',
				index: 'heavy'
			},
			right: {
				pinky: 'none',
				ring: 'none',
				middle: 'none',
				index: 'none'
			}
		} as const;

		expect(
			matchesFingerWorkloadPreference(
				{
					LP: 0.4,
					LR: 0.05,
					LI: 0.2,
					LM: 0.15,
					RP: 0.4,
					RR: 0.3,
					RI: 0.01,
					RM: 0.02
				},
				preference
			)
		).toBe(true);
	});

	test('normalizes legacy shared preferences to both hands', () => {
		const normalized = normalizeFingerWorkloadPreferences({
			cmini: { middle: 'heavy', index: 'medium' }
		});

		expect(fingerWorkloadHandPreferencesEqual(normalized.cmini.left, normalized.cmini.right)).toBe(
			true
		);
		expect(formatFingerWorkloadPreference(normalized.cmini)).toBe('Both M > I');
		expect(normalized.cmini.left).toMatchObject({ middle: 'heavy', index: 'medium' });
		expect(normalized.cmini.right).toMatchObject({ middle: 'heavy', index: 'medium' });
	});
});
