import { SPLIT_COL } from '$lib/cmini/keyboard';
import type {
	AdaptiveSwapFilter,
	BoardTypeFilter,
	CharacterSetFilter,
	MagicKeyFilter,
	StatLimit,
	StatLimitOperator,
	ThumbKeyFilter,
	ViewFilterSnapshot
} from '$lib/filterSnapshot';
import type { FilterFocusRequest, KeyFilterKind } from '$lib/filterFocus';
import {
	CYANOPHAGE_ANALYZER,
	CMINI_ANALYZER,
	MANA2_ANALYZER,
	analyzerShortLabel,
	STAT_ANALYZERS,
	type StatsAnalyzer
} from '$lib/statsAnalyzers';
import {
	getGeneralStatFilterRowsForAnalyzer,
	getLeftHandStatFilterFieldsForAnalyzer,
	getRightHandStatFilterFieldsForAnalyzer,
	LIKES_STAT_FILTER_FIELD,
	type StatFilterField,
	type StatLimitKey
} from '$lib/statsFiltering';

/** Minimal fields needed to render active-filter chips (live store or shared snapshot). */
export type FilterChipSource = {
	nameFilter: string;
	selectedAuthors: { size: number };
	thumbKeyFilter: ThumbKeyFilter;
	magicKeyFilter: MagicKeyFilter;
	adaptiveSwapFilter: AdaptiveSwapFilter;
	boardTypeFilter: BoardTypeFilter;
	characterSetFilter: CharacterSetFilter;
	showUnfinished: boolean;
	appliedIncludeGrid: string[][];
	appliedIncludeLeftThumbKeys: string[];
	appliedIncludeRightThumbKeys: string[];
	appliedIncludeOrGrid: string[][];
	appliedIncludeOrLeftThumbKeys: string[];
	appliedIncludeOrRightThumbKeys: string[];
	appliedExcludeGrid: string[][];
	appliedExcludeLeftThumbKeys: string[];
	appliedExcludeRightThumbKeys: string[];
	appliedStatLimits: Record<StatLimitKey, StatLimit>;
	canUseLikes: boolean;
	hasSimilarReference: boolean;
	similarityFilterOperator: StatLimitOperator;
	appliedSimilarityFilterValue: string;
	hasCustomSourceSelection: boolean;
	sourceLayoutCount: number;
};

export function chipSourceFromViewSnapshot(
	snapshot: ViewFilterSnapshot,
	options?: { canUseLikes?: boolean; sourceLayoutNames?: string[] }
): FilterChipSource {
	const sourceLayoutNames = options?.sourceLayoutNames;
	return {
		nameFilter: snapshot.nameFilter,
		selectedAuthors: { size: snapshot.selectedAuthors.length },
		thumbKeyFilter: snapshot.thumbKeyFilter,
		magicKeyFilter: snapshot.magicKeyFilter,
		adaptiveSwapFilter: snapshot.adaptiveSwapFilter,
		boardTypeFilter: snapshot.boardTypeFilter,
		characterSetFilter: snapshot.characterSetFilter,
		showUnfinished: snapshot.showUnfinished,
		appliedIncludeGrid: snapshot.appliedIncludeGrid,
		appliedIncludeLeftThumbKeys: snapshot.appliedIncludeLeftThumbKeys,
		appliedIncludeRightThumbKeys: snapshot.appliedIncludeRightThumbKeys,
		appliedIncludeOrGrid: snapshot.appliedIncludeOrGrid,
		appliedIncludeOrLeftThumbKeys: snapshot.appliedIncludeOrLeftThumbKeys,
		appliedIncludeOrRightThumbKeys: snapshot.appliedIncludeOrRightThumbKeys,
		appliedExcludeGrid: snapshot.appliedExcludeGrid,
		appliedExcludeLeftThumbKeys: snapshot.appliedExcludeLeftThumbKeys,
		appliedExcludeRightThumbKeys: snapshot.appliedExcludeRightThumbKeys,
		appliedStatLimits: snapshot.appliedStatLimits,
		canUseLikes: options?.canUseLikes ?? true,
		hasSimilarReference: snapshot.similarReferenceName !== null,
		similarityFilterOperator: snapshot.similarityFilterOperator,
		appliedSimilarityFilterValue: snapshot.appliedSimilarityFilterValue,
		hasCustomSourceSelection: sourceLayoutNames !== undefined,
		sourceLayoutCount: sourceLayoutNames?.length ?? 0
	};
}

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
	const body = hands.join(', ');
	return `${label}: ${body}`;
}

