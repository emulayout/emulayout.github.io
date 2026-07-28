import type { StatsAnalyzer } from '$lib/statsAnalyzers';
import type { StatFilterSection, StatLimitKey } from '$lib/statsFiltering';

export type KeyFilterKind = 'and' | 'or' | 'exclude';
export type KeyboardFilterField =
	| 'thumbs'
	| 'magic'
	| 'adaptive'
	| 'board'
	| 'charset'
	| 'unfinished';
export type SidebarFilterField = 'name' | 'authors' | 'similarity';

/** Request to open a filter UI and focus a specific control. */
export type FilterFocusRequest =
	| { target: 'source' }
	| { target: 'sidebar'; field: SidebarFilterField }
	| { target: 'keyboard'; field: KeyboardFilterField }
	| { target: 'keys'; kind: KeyFilterKind }
	| {
			target: 'stats';
			section: StatFilterSection;
			analyzer: StatsAnalyzer;
			key: StatLimitKey;
	  };
