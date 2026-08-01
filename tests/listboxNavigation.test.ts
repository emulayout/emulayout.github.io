import { describe, expect, test } from 'bun:test';
import { navigateListIndex } from '$lib/listboxNavigation';

describe('listbox navigation', () => {
	test('wraps arrow navigation and supports listbox boundaries', () => {
		expect(navigateListIndex('ArrowDown', 2, 3)).toBe(0);
		expect(navigateListIndex('ArrowUp', 0, 3)).toBe(2);
		expect(navigateListIndex('Home', 2, 3)).toBe(0);
		expect(navigateListIndex('End', 0, 3)).toBe(2);
	});

	test('preserves Home and End for editable combobox inputs', () => {
		expect(navigateListIndex('Home', 2, 3, { homeEnd: false })).toBeNull();
		expect(navigateListIndex('End', 0, 3, { homeEnd: false })).toBeNull();
		expect(navigateListIndex('ArrowDown', 0, 3, { homeEnd: false })).toBe(1);
	});

	test('ignores unrelated keys and empty lists', () => {
		expect(navigateListIndex('Enter', 0, 3)).toBeNull();
		expect(navigateListIndex('ArrowDown', 0, 0)).toBeNull();
	});
});