function operatorSymbol(operator: 'lt' | 'gt'): string {
	return operator === 'lt' ? '<' : '>';
}

function formatActiveLimit(
	limits: Record<string, { operator: 'lt' | 'gt'; value: string }>,
	field: StatFilterField,
	label: string
): string | null {
	const limit = limits[field.key];
	if (!limit) return null;
	const value = limit.value.trim();
	if (!value) return null;
	const unit = field.unit === 'raw' ? '' : '%';
	return `${label} ${operatorSymbol(limit.operator)} ${value}${unit}`;
}

function handSummaryLabel(hand: 'LH' | 'RH', field: StatFilterField): string {
	const isHandTotal =
		field.key === 'lh' ||
		field.key === 'rh' ||
		field.key === 'cyano-lh' ||
		field.key === 'cyano-rh';
	return isHandTotal ? hand : `${hand} ${field.label}`;
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

export type FilterChipTone = 'neutral' | 'cmini' | 'cyanophage' | 'mana2';

export type ActiveFilterClearAction =
	| { kind: 'source' }
	| { kind: 'name' }
	| { kind: 'authors' }
	| { kind: 'thumbKey' }
	| { kind: 'magicKey' }
	| { kind: 'adaptiveSwap' }
	| { kind: 'boardType' }
	| { kind: 'characterSet' }
	| { kind: 'showUnfinished' }
	| { kind: 'keyFilter'; filter: KeyFilterKind }
	| { kind: 'statLimit'; key: StatLimitKey }
	| { kind: 'similarity' };

export interface ActiveFilterChip {
	id: string;
	label: string;
	tone: FilterChipTone;
	/** Native hover tooltip; analyzer chips only (analyzer name). */
	title?: string;
	clear: ActiveFilterClearAction;
	/** Open/focus the control that owns this filter. */
	focus: FilterFocusRequest;
}

function pushChip(
	chips: ActiveFilterChip[],
	id: string,
	label: string,
	clear: ActiveFilterClearAction,
	focus: FilterFocusRequest,
	tone: FilterChipTone = 'neutral',
	title?: string
): void {
	chips.push({ id, label, tone, title, clear, focus });
}

function toneForAnalyzer(analyzer: StatsAnalyzer): FilterChipTone {
	if (analyzer === CYANOPHAGE_ANALYZER) return 'cyanophage';
	if (analyzer === MANA2_ANALYZER) return 'mana2';
	return 'cmini';
}

/** Individual active filters for chip UI in the results toolbar. */
export function getActiveFilterChips(store: FilterChipSource): ActiveFilterChip[] {
	const chips: ActiveFilterChip[] = [];

	if (store.hasCustomSourceSelection) {
		const count = store.sourceLayoutCount;
		pushChip(
			chips,
			'source',
			'Source: custom selection',
			{ kind: 'source' },
			{ target: 'source' },
			'neutral',
			count === 1 ? '1 layout' : `${count} layouts`
		);
	}

	const name = store.nameFilter.trim();
	if (name) {
		pushChip(
			chips,
			'name',
			`Name: ${name}`,
			{ kind: 'name' },
			{ target: 'sidebar', field: 'name' }
		);
	}

	if (store.selectedAuthors.size > 0) {
		const count = store.selectedAuthors.size;
		pushChip(
			chips,
			'authors',
			`${count} author${count === 1 ? '' : 's'}`,
			{ kind: 'authors' },
			{ target: 'sidebar', field: 'authors' }
		);
	}

	if (store.thumbKeyFilter !== 'optional') {
		pushChip(
			chips,
			'thumbs',
			`Thumbs ${store.thumbKeyFilter}`,
			{ kind: 'thumbKey' },
			{ target: 'keyboard', field: 'thumbs' }
		);
	}
	if (store.magicKeyFilter !== 'optional') {
		const label =
			store.magicKeyFilter === 'required-mapped'
				? 'Magic: known mappings'
				: `Magic ${store.magicKeyFilter}`;
		pushChip(chips, 'magic', label, { kind: 'magicKey' }, { target: 'keyboard', field: 'magic' });
	}
	if (store.adaptiveSwapFilter !== 'optional') {
		const label =
			store.adaptiveSwapFilter === 'required-mapped'
				? 'Adaptive: known mappings'
				: `Adaptive ${store.adaptiveSwapFilter}`;
		pushChip(
			chips,
			'adaptive',
			label,
			{ kind: 'adaptiveSwap' },
			{ target: 'keyboard', field: 'adaptive' }
		);
	}
	if (store.boardTypeFilter !== 'all') {
		pushChip(
			chips,
			'board',
			BOARD_TYPE_LABELS[store.boardTypeFilter] ?? store.boardTypeFilter,
			{ kind: 'boardType' },
			{ target: 'keyboard', field: 'board' }
		);
	}
	if (store.characterSetFilter !== 'english') {
		pushChip(
			chips,
			'charset',
			CHARSET_LABELS[store.characterSetFilter] ?? store.characterSetFilter,
			{ kind: 'characterSet' },
			{ target: 'keyboard', field: 'charset' }
		);
	}
	if (store.showUnfinished) {
		pushChip(
			chips,
			'unfinished',
			'Unfinished',
			{ kind: 'showUnfinished' },
			{ target: 'keyboard', field: 'unfinished' }
		);
	}

	const andKeys = formatKeySection(
		'AND',
		store.appliedIncludeGrid,
		store.appliedIncludeLeftThumbKeys,
		store.appliedIncludeRightThumbKeys
	);
	if (andKeys) {
		pushChip(
			chips,
			'keys-and',
			andKeys,
			{ kind: 'keyFilter', filter: 'and' },
			{ target: 'keys', kind: 'and' }
		);
	}
	const orKeys = formatKeySection(
		'OR',
		store.appliedIncludeOrGrid,
		store.appliedIncludeOrLeftThumbKeys,
		store.appliedIncludeOrRightThumbKeys
	);
	if (orKeys) {
		pushChip(
			chips,
			'keys-or',
			orKeys,
			{ kind: 'keyFilter', filter: 'or' },
			{ target: 'keys', kind: 'or' }
		);
	}
	const excludeKeys = formatKeySection(
		'Exclude',
		store.appliedExcludeGrid,
		store.appliedExcludeLeftThumbKeys,
		store.appliedExcludeRightThumbKeys
	);
	if (excludeKeys) {
		pushChip(
			chips,
			'keys-exclude',
			excludeKeys,
			{ kind: 'keyFilter', filter: 'exclude' },
			{ target: 'keys', kind: 'exclude' }
		);
	}

	const appliedLimits = store.appliedStatLimits;
	for (const entry of STAT_ANALYZERS) {
		const analyzer = entry.value;
		const analyzerTitle = analyzerShortLabel(analyzer);
		const tone = toneForAnalyzer(analyzer);

		for (const row of getGeneralStatFilterRowsForAnalyzer(analyzer)) {
			for (const field of row) {
				const part = formatActiveLimit(appliedLimits, field, field.label);
				if (!part) continue;
				pushChip(
					chips,
					`stat-${field.key}`,
					part,
					{ kind: 'statLimit', key: field.key },
					{
						target: 'stats',
						section: 'general',
						analyzer,
						key: field.key
					},
					tone,
					analyzerTitle
				);
			}
		}

		if (analyzer === CMINI_ANALYZER && store.canUseLikes) {
			const likes = formatActiveLimit(
				appliedLimits,
				LIKES_STAT_FILTER_FIELD,
				LIKES_STAT_FILTER_FIELD.label
			);
			if (likes) {
				pushChip(
					chips,
					'likes',
					likes,
					{ kind: 'statLimit', key: 'likes' },
					{
						target: 'stats',
						section: 'general',
						analyzer: CMINI_ANALYZER,
						key: 'likes'
					}
				);
			}
		}

		for (const field of getLeftHandStatFilterFieldsForAnalyzer(analyzer)) {
			const part = formatActiveLimit(appliedLimits, field, handSummaryLabel('LH', field));
			if (!part) continue;
			pushChip(
				chips,
				`hand-${field.key}`,
				part,
				{ kind: 'statLimit', key: field.key },
				{
					target: 'stats',
					section: 'hands',
					analyzer,
					key: field.key
				},
				tone,
				analyzerTitle
			);
		}
		for (const field of getRightHandStatFilterFieldsForAnalyzer(analyzer)) {
			const part = formatActiveLimit(appliedLimits, field, handSummaryLabel('RH', field));
			if (!part) continue;
			pushChip(
				chips,
				`hand-${field.key}`,
				part,
				{ kind: 'statLimit', key: field.key },
				{
					target: 'stats',
					section: 'hands',
					analyzer,
					key: field.key
				},
				tone,
				analyzerTitle
			);
		}
	}

	if (store.hasSimilarReference) {
		const op = store.similarityFilterOperator === 'lt' ? '<' : '>';
		const value = store.appliedSimilarityFilterValue.trim() || '0';
		pushChip(
			chips,
			'similarity',
			`Similarity ${op} ${value}%`,
			{ kind: 'similarity' },
			{ target: 'sidebar', field: 'similarity' }
		);
	}

	return chips;
}

export interface ActiveFilterClearTarget {
	clearSourceSelection(): void;
	setNameFilter(value: string): void;
	clearAuthors(): void;
	setThumbKeyFilter(value: ThumbKeyFilter): void;
	setMagicKeyFilter(value: MagicKeyFilter): void;
	setAdaptiveSwapFilter(value: AdaptiveSwapFilter): void;
	setBoardTypeFilter(value: BoardTypeFilter): void;
	setCharacterSetFilter(value: CharacterSetFilter): void;
	setShowUnfinished(value: boolean): void;
	clearInclude(): void;
	clearIncludeOr(): void;
	clearExclude(): void;
	clearStatLimit(key: StatLimitKey): void;
	clearSimilarReference(): void;
}

/** Clear the filter represented by a results-toolbar chip. */
export function clearActiveFilterChip(
	store: ActiveFilterClearTarget,
	action: ActiveFilterClearAction
): void {
	switch (action.kind) {
		case 'source':
			store.clearSourceSelection();
			break;
		case 'name':
			store.setNameFilter('');
			break;
		case 'authors':
			store.clearAuthors();
			break;
		case 'thumbKey':
			store.setThumbKeyFilter('optional');
			break;
		case 'magicKey':
			store.setMagicKeyFilter('optional');
			break;
		case 'adaptiveSwap':
			store.setAdaptiveSwapFilter('optional');
			break;
		case 'boardType':
			store.setBoardTypeFilter('all');
			break;
		case 'characterSet':
			store.setCharacterSetFilter('english');
			break;
		case 'showUnfinished':
			store.setShowUnfinished(false);
			break;
		case 'keyFilter':
			if (action.filter === 'and') store.clearInclude();
			else if (action.filter === 'or') store.clearIncludeOr();
			else store.clearExclude();
			break;
		case 'statLimit':
			store.clearStatLimit(action.key);
			break;
		case 'similarity':
			store.clearSimilarReference();
			break;
	}
}
