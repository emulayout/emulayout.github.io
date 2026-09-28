import { describe, expect, test } from 'bun:test';
import {
	DEFAULT_KEYBOARD_GEOMETRY,
	geometryLabel,
	parseKeyboardGeometry
} from '$lib/keyboardGeometry';
import { geometryToColemakCampKeyboard } from '$lib/colemakCamp';
import { buildCyanophagePlaygroundUrl } from '$lib/cyanophage';

const keys = {
	q: { row: 0, col: 0 },
	w: { row: 0, col: 1 }
};

describe('keyboard geometry preference', () => {
	test('parses only supported values and uses a row-stagger default', () => {
		expect(DEFAULT_KEYBOARD_GEOMETRY).toBe('row-stagger');
		expect(parseKeyboardGeometry('column-stagger')).toBe('column-stagger');
		expect(parseKeyboardGeometry('row-stagger')).toBe('row-stagger');
		expect(parseKeyboardGeometry('ortho')).toBe('row-stagger');
		expect(geometryLabel('row-stagger')).toBe('Row stagger');
	});

	test('maps geometry and Anglemod explicitly for external tools', () => {
		expect(geometryToColemakCampKeyboard('column-stagger')).toBe('ortho');
		expect(geometryToColemakCampKeyboard('row-stagger')).toBe('ansi');
		expect(geometryToColemakCampKeyboard('row-stagger', true)).toBe('iso');

		const columnUrl = new URL(buildCyanophagePlaygroundUrl(keys, 'column-stagger')!);
		const rowUrl = new URL(buildCyanophagePlaygroundUrl(keys, 'row-stagger')!);
		const angleUrl = new URL(
			buildCyanophagePlaygroundUrl(keys, 'row-stagger', undefined, 'l', {
				anglemod: true
			})!
		);

		expect(columnUrl.searchParams.get('mode')).toBe('ergo');
		expect(rowUrl.searchParams.get('mode')).toBe('ansi');
		expect(angleUrl.searchParams.get('mode')).toBe('iso');
	});
});
