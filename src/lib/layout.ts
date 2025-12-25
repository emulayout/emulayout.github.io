export interface KeyInfo {
	row: number;
	col: number;
}

export type BoardType = 'angle' | 'stagger' | 'ortho' | 'mini';

export interface LayoutData {
	name: string;
	user: number;
	board: BoardType;
	keys: Record<string, KeyInfo>;
	hasThumbKeys: boolean;
	displayValue: string;
	characterSet: 'english' | 'international';
	hasAllLetters: boolean;
	hasMagicKey: boolean;
}
