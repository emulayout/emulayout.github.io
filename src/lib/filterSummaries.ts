import { SPLIT_COL } from '$lib/cmini/keyboard';
import type { FilterStore } from '$lib/filterStore.svelte';
import {
	getGeneralStatFilterRowsForAnalyzer,
	LEFT_HAND_STAT_FILTER_FIELDS,
	LIKES_STAT_FILTER_FIELD,
	RIGHT_HAND_STAT_FILTER_FIELDS,
	type StatFilterField
} from '$lib/layoutStats';

function collectHandKeys(
	grid: string[][],
	leftThumbs: string[],
	rightThumbs: string[]
): { left: string[]; right: string[] } {
	const left: string[] = [];
	const right: string[] = [];

	for (const row of grid) {
		for (let col = 0; col < row.length; col++) {
			const cell = row[col];
			if (!cell) continue;
			if (col < SPLIT_COL) left.push(cell);
			else right.push(cell);
		}
	}

	for (const key of leftThumbs) {
		if (key) left.push(key);
	}
	for (const key of rightThumbs) {
		if (key) right.push(key);
	}

	return { left, right };
}

function formatKeySection(
	label: string,
	grid: string[][],
	leftThumbs: string[],
	rightThumbs: string[]
): string | null {
	const { left, right } = collectHandKeys(grid, leftThumbs, rightThumbs);
	if (left.length === 0 && right.length === 0) return null;

	const hands: string[] = [];
	if (left.length > 0) hands.push(`LH - ${left.join(',')}`);
	if (right.length > 0) hands.push(`RH: ${right.join(',')}`);
	return `${label}: ${hands.join(', ')}`;
}

/** Collapsed key-filter preview (same format as the old accordion). */
export function getKeyFiltersSummary(store: FilterStore): string {
	return [
		formatKeySection(
			'AND',
			store.includeGrid,
			store.includeLeftThumbKeys,
			store.includeRightThumbKeys
		),
		formatKeySection(
			'OR',
			store.includeOrGrid,
			store.includeOrLeftThumbKeys,
			store.includeOrRightThumbKeys
		),
		formatKeySection(
			'Exclude',
			store.excludeGrid,
			store.excludeLeftThumbKeys,
			store.excludeRightThumbKeys
		)
	]
		.filter((part): part is string => part !== null)
		.join(' • ');
}

function operatorSymbol(operator: 'lt' | 'gt'): string {
	return operator === 'lt' ? '<' : '>';
}

function formatActiveLimit(store: FilterStore, field: StatFilterField, label: string): string | null {
	const limit = store.statLimits[field.key];
	const value = limit.value.trim();
	if (!value) return null;
	const unit = field.unit === 'raw' ? '' : '%';
	return `${label} ${operatorSymbol(limit.operator)} ${value}${unit}`;
}

function handSummaryLabel(hand: 'LH' | 'RH', field: StatFilterField): string {
	if (field.key === 'lh' || field.key === 'rh') return hand;
	return `${hand} ${field.label}`;
}

/** Collapsed stat-filter preview (same format as the old accordion). */
export function getStatFiltersSummary(store: FilterStore): string {
	const parts: string[] = [];
	const rows = getGeneralStatFilterRowsForAnalyzer(store.statsAnalyzer);

	for (const row of rows) {
		for (const field of row) {
			const part = formatActiveLimit(store, field, field.label);
			if (part) parts.push(part);
		}
	}

	if (store.canUseLikes) {
		const part = formatActiveLimit(store, LIKES_STAT_FILTER_FIELD, LIKES_STAT_FILTER_FIELD.label);
		if (part) parts.push(part);
	}

	for (const field of LEFT_HAND_STAT_FILTER_FIELDS) {
		const part = formatActiveLimit(store, field, handSummaryLabel('LH', field));
		if (part) parts.push(part);
	}

	for (const field of RIGHT_HAND_STAT_FILTER_FIELDS) {
		const part = formatActiveLimit(store, field, handSummaryLabel('RH', field));
		if (part) parts.push(part);
	}

	return parts.join(' • ');
}

const BOARD_TYPE_LABELS: Record<string, string> = {
	angle: 'Angle',
	stagger: 'Stagger',
	'angle-stagger': 'Angle+stagger',
	ortho: 'Ortho',
	mini: 'Mini'
};

const CHARSET_LABELS: Record<string, string> = {
	all: 'All chars',
	international: 'Intl'
};

/** Collapsed keyboard-filter preview. */
export function getKeyboardFiltersSummary(store: FilterStore): string {
	const parts: string[] = [];

	if (store.thumbKeyFilter !== 'optional') {
		parts.push(`Thumbs ${store.thumbKeyFilter}`);
	}
	if (store.magicKeyFilter !== 'optional') {
		parts.push(`Magic ${store.magicKeyFilter}`);
	}
	if (store.boardTypeFilter !== 'all') {
		parts.push(BOARD_TYPE_LABELS[store.boardTypeFilter] ?? store.boardTypeFilter);
	}
	if (store.characterSetFilter !== 'english') {
		parts.push(CHARSET_LABELS[store.characterSetFilter] ?? store.characterSetFilter);
	}
	if (store.showUnfinished) {
		parts.push('Unfinished');
	}

	return parts.join(' • ');
}
