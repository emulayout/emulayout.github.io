import { expect, test } from 'bun:test';
import { decodeLayout } from '$lib/layoutCodec';
import { createLayoutFromSparkKeys } from '$lib/creatorGeometry';
import { fingerForSlot } from '$lib/fingerAssignments';

test('catalog fingers follow physical slots, including duplicate characters and nonstandard fingering', () => {
	const source = {
		name: 'fingers',
		user: '1',
		positions: [
			{ char: 'a', row: 1, col: 0, finger: 'LM' },
			{ char: 'a', row: 1, col: 1, finger: 'RI' },
			{ char: 'e', row: 3, col: 0, finger: 'LT' }
		]
	};
	const result = Bun.spawnSync([
		process.execPath,
		'-e',
		`import {transformLayout} from './bin/layout-transformer.js'; import {encodeLayout} from './bin/layout-codec.js'; console.log(JSON.stringify(encodeLayout(transformLayout(${JSON.stringify(source)}))));`
	]);
	expect(result.exitCode).toBe(0);
	const wire = JSON.parse(result.stdout.toString());
	const layout = decodeLayout(wire);
	expect(fingerForSlot(layout, '1,0')).toBe('LM');
	expect(fingerForSlot(layout, '1,1')).toBe('RI');
	expect(fingerForSlot(layout, '3,0')).toBe('LT');
	expect(fingerForSlot(decodeLayout(wire.slice(0, 9)), '1,0')).toBeUndefined();
});

test('Spark previews preserve exact finger assignments without changing character geometry', () => {
	const layout = createLayoutFromSparkKeys([{ char: 'a', row: 1, col: 0, finger: 'RM' }]);
	expect(fingerForSlot(layout, '1,0')).toBe('RM');
	expect(layout.keys.a).toMatchObject({ row: 1, col: 0 });
});
