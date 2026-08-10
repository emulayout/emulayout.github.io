import {
	DEFAULT_LAYOUT_DETAIL_SECTION,
	LAYOUT_DETAIL_TAB_PARAM,
	parseLayoutDetailSection
} from '$lib/layoutDetailTabs';

export type GoatCounterVars = {
	path?: string;
	title?: string;
	event?: boolean;
	referrer?: string;
	no_session?: boolean;
};

type GoatCounter = {
	count: (vars?: GoatCounterVars) => void;
};

declare global {
	interface Window {
		goatcounter?: GoatCounter;
	}
}

const READY_TIMEOUT_MS = 10_000;
const READY_POLL_MS = 50;
const SHOW_PAGE_PATH = '/layouts';

type PageviewUrl = { pathname: string; search: string };

function isLocalAnalyticsHost(hostname: string): boolean {
	return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function shouldSendGoatCounter(): boolean {
	if (typeof window === 'undefined') return false;
	if (import.meta.env.DEV) return false;
	return !isLocalAnalyticsHost(window.location.hostname);
}

/**
 * Collapse filter/share/practice-text query noise and individual layout names so
 * GoatCounter paths stay low-cardinality. Show pages are `/layouts` plus a
 * non-default `tab`.
 */
export function goatcounterPageviewPath(pathname: string, search = ''): string {
	const path = pathname || '/';
	if (!path.startsWith(`${SHOW_PAGE_PATH}/`) && path !== SHOW_PAGE_PATH) return path;

	const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
	const section = parseLayoutDetailSection(params.get(LAYOUT_DETAIL_TAB_PARAM));
	if (section === DEFAULT_LAYOUT_DETAIL_SECTION) return SHOW_PAGE_PATH;
	return `${SHOW_PAGE_PATH}?${LAYOUT_DETAIL_TAB_PARAM}=${section}`;
}

type PageviewTarget = { url: PageviewUrl | null } | null;

export function goatcounterPageviewForNavigation(
	from: PageviewTarget,
	to: PageviewTarget
): string | null {
	// SPA `enter` (ssr = false) passes `from: { url: null }`, not `from: null`.
	if (!to?.url) return null;
	const nextPath = goatcounterPageviewPath(to.url.pathname, to.url.search);
	if (from?.url && goatcounterPageviewPath(from.url.pathname, from.url.search) === nextPath) {
		return null;
	}
	return nextPath;
}

/** Feature-use event names. Values are never included — only the control that was used. */
export function goatcounterFilterEvent(feature: string): string {
	return `filter-${feature}`;
}

export function goatcounterSortEvent(sortBy: string): string {
	return `sort-${sortBy}`;
}

export function goatcounterPracticeSettingEvent(option: string): string {
	const kebab = option.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
	return `practice-setting-${kebab}`;
}

function withGoatCounter(run: (count: GoatCounter['count']) => void): void {
	if (!shouldSendGoatCounter()) return;
	const existing = window.goatcounter?.count;
	if (typeof existing === 'function') {
		run(existing);
		return;
	}

	const started = Date.now();
	const timer = window.setInterval(() => {
		const count = window.goatcounter?.count;
		if (typeof count === 'function') {
			window.clearInterval(timer);
			run(count);
			return;
		}
		if (Date.now() - started >= READY_TIMEOUT_MS) {
			window.clearInterval(timer);
		}
	}, READY_POLL_MS);
}

export function countGoatCounter(vars: GoatCounterVars): void {
	withGoatCounter((count) => count(vars));
}

/** Record a GoatCounter event. `path` is the event name and must not start with `/`. */
export function trackGoatCounterEvent(path: string, title?: string): void {
	if (!path || path.startsWith('/')) return;
	countGoatCounter({ path, title, event: true });
}

export function trackGoatCounterPageview(navigation: {
	from: PageviewTarget;
	to: PageviewTarget;
}): void {
	const path = goatcounterPageviewForNavigation(navigation.from, navigation.to);
	if (!path) return;
	countGoatCounter({ path });
}
