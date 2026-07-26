import type { CompactLayout, CompactLayoutFile } from '../../../src/lib/layoutCodec';

const CMINI_USER_ID = Number('1085579430623199292');
const LELA_USER_ID = Number('805982808878350366');
const VALORANCE_USER_ID = Number('657688933001330718');
const STRAWBERRYTURTLE_USER_ID = Number('525811617473101824');
const STRONGLYTYPED_USER_ID = Number('130544188818194432');
const ACAS_USER_ID = Number('119825772901957632');
const IKCELAKS_USER_ID = Number('677630020696408090');
const FIVE_QUID_WYRM_USER_ID = Number('766194884095901746');
const KHARLAMAKOFF_USER_ID = Number('1010618301895934034');
const SMUDGE_USER_ID = Number('397759190543892480');

type CompactLayoutInput = {
	name: string;
	user: number;
	board: number;
	updatedAt: string;
	flags: number;
	rows: string[][];
	thumbHands?: string;
};

function compactLayout({
	name,
	user,
	board,
	updatedAt,
	flags,
	rows,
	thumbHands
}: CompactLayoutInput): CompactLayout {
	const keys: string[] = [];
	const rowNumbers: number[] = [];
	const columns: number[] = [];

	for (let row = 0; row < rows.length; row++) {
		for (let column = 0; column < rows[row].length; column++) {
			keys.push(rows[row][column]);
			rowNumbers.push(row);
			columns.push(column);
		}
	}

	return [name, user, board, updatedAt, flags, keys, rowNumbers, columns, thumbHands];
}

