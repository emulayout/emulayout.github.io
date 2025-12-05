interface KeyInfo {
	row: number;
	col: number;
}

export interface LayoutData {
	name: string;
	user: number;
	board: string;
	keys: Record<string, KeyInfo>;
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
			return (
				r.slice(0, splitCol).join(' ') +
				'  ' + // extra gap between hands
				r.slice(splitCol).join(' ')
			);
		})
		.join('\n');

	return out;
}
