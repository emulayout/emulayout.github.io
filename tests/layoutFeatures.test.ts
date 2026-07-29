import { describe, expect, test } from 'bun:test';
import { hasMagicKey, hasMagicKeyMarker, hasRepeatKey } from '../bin/layout-features.js';

describe('layout contextual feature classification', () => {
	test('treats * as the conventional Magic marker and unclaimed @ as Repeat', () => {
		expect(hasMagicKeyMarker({ '*': {}, '@': {} })).toBe(true);
		expect(hasMagicKey({ '*': {}, '@': {} }, undefined)).toBe(true);
		expect(hasRepeatKey({ '*': {}, '@': {} }, undefined)).toBe(true);

		expect(hasMagicKeyMarker({ '@': {} })).toBe(false);
		expect(hasMagicKey({ '@': {} }, undefined)).toBe(false);
		expect(hasRepeatKey({ '@': {} }, undefined)).toBe(true);
	});

	test('lets an explicit @ Magic mapping override Repeat classification', () => {
		const keys = { a: {}, '@': {} };
		const mappings = { '@': { a: 'o' } };

		expect(hasMagicKey(keys, mappings)).toBe(true);
		expect(hasRepeatKey(keys, mappings)).toBe(false);
	});

	test('treats any curated trigger symbol as Magic', () => {
		const keys = { a: {}, '#': {} };
		const mappings = { '#': { a: 'o' } };

		expect(hasMagicKeyMarker(keys)).toBe(false);
		expect(hasMagicKey(keys, mappings)).toBe(true);
		expect(hasRepeatKey(keys, mappings)).toBe(false);
	});
});