export const qwerty = compactLayout({
	name: 'QWERTY',
	user: CMINI_USER_ID,
	board: 1,
	updatedAt: '2023-05-16T00:00:01+00:00',
	flags: 2,
	rows: [
		['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
		['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'"],
		['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/']
	]
});

export const colemakDh = compactLayout({
	name: 'Colemak-DH',
	user: CMINI_USER_ID,
	board: 2,
	updatedAt: '2023-05-03T21:22:37+00:00',
	flags: 18,
	rows: [
		['q', 'w', 'f', 'p', 'b', 'j', 'l', 'u', 'y', ';'],
		['a', 'r', 's', 't', 'g', 'm', 'n', 'e', 'i', 'o', "'"],
		['z', 'x', 'c', 'd', 'v', 'k', 'h', ',', '.', '/']
	]
});

export const lela = compactLayout({
	name: 'lela',
	user: LELA_USER_ID,
	board: 0,
	updatedAt: '2023-07-01T00:00:01+00:00',
	flags: 18,
	rows: [
		['y', 'l', 'g', 'm', 'q', 'j', 'f', 'o', 'u', ','],
		['c', 'r', 's', 't', 'k', 'b', 'n', 'a', 'e', 'i'],
		['x', 'w', 'd', 'v', 'z', 'p', 'h', "'", '/', '.']
	]
});

export const night = compactLayout({
	name: 'night',
	user: VALORANCE_USER_ID,
	board: 2,
	updatedAt: '2024-11-15T00:00:01+00:00',
	flags: 19,
	rows: [
		['b', 'f', 'l', 'k', 'q', 'p', 'g', 'o', 'u', '.'],
		['n', 's', 'h', 't', 'm', 'y', 'c', 'a', 'e', 'i'],
		['x', 'v', 'j', 'd', 'z', "'", 'w', ';', '/', ','],
		['r']
	],
	thumbHands: 'l'
});

export const turnip = compactLayout({
	name: 'turnip',
	user: STRAWBERRYTURTLE_USER_ID,
	board: 0,
	updatedAt: '2026-07-20T00:00:03+00:00',
	flags: 51,
	rows: [
		['x', 'l', 'y', 'w', 'z', "'", 'f', 'o', 'u', '.'],
		['n', 'r', 's', 'd', 'g', 'b', 'h', 'a', 'e', 'i'],
		['j', 'v', 'c', 'm', 'q', 'k', 'p', ';', '/', ','],
		['t']
	],
	thumbHands: 'r'
});

export const graphite = compactLayout({
	name: 'graphite',
	user: STRONGLYTYPED_USER_ID,
	board: 2,
	updatedAt: '2023-09-01T00:00:01+00:00',
	flags: 2,
	rows: [
		['b', 'l', 'd', 'w', 'z', "'", 'f', 'o', 'u', 'j', ';', '='],
		['n', 'r', 't', 's', 'g', 'y', 'h', 'a', 'e', 'i', ','],
		['q', 'x', 'm', 'c', 'v', 'k', 'p', '.', '-', '/']
	]
});

export const vylet = compactLayout({
	name: 'vylet',
	user: ACAS_USER_ID,
	board: 2,
	updatedAt: '2026-05-18T00:00:03+00:00',
	flags: 6,
	rows: [
		['w', 'c', 'm', 'p', 'b', 'x', 'l', 'o', 'u', 'j', '-'],
		['r', 's', 't', 'h', 'f', 'y', 'n', 'a', 'e', 'i', ','],
		['q', 'v', 'g', 'd', 'k', 'z', '*', "'", ';', '.']
	]
});

export const magicSturdy = compactLayout({
	name: 'magic_sturdy',
	user: IKCELAKS_USER_ID,
	board: 2,
	updatedAt: '2024-05-12T00:00:02+00:00',
	flags: 5,
	rows: [
		['v', 'm', 'l', 'c', 'p', 'b', '*', 'u', 'o', ','],
		['s', 't', 'r', 'd', 'y', 'f', 'n', 'e', 'a', 'i'],
		['x', 'k', 'j', 'g', 'w', 'z', 'h', ';', "'", '.'],
		['@']
	],
	thumbHands: 'r'
});

export const nokwts = compactLayout({
	name: 'nokwts',
	user: STRONGLYTYPED_USER_ID,
	board: 1,
	updatedAt: '2026-05-26T00:00:02+00:00',
	flags: 18,
	rows: [
		['z', 'b', 'r', 'l', 'f', 'j', 'y', 'o', 'u', "'"],
		['n', 't', 'h', 's', 'm', 'c', 'd', 'e', 'i', 'a', ','],
		['q', 'x', 'w', 'k', 'v', 'p', 'g', '/', '.', ';']
	]
});

export const alphabetTest = compactLayout({
	name: 'alphabet-test',
	user: FIVE_QUID_WYRM_USER_ID,
	board: 3,
	updatedAt: '2025-02-22T00:00:02+00:00',
	flags: 18,
	rows: [
		['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
		['k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's'],
		['t', 'u', 'v', 'w', 'x', 'y', 'z']
	]
});

export const callisto = compactLayout({
	name: 'callisto',
	user: KHARLAMAKOFF_USER_ID,
	board: 2,
	updatedAt: '2024-12-14T00:00:02+00:00',
	flags: 8,
	rows: [
		['ы', 'у', 'е', 'д', 'ц', 'ж', 'г', 'к', 'л', 'з', 'щ', 'ъ'],
		['и', 'о', 'а', 'с', 'б', 'м', 'в', 'н', 'р', 'т', 'ф'],
		['ё', 'я', 'ю', 'ч', 'э', 'х', 'ь', 'п', 'й', 'ш']
	]
});

export const megamak = compactLayout({
	name: 'Megamak',
	user: SMUDGE_USER_ID,
	board: 0,
	updatedAt: '2023-06-06T00:00:01+00:00',
	flags: 18,
	rows: [
		['x', 'l', 'y', 'w', 'k', 'z', 'f', 'o', 'u', ';'],
		['c', 'r', 's', 't', 'g', 'b', 'n', 'e', 'i', 'a', "'"],
		['j', 'v', 'd', 'm', 'q', 'p', 'h', '/', ',', '.']
	]
});

export const coreCatalog: CompactLayoutFile = [qwerty, colemakDh, lela];

export const catalog: CompactLayoutFile = [
	...coreCatalog,
	night,
	turnip,
	graphite,
	vylet,
	magicSturdy,
	nokwts,
	alphabetTest,
	callisto,
	megamak
];

export const authors = {
	cmini: CMINI_USER_ID,
	lelazsq: LELA_USER_ID,
	va1orance: VALORANCE_USER_ID,
	strawberryturtle: STRAWBERRYTURTLE_USER_ID,
	stronglytyped: STRONGLYTYPED_USER_ID,
	acas: ACAS_USER_ID,
	ikcelaks: IKCELAKS_USER_ID,
	'5quidwyrm': FIVE_QUID_WYRM_USER_ID,
	kharlamakoff: KHARLAMAKOFF_USER_ID,
	Smudge: SMUDGE_USER_ID
};
