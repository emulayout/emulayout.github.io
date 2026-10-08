import { describe, expect, test } from 'bun:test';
import { hasMagicKey, hasRepeatKey } from '../bin/layout-features.js';

describe('layout contextual feature classification', () => {
	test('uses AKL mappings for Magic and unclaimed @ for Repeat', () => {
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
