import type { CompactLayout } from '$lib/layoutCodec';

/** Verified authored coordinates and fingers, including the intentionally absent upper column 0. */
export function easyHarlot(topology: 'ansi' | 'iso'): CompactLayout {
	const rows = [" bfrlv'wou.", ' nshtdpyaei,', topology === 'iso' ? 'qxzkmjcg' : ' qzkmjcgx'];
	const fingers = [
		['', 'LP', 'LR', 'LM', 'LM', 'LI', 'RI', 'RI', 'RM', 'RR', 'RP'],
		['', 'LP', 'LR', 'LM', 'LI', 'LI', 'RI', 'RI', 'RM', 'RR', 'RP', 'RP'],
		topology === 'iso'
			? ['LP', 'LR', 'LR', 'LI', 'LI', 'LI', 'RI', 'RI']
			: ['', 'LR', 'LR', 'LI', 'LI', 'LI', 'RI', 'RI', 'RM']
	];
	const keys = rows.flatMap((row, r) =>
		[...row].flatMap((char, c) =>
			char === ' ' ? [] : [{ char, row: r, col: c, finger: fingers[r][c] }]
		)
	);
	return [
		`easy-harlot-${topology}`,
		'1552728612510244965',
		4,
		'2026-11-06T06:20:10.231Z',
		18,
		keys.map((key) => key.char),
		keys.map((key) => key.row),
		keys.map((key) => key.col),
		'',
		{ fingers: keys.map((key) => key.finger) }
	];
}
