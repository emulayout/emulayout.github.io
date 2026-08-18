import { describe, expect, test } from 'bun:test';
import {
	defaultMagicMappings,
	hasAdaptiveSwapMappings,
	hasMagicKey,
	hasMagicKeyMappings,
	hasRepeatKey
} from '../bin/layout-features.js';

describe('layout contextual feature classification', () => {
	test('uses cminibrowser mappings for Magic and unclaimed @ for Repeat', () => {
		expect(hasMagicKey({ '*': {}, '@': {} }, undefined)).toBe(false);
		expect(hasRepeatKey({ '*': {}, '@': {} }, undefined)).toBe(true);

		expect(hasMagicKey({ '@': {} }, undefined)).toBe(false);
		expect(hasRepeatKey({ '@': {} }, undefined)).toBe(true);
	});

	test('lets an explicit @ Magic mapping override Repeat classification', () => {
		const keys = { a: {}, '@': {} };
		const mappings = { '@': { a: 'o' } };

		expect(hasMagicKey(keys, mappings)).toBe(true);
		expect(hasRepeatKey(keys, mappings)).toBe(false);
	});

	test('treats any exported trigger symbol as Magic', () => {
		const keys = { a: {}, '#': {} };
		const mappings = { '#': { a: 'o' } };

		expect(hasMagicKey(keys, mappings)).toBe(true);
		expect(hasRepeatKey(keys, mappings)).toBe(false);
	});
});

describe('mapping availability across variants', () => {
	const magicVariant = { id: 'v1', magicKeys: { mappings: { '*': { a: 'o' } } } };
	const adaptiveVariant = { id: 'v2', adaptiveSwaps: { mappings: { l: { y: 'j' } } } };

	test('reports a feature when any variant carries it', () => {
		expect(hasMagicKeyMappings([magicVariant, adaptiveVariant])).toBe(true);
		expect(hasAdaptiveSwapMappings([magicVariant, adaptiveVariant])).toBe(true);
		expect(hasMagicKeyMappings([adaptiveVariant])).toBe(false);
		expect(hasAdaptiveSwapMappings([])).toBe(false);
	});

	test('scopes Repeat classification to the variant loaded first', () => {
		const keys = { a: {}, '@': {} };
		const claimsAt = { id: 'v0', magicKeys: { mappings: { '@': { a: 'o' } } } };

		expect(hasRepeatKey(keys, defaultMagicMappings([claimsAt, magicVariant]))).toBe(false);
		expect(hasRepeatKey(keys, defaultMagicMappings([magicVariant, claimsAt]))).toBe(true);
		expect(hasRepeatKey(keys, defaultMagicMappings([]))).toBe(true);
	});
});
