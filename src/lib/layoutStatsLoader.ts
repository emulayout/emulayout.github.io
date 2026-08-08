import type { StatsMaps } from '$lib/layout';
import {
	analyzerUsesSelectableCorpus,
	getAnalyzerStatsUrl,
	type StatsAnalyzer,
	type StatsCorpus
} from '$lib/statsAnalyzers';

export type AnalyzerStatsMap = NonNullable<StatsMaps[StatsAnalyzer]>;

export type AnalyzerStatsLoadError = {
	kind: 'http' | 'network' | 'parse';
	message: string;
	status?: number;
};

export type AnalyzerStatsLoadResult =
	| { status: 'loaded'; map: AnalyzerStatsMap }
	| { status: 'error'; error: AnalyzerStatsLoadError }
	| { status: 'aborted' };

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function isAbortError(error: unknown): boolean {
	return (
		error !== null && typeof error === 'object' && 'name' in error && error.name === 'AbortError'
	);
}

function errorMessage(error: unknown): string {
	return error instanceof Error && error.message ? error.message : 'Unknown network error';
}

/**
 * Fetch and validate one analyzer map without rejecting. Aborts are a separate,
 * expected outcome so navigation and analyzer changes do not surface as errors.
 */
export async function loadAnalyzerStats(
	analyzer: StatsAnalyzer,
	options: { fetch?: Fetcher; signal?: AbortSignal; corpus?: StatsCorpus } = {}
): Promise<AnalyzerStatsLoadResult> {
	const fetcher = options.fetch ?? fetch;
	const statsUrl = analyzerUsesSelectableCorpus(analyzer)
		? getAnalyzerStatsUrl(analyzer, options.corpus)
		: getAnalyzerStatsUrl(analyzer);

	let response: Response;
	try {
		response = await fetcher(statsUrl, {
			signal: options.signal
		});
	} catch (error) {
		if (isAbortError(error) || options.signal?.aborted) {
			return { status: 'aborted' };
		}
		return {
			status: 'error',
			error: {
				kind: 'network',
				message: `Could not download analyzer stats: ${errorMessage(error)}`
			}
		};
	}

	if (options.signal?.aborted) {
		return { status: 'aborted' };
	}

	if (!response.ok) {
		return {
			status: 'error',
			error: {
				kind: 'http',
				status: response.status,
				message: `Analyzer stats request failed (${response.status}${response.statusText ? ` ${response.statusText}` : ''}).`
			}
		};
	}

	try {
		const map = (await response.json()) as unknown;
		if (!map || typeof map !== 'object' || Array.isArray(map)) {
			return {
				status: 'error',
				error: {
					kind: 'parse',
					message: 'Analyzer stats response was not a layout map.'
				}
			};
		}
		if (options.signal?.aborted) {
			return { status: 'aborted' };
		}
		return { status: 'loaded', map: map as AnalyzerStatsMap };
	} catch (error) {
		if (isAbortError(error) || options.signal?.aborted) {
			return { status: 'aborted' };
		}
		return {
			status: 'error',
			error: {
				kind: 'parse',
				message: `Could not read analyzer stats: ${errorMessage(error)}`
			}
		};
	}
}
