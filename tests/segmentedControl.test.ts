import { describe, expect, test } from 'bun:test';
import { getRovingSelectionIndex, type SegmentedOption } from '$lib/segmentedControl';

const options: readonly SegmentedOption<'first' | 'second'>[] = [
	{ value: 'first', label: 'First' },
	{ value: 'second', label: 'Second' }
];

describe('segmented-control roving focus', () => {
	test('uses the selected option when the value is valid', () => {
		expect(getRovingSelectionIndex(options, 'second')).toBe(1);
	});

	test('keeps a runtime-invalid selection reachable from the keyboard', () => {
		expect(getRovingSelectionIndex(options, 'missing' as 'first')).toBe(0);
		expect(getRovingSelectionIndex([], 'first')).toBe(-1);
	});
});
