<script lang="ts">
	import './layout.css';
	import { afterNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import CompareLayoutsModal from '$lib/components/CompareLayoutsModal.svelte';
	import QuickFindModal from '$lib/components/QuickFindModal.svelte';
	import { LAYOUT_SPLIT_MIN_WIDTH, TAILWIND_BREAKPOINTS } from '$lib/constants';
	import { trackGoatCounterEvent, trackGoatCounterPageview } from '$lib/goatcounter';
	import { layoutsCatalog } from '$lib/layoutsCatalog.svelte';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';
	import { keyboardInputStore } from '$lib/keyboardInputStore.svelte';
	import { hasOpenModal } from '$lib/modalScrollLock';
	import { uiPrefs } from '$lib/uiPrefs.svelte';
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';

	let { children } = $props();

	afterNavigate((navigation) => {
		trackGoatCounterPageview(navigation);
	});

	type ThemeMode = 'system' | 'light' | 'dark';

	let themeMode: ThemeMode = $state('system');
	let systemPrefersDark = $state(false);
	let showQuickFind = $state(false);
	let showCompareModal = $state(false);
	/** How to seed the compare modal on the next open/session bump. */
	let compareSeedMode = $state<'restore' | 'selection' | 'reset'>('restore');
	/** Detail-page layout to seed as the compare-to side, when opened from a detail route. */
	let compareSeedName = $state<string | null>(null);
	let compareSession = $state(0);
	let debugEnabled = $state(false);

	const layouts = $derived(layoutsCatalog.layouts);
	const usesDocumentScroll = $derived(page.route.id === '/layouts/[name]');
	const authorsData = $derived(layoutsCatalog.authorsData);
	const statsMaps = $derived(layoutStatsStore.maps);
	const authorById = $derived(
		new Map<number, string>(Object.entries(authorsData).map(([name, id]) => [id as number, name]))
	);

	function getAuthorName(userId: number): string {
		return authorById.get(userId) ?? 'Unknown';
	}

	const smUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.sm}px)`);
	const mdUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.md}px)`);
	const lgUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.lg}px)`);
	const xlUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS.xl}px)`);
	const xxlUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS['2xl']}px)`);
	const xxxlUp = new MediaQuery(`(min-width: ${TAILWIND_BREAKPOINTS['3xl']}px)`);

	const debugBreakpoint = $derived.by(() => {
		if (!debugEnabled) return '';
		if (xxxlUp.current) return `3xl (≥${TAILWIND_BREAKPOINTS['3xl']})`;
		if (xxlUp.current) return `2xl (≥${TAILWIND_BREAKPOINTS['2xl']})`;
		if (xlUp.current) return `xl (≥${TAILWIND_BREAKPOINTS.xl})`;
		if (lgUp.current) return `lg (≥${TAILWIND_BREAKPOINTS.lg})`;
		if (mdUp.current) return `md (≥${TAILWIND_BREAKPOINTS.md})`;
		if (smUp.current) return `sm (≥${TAILWIND_BREAKPOINTS.sm})`;
		return `<sm (<${TAILWIND_BREAKPOINTS.sm})`;
	});

	const debugLayoutMode = $derived(
		!debugEnabled
			? ''
			: mdUp.current
				? `split (≥${LAYOUT_SPLIT_MIN_WIDTH})`
				: `stack (<${LAYOUT_SPLIT_MIN_WIDTH})`
	);

	const dark = $derived.by(() => {
		return themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark);
	});

	// Initialize theme mode and follow OS changes while in system mode.
	onMount(() => {
		debugEnabled = localStorage.getItem('debug') === 'true';
		uiPrefs.hydrate();
		keyboardInputStore.hydrate();

		const stored = localStorage.getItem('theme');
		themeMode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';

		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		systemPrefersDark = mediaQuery.matches;

		const handleChange = (event: MediaQueryListEvent) => {
			systemPrefersDark = event.matches;
		};

		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery.removeEventListener('change', handleChange);
	});

	// Keep dump-backed stats aligned with the persisted corpus on every route,
	// including cold layout-detail visits and shell-owned Quick Find / Compare.
	$effect(() => {
		if (!uiPrefs.hydrated) return;
		layoutStatsStore.applyCorpus(uiPrefs.statsCorpus);
	});

	// Apply theme class to document
	$effect(() => {
		document.documentElement.classList.toggle('dark', dark);
		if (themeMode === 'system') {
			localStorage.removeItem('theme');
		} else {
			localStorage.setItem('theme', themeMode);
		}
	});

	// Cmd+K → quick find; Cmd+Shift+K → compare (Ctrl on Windows/Linux)
	onMount(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key.toLowerCase() !== 'k') return;
			if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
			// Layout test area remaps real key presses — don't steal them.
			const target = event.target;
			if (
				target instanceof HTMLTextAreaElement &&
				target.classList.contains('layout-test-area-input')
			) {
				return;
			}
			event.preventDefault();

			if (event.shiftKey) {
				openCompareHotkey();
				return;
			}

			if (showQuickFind) {
				window.dispatchEvent(new Event('emulayout:quick-find-refocus'));
				return;
			}
			if (hasOpenModal()) return;
			showQuickFind = true;
			trackGoatCounterEvent('quick-find');
		}

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	});

	function openQuickFind() {
		showQuickFind = true;
		trackGoatCounterEvent('quick-find');
	}

	function openCompare() {
		showQuickFind = false;
		window.dispatchEvent(
			new CustomEvent('emulayout:open-compare', { detail: { mode: 'restore' } })
		);
	}

	function openCompareHotkey() {
		showQuickFind = false;
		window.dispatchEvent(new CustomEvent('emulayout:open-compare', { detail: { mode: 'hotkey' } }));
	}

	onMount(() => {
		async function handleOpenCompare(event: Event) {
			const detail = (event as CustomEvent<{ mode?: 'restore' | 'selection' | 'hotkey' }>).detail;
			const mode = detail?.mode ?? 'restore';

			if (mode === 'hotkey' && showCompareModal) {
				compareSeedMode = 'reset';
				compareSession += 1;
				return;
			}

			await layoutsCatalog.ensureLoaded();
			if (!layoutsCatalog.fullCatalogLoaded) return;

			compareSeedName =
				page.route.id === '/layouts/[name]' && page.data.detail
					? ((page.data.layoutName as string | undefined) ?? null)
					: null;
			compareSeedMode = mode === 'selection' ? 'selection' : 'restore';
			compareSession += 1;
			showCompareModal = true;
			trackGoatCounterEvent('compare');
		}

		window.addEventListener('emulayout:open-compare', handleOpenCompare);
		return () => window.removeEventListener('emulayout:open-compare', handleOpenCompare);
	});

	function toggleTheme() {
		themeMode = themeMode === 'system' ? 'light' : themeMode === 'light' ? 'dark' : 'system';
	}

	const themeButtonLabel = $derived(
		themeMode === 'system'
			? `Theme: system (${dark ? 'dark' : 'light'}). Switch to light mode`
			: themeMode === 'light'
				? 'Theme: light. Switch to dark mode'
				: 'Theme: dark. Switch to system mode'
	);

	const hintsButtonLabel = $derived(uiPrefs.hintsEnabled ? 'Hide help hints' : 'Show help hints');
</script>

<svelte:head>
	<title>Emulayout</title>
</svelte:head>

<div class="app-shell" class:app-shell--document-scroll={usesDocumentScroll}>
	<header class="app-header px-3 py-3 md:px-6">
		<div class="flex w-full items-center justify-between gap-3">
			<div class="flex min-w-0 items-center gap-3">
				<a
					href={resolve('/')}
					data-sveltekit-reload
					class="flex min-w-0 items-center gap-3 no-underline hover:opacity-90 transition-opacity"
				>
					<img src="/keycap.png" alt="" width="71" height="72" class="shrink-0 h-8 w-auto" />
					<h1
						class="truncate text-3xl font-bold tracking-tight"
						style="color: var(--text-primary);"
					>
						Emulayout
					</h1>
				</a>
				{#if debugEnabled}
					<span
						class="shrink-0 font-mono text-xs"
						style="color: var(--text-caption);"
						title="Temporary layout debug label"
					>
						{debugBreakpoint} · {debugLayoutMode}
					</span>
				{/if}
			</div>
			<div class="flex shrink-0 justify-end gap-2">
				<button
					type="button"
					onclick={() => uiPrefs.toggleHints()}
					class="group relative size-10 rounded-full transition-all duration-300 hover:scale-110"
					class:app-header-toggle--on={uiPrefs.hintsEnabled}
					style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
					aria-label={hintsButtonLabel}
					aria-pressed={uiPrefs.hintsEnabled}
					title={hintsButtonLabel}
				>
					<svg
						class="absolute inset-0 m-auto size-5 transition-all duration-300"
						style="color: var(--text-primary);"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
						<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
						<path d="M12 17h.01" />
					</svg>
				</button>
				<button
					onclick={openCompare}
					class="group relative size-10 rounded-full transition-all duration-300 hover:scale-110"
					style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
					aria-label="Compare layouts"
					title="Compare layouts (⌘⇧K / Ctrl+Shift+K)"
				>
					<svg
						class="absolute inset-0 m-auto size-5 transition-all duration-300"
						style="color: var(--text-primary);"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<rect x="3" y="3" width="7" height="18" rx="1" />
						<rect x="14" y="3" width="7" height="18" rx="1" />
					</svg>
				</button>
				<button
					onclick={openQuickFind}
					class="group relative size-10 rounded-full transition-all duration-300 hover:scale-110"
					style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
					aria-label="Quick find layouts"
					title="Quick find (⌘K / Ctrl+K)"
				>
					<svg
						class="absolute inset-0 m-auto size-5 transition-all duration-300"
						style="color: var(--text-primary);"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M21 21l-4.35-4.35M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" />
					</svg>
				</button>
				<a
					href="https://github.com/emulayout/emulayout.github.io"
					target="_blank"
					rel="noopener noreferrer"
					class="group relative size-10 rounded-full transition-all duration-300 hover:scale-110"
					style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
					aria-label="Emulayout on GitHub"
					title="Emulayout on GitHub"
				>
					<svg
						class="absolute inset-0 m-auto size-5 transition-all duration-300"
						style="color: var(--text-primary);"
						viewBox="0 0 24 24"
						fill="currentColor"
						aria-hidden="true"
					>
						<path
							d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
						/>
					</svg>
				</a>
				<button
					onclick={toggleTheme}
					class="group relative size-10 rounded-full transition-all duration-300 hover:scale-110"
					style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
					aria-label={themeButtonLabel}
					title={themeButtonLabel}
				>
					<!-- System / auto icon -->
					<svg
						class="absolute inset-0 m-auto size-5 transition-all duration-300"
						style="color: var(--text-primary); opacity: {themeMode === 'system'
							? 1
							: 0}; transform: scale({themeMode === 'system' ? 1 : 0.5});"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<rect x="2" y="3" width="20" height="14" rx="2" />
						<path d="M8 21h8M12 17v4" />
					</svg>
					<!-- Sun icon -->
					<svg
						class="absolute inset-0 m-auto size-5 transition-all duration-300"
						style="color: var(--text-primary); opacity: {themeMode === 'light'
							? 1
							: 0}; transform: rotate({themeMode === 'light' ? 0 : -90}deg) scale({themeMode ===
						'light'
							? 1
							: 0.5});"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="4" />
						<path
							d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
						/>
					</svg>
					<!-- Moon icon -->
					<svg
						class="absolute inset-0 m-auto size-5 transition-all duration-300"
						style="color: var(--text-primary); opacity: {themeMode === 'dark'
							? 1
							: 0}; transform: rotate({themeMode === 'dark' ? 0 : 90}deg) scale({themeMode ===
						'dark'
							? 1
							: 0.5});"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						stroke-width="2"
						aria-hidden="true"
					>
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
					</svg>
				</button>
			</div>
		</div>
	</header>

	<main
		class="app-main px-3 pb-3 md:px-6 md:pb-4"
		class:app-main--document-scroll={usesDocumentScroll}
	>
		{@render children()}
	</main>
</div>

<QuickFindModal open={showQuickFind} onClose={() => (showQuickFind = false)} />

<CompareLayoutsModal
	open={showCompareModal}
	onClose={() => (showCompareModal = false)}
	seedMode={compareSeedMode}
	seedName={compareSeedName}
	session={compareSession}
	{layouts}
	{getAuthorName}
	likesData={layoutsCatalog.likesData}
	{statsMaps}
/>

<style>
	.app-shell {
		min-height: 100dvh;
	}

	.app-header {
		position: relative;
		z-index: 20;
		background-color: var(--bg-primary);
		box-shadow: var(--app-bar-shadow-color) 0px -4px 20px 7px;
		margin-bottom: 0.5rem;
	}

	.app-header-toggle--on {
		border-color: var(--accent) !important;
		background-color: color-mix(in srgb, var(--accent) 16%, var(--bg-secondary)) !important;
	}

	/* Keep the index split view within the viewport; detail routes use document scrolling. */
	@media (min-width: 768px) {
		.app-shell:not(.app-shell--document-scroll) {
			height: 100dvh;
			max-height: 100dvh;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}

		.app-shell:not(.app-shell--document-scroll) .app-header {
			flex-shrink: 0;
		}

		.app-main:not(.app-main--document-scroll) {
			flex: 1 1 0;
			min-height: 0;
			display: flex;
			flex-direction: column;
			overflow: hidden;
			/* Fill the shell; horizontal inset stays via px-* utilities. */
			padding-bottom: 0;
		}
	}
</style>
