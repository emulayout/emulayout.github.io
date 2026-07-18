import { SPLIT_COL } from '$lib/cmini/keyboard';
import type { FilterStore } from '$lib/filterStore.svelte';
import {
	CYANOPHAGE_ANALYZER,
	DEFAULT_STATS_ANALYZER,
	getGeneralStatFilterRowsForAnalyzer,
	getLeftHandStatFilterFieldsForAnalyzer,
	getRightHandStatFilterFieldsForAnalyzer,
	LIKES_STAT_FILTER_FIELD,
	STAT_ANALYZERS,
	type StatFilterField,
	type StatLimitKey,
	type StatsAnalyzer
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
	label: string | null,
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
	return label ? `${label}: ${body}` : body;
}

export type KeyFilterKind = 'and' | 'or' | 'exclude';

/** Preview for a single key-filter kind (no section prefix — button already names it). */
export function getKeyFilterKindSummary(store: FilterStore, kind: KeyFilterKind): string {
	switch (kind) {
		case 'and':
			return (
				formatKeySection(
					null,
					store.includeGrid,
					store.includeLeftThumbKeys,
					store.includeRightThumbKeys
				) ?? ''
			);
		case 'or':
			return (
				formatKeySection(
					null,
					store.includeOrGrid,
					store.includeOrLeftThumbKeys,
					store.includeOrRightThumbKeys
				) ?? ''
			);
		case 'exclude':
			return (
				formatKeySection(
					null,
					store.excludeGrid,
					store.excludeLeftThumbKeys,
					store.excludeRightThumbKeys
				) ?? ''
			);
	}
}

/** Collapsed key-filter preview across all kinds (same format as the old accordion). */
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

function handSummaryLabel(
	hand: 'LH' | 'RH',
	field: StatFilterField,
	analyzerLabel?: string
): string {
	const isHandTotal =
		field.key === 'lh' ||
		field.key === 'rh' ||
		field.key === 'cyano-lh' ||
		field.key === 'cyano-rh';
	const base = isHandTotal ? hand : `${hand} ${field.label}`;
	return analyzerLabel ? `${analyzerLabel} ${base}` : base;
}

function analyzerShortLabel(analyzer: StatsAnalyzer): string {
	return analyzer === CYANOPHAGE_ANALYZER ? 'Cyanophage' : 'cmini';
}

/** Collapsed stat-filter preview (same format as the old accordion). */
export function getStatFiltersSummary(store: FilterStore): string {
	return [getStatFilterSectionSummary(store, 'general'), getStatFilterSectionSummary(store, 'hands')]
		.filter(Boolean)
		.join(' • ');
}

export type StatFilterSection = 'general' | 'hands';

function appendGeneralAnalyzerSummary(
	store: FilterStore,
	analyzer: StatsAnalyzer,
	parts: string[],
	seenKeys: Set<string>
): void {
	for (const row of getGeneralStatFilterRowsForAnalyzer(analyzer)) {
		for (const field of row) {
			if (seenKeys.has(field.key)) continue;
			const part = formatActiveLimit(store.statLimits, field, field.label);
			if (!part) continue;
			seenKeys.add(field.key);
			parts.push(part);
		}
	}
}

function appendHandsAnalyzerSummary(
	store: FilterStore,
	analyzer: StatsAnalyzer,
	parts: string[],
	analyzerLabel?: string
): void {
	for (const field of getLeftHandStatFilterFieldsForAnalyzer(analyzer)) {
		const part = formatActiveLimit(
			store.statLimits,
			field,
			handSummaryLabel('LH', field, analyzerLabel)
		);
		if (part) parts.push(part);
	}
	for (const field of getRightHandStatFilterFieldsForAnalyzer(analyzer)) {
		const part = formatActiveLimit(
			store.statLimits,
			field,
			handSummaryLabel('RH', field, analyzerLabel)
		);
		if (part) parts.push(part);
	}
}

export function getStatFilterSectionSummary(
	store: FilterStore,
	section: StatFilterSection,
	/** When omitted, includes active filters from both analyzers. */
	analyzer?: StatsAnalyzer
): string {
	const parts: string[] = [];

	if (section === 'general') {
		const seenKeys = new Set<string>();
		if (analyzer) {
			appendGeneralAnalyzerSummary(store, analyzer, parts, seenKeys);
		} else {
			appendGeneralAnalyzerSummary(store, DEFAULT_STATS_ANALYZER, parts, seenKeys);
			appendGeneralAnalyzerSummary(store, CYANOPHAGE_ANALYZER, parts, seenKeys);
		}
		if (store.canUseLikes) {
			const part = formatActiveLimit(
				store.statLimits,
				LIKES_STAT_FILTER_FIELD,
				LIKES_STAT_FILTER_FIELD.label
			);
			if (part) parts.push(part);
		}
	} else if (analyzer) {
		appendHandsAnalyzerSummary(store, analyzer, parts);
	} else {
		for (const entry of STAT_ANALYZERS) {
			appendHandsAnalyzerSummary(store, entry.value, parts, analyzerShortLabel(entry.value));
		}
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

export type FilterChipTone = 'neutral' | 'monkeyracer' | 'cyanophage';

export type ActiveFilterClearAction =
	| { kind: 'layoutSource' }
	| { kind: 'name' }
	| { kind: 'authors' }
	| { kind: 'thumbKey' }
	| { kind: 'magicKey' }
	| { kind: 'boardType' }
	| { kind: 'characterSet' }
	| { kind: 'showUnfinished' }
	| { kind: 'keyFilter'; filter: KeyFilterKind }
	| { kind: 'statLimit'; key: StatLimitKey }
	| { kind: 'similarity' };

export type KeyboardFilterField =
	| 'thumbs'
	| 'magic'
	| 'board'
	| 'charset'
	| 'unfinished';

export type SidebarFilterField = 'source' | 'name' | 'authors' | 'similarity';

/** Request to open a filter UI and focus a specific control. */
export type FilterFocusRequest =
	| { target: 'sidebar'; field: SidebarFilterField }
	| { target: 'keyboard'; field: KeyboardFilterField }
	| { target: 'keys'; kind: KeyFilterKind }
	| {
			target: 'stats';
			section: StatFilterSection;
			analyzer: StatsAnalyzer;
			key: StatLimitKey;
	  };

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
	return analyzer === CYANOPHAGE_ANALYZER ? 'cyanophage' : 'monkeyracer';
}

/** Individual active filters for chip UI in the results toolbar. */
export function getActiveFilterChips(store: FilterStore): ActiveFilterChip[] {
	const chips: ActiveFilterChip[] = [];

	if (store.layoutSource === 'selected') {
		pushChip(
			chips,
			'source-selected',
			'Selected only',
			{ kind: 'layoutSource' },
			{ target: 'sidebar', field: 'source' }
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
		pushChip(
			chips,
			'magic',
			`Magic ${store.magicKeyFilter}`,
			{ kind: 'magicKey' },
			{ target: 'keyboard', field: 'magic' }
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

		if (analyzer === DEFAULT_STATS_ANALYZER && store.canUseLikes) {
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
						analyzer: DEFAULT_STATS_ANALYZER,
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

/** Clear the filter represented by a results-toolbar chip. */
export function clearActiveFilterChip(store: FilterStore, action: ActiveFilterClearAction): void {
	switch (action.kind) {
		case 'layoutSource':
			store.setLayoutSource('all');
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

/** Full active-filter preview joined with bullets (sidebar-style). */
export function getActiveFiltersSummary(store: FilterStore): string {
	return getActiveFilterChips(store)
		.map((chip) => chip.label)
		.join(' • ');
}
