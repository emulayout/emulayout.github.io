import { describe, expect, test } from 'bun:test';
import {
	ansiThumbDisplayColumn,
	ansiThumbOffsetCss,
	splitThumbDisplayKeys,
	thumbTargetColumns
} from '../src/lib/layoutDisplay';

describe('thumbTargetColumns', () => {
	test('places a single pair under the index-finger columns with a gap between them', () => {
		expect(thumbTargetColumns('left', 1)).toEqual([3]);
		expect(thumbTargetColumns('right', 1)).toEqual([6]);
	});

	test('grows extra thumbs outward from those index columns', () => {
		expect(thumbTargetColumns('left', 2)).toEqual([3, 4]);
		expect(thumbTargetColumns('left', 3)).toEqual([2, 3, 4]);
		expect(thumbTargetColumns('right', 2)).toEqual([6, 7]);
		expect(thumbTargetColumns('right', 3)).toEqual([6, 7, 8]);
	});
});

describe('ansiThumbDisplayColumn', () => {
	test('shifts stagger thumbs a half column so they sit between bottom-row index keys', () => {
		expect(ansiThumbDisplayColumn(3)).toBe(2.5);
		expect(ansiThumbDisplayColumn(6)).toBe(5.5);
	});
});

describe('ansiThumbOffsetCss', () => {
	test('uses the same size and gap formula as the presentation keyboard', () => {
		expect(ansiThumbOffsetCss(2.5, 'var(--preview-key-size)', 'var(--preview-key-gap)')).toBe(
			'calc(var(--preview-key-size) * 3.18 + var(--preview-key-gap) * 2.5)'
		);
	});
});

describe('splitThumbDisplayKeys', () => {
	test('keeps duplicate thumb letters on their assigned hands', () => {
		const keys = [
			{ char: 'e', slot: '3,0' },
			{ char: 'e', slot: '3,1' }
		];
		const split = splitThumbDisplayKeys(keys, {
			l: [{ key: 'e', col: 0 }],
			r: [{ key: 'e', col: 1 }]
		});

		expect(split.left).toEqual([{ char: 'e', slot: '3,0' }]);
		expect(split.right).toEqual([{ char: 'e', slot: '3,1' }]);
		expect(thumbTargetColumns('left', split.left.length)).toEqual([3]);
		expect(thumbTargetColumns('right', split.right.length)).toEqual([6]);
	});
});
