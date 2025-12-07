export interface KeyInfo {
	row: number;
	col: number;
}

export interface LayoutData {
	name: string;
	user: number;
	board: string;
	keys: Record<string, KeyInfo>;
	hasThumbKeys: boolean;
	displayValue: string;
	characterSet: 'english' | 'international';
}
