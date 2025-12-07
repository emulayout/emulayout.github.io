interface KeyInfo {
	row: number;
	col: number;
}

export interface LayoutData {
	name: string;
	user: number;
	board: string;
	keys: Record<string, KeyInfo>;
	hasThumbKeys: boolean;
}

export function printPretty(data: LayoutData, splitCol = 5): string {
	const rows: Record<number, string[]> = {};

	Object.entries(data.keys).forEach(([key, info]) => {
		if (!rows[info.row]) rows[info.row] = [];
		rows[info.row][info.col] = key;
	});

	const out = Object.keys(rows)
		.sort((a, b) => Number(a) - Number(b))
		.map((row) => {
			const r = rows[Number(row)];
			// Find the max column that has a key
			const maxCol = r.reduce((max, _, i) => (r[i] !== undefined ? i : max), 0);
			// Fill gaps with space, up to maxCol
			const filled = Array.from({ length: maxCol + 1 }, (_, i) => r[i] ?? ' ');
			return (
				filled.slice(0, splitCol).join(' ') +
				'  ' + // extra gap between hands
				filled.slice(splitCol).join(' ')
			);
		})
		.join('\n');

	return out;
}
