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
	url?: (vars?: GoatCounterVars) => string | undefined;
	filter?: () => string | false;
};

declare global {
	interface Window {
		goatcounter?: GoatCounter;
	}
}

const READY_TIMEOUT_MS = 10_000;
const READY_POLL_MS = 50;
const SHOW_PAGE_PATH = '/layouts';

export const LAYOUTS_INDEX_TITLE = 'Layouts index';
export const LAYOUT_SHOW_TITLE = 'Layout show';

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

export function goatcounterPageTitle(pathname: string, search = ''): string {
	const path = goatcounterPageviewPath(pathname, search);
	return path === SHOW_PAGE_PATH || path.startsWith(`${SHOW_PAGE_PATH}?`)
		? LAYOUT_SHOW_TITLE
		: LAYOUTS_INDEX_TITLE;
}

/** Drop same-origin referrers so layout names and `text=` never appear as `r`. */
export function goatcounterSafeReferrer(referrer: string, currentOrigin: string): string {
	if (!referrer) return '';
	try {
		const url = new URL(referrer);
		return url.origin === currentOrigin ? '' : referrer;
	} catch {
		return '';
	}
}

/**
 * `count.js` always appends `q=location.search`. Remove it so filter query
 * strings and practice `text=` never leave the browser.
 */
export function goatcounterCountRequestUrl(
	countUrl: string,
	base = 'https://emulayout.goatcounter.com'
): string {
	const url = new URL(countUrl, base);
	url.searchParams.delete('q');
	return url.toString();
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

function withGoatCounter(run: (gc: GoatCounter) => void): void {
	if (!shouldSendGoatCounter()) return;
	const existing = window.goatcounter;
	if (existing && typeof existing.url === 'function') {
		run(existing);
		return;
	}

	const started = Date.now();
	const timer = window.setInterval(() => {
		const gc = window.goatcounter;
		if (gc && typeof gc.url === 'function') {
			window.clearInterval(timer);
			run(gc);
			return;
		}
		if (Date.now() - started >= READY_TIMEOUT_MS) {
			window.clearInterval(timer);
		}
	}, READY_POLL_MS);
}

function titleForCurrentPage(): string {
	if (typeof window === 'undefined') return LAYOUTS_INDEX_TITLE;
	return goatcounterPageTitle(window.location.pathname, window.location.search);
}

function referrerForCurrentPage(): string {
	if (typeof window === 'undefined') return '';
	return goatcounterSafeReferrer(document.referrer, window.location.origin);
}

function sendCountPixel(href: string): void {
	if (navigator.sendBeacon?.(href)) return;
	const img = document.createElement('img');
	img.src = href;
	img.alt = '';
	img.setAttribute('aria-hidden', 'true');
	img.style.position = 'absolute';
	img.style.width = '1px';
	img.style.height = '1px';
	img.addEventListener('load', () => img.remove(), { once: true });
	img.addEventListener('error', () => img.remove(), { once: true });
	document.body?.appendChild(img);
}

export function countGoatCounter(vars: GoatCounterVars): void {
	const payload: GoatCounterVars = {
		...vars,
		title: vars.title ?? titleForCurrentPage(),
		referrer: vars.referrer ?? referrerForCurrentPage()
	};

	withGoatCounter((gc) => {
		const blocked = typeof gc.filter === 'function' ? gc.filter() : false;
		if (blocked) return;
		if (typeof gc.url !== 'function') return;
		const encoded = gc.url(payload);
		if (!encoded) return;
		sendCountPixel(goatcounterCountRequestUrl(encoded, window.location.href));
	});
}

/** Record a GoatCounter event. `path` is the event name and must not start with `/`. */
export function trackGoatCounterEvent(path: string): void {
	if (!path || path.startsWith('/')) return;
	countGoatCounter({ path, event: true });
}

export function trackGoatCounterPageview(navigation: {
	from: PageviewTarget;
	to: PageviewTarget;
}): void {
	const path = goatcounterPageviewForNavigation(navigation.from, navigation.to);
	if (!path) return;
	const toUrl = navigation.to?.url;
	const title = toUrl ? goatcounterPageTitle(toUrl.pathname, toUrl.search) : titleForCurrentPage();
	countGoatCounter({ path, title });
}
