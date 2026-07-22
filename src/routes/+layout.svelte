<script lang="ts">
	import './layout.css';
	import RecentLayoutsModal from '$lib/components/RecentLayoutsModal.svelte';
	import QuickFindModal from '$lib/components/QuickFindModal.svelte';
	import { LAYOUT_SPLIT_MIN_WIDTH, TAILWIND_BREAKPOINTS } from '$lib/constants';
	import { hasOpenModal } from '$lib/modalScrollLock';
	import { uiPrefs } from '$lib/uiPrefs.svelte';
	import { MediaQuery } from 'svelte/reactivity';

	let { children } = $props();

	type ThemeMode = 'system' | 'light' | 'dark';

	let themeMode: ThemeMode = $state('system');
	let systemPrefersDark = $state(false);
	let showRecentLayouts = $state(false);
	let showQuickFind = $state(false);
	let mediaQuery: MediaQueryList | null = null;
	let debugEnabled = $state(false);

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
			: lgUp.current
				? `split (≥${LAYOUT_SPLIT_MIN_WIDTH})`
				: `stack (<${LAYOUT_SPLIT_MIN_WIDTH})`
	);

	const dark = $derived.by(() => {
		return themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark);
	});

	// Initialize theme mode and follow OS changes while in system mode.
	$effect(() => {
		debugEnabled = localStorage.getItem('debug') === 'true';
		uiPrefs.hydrate();

		const stored = localStorage.getItem('theme');
		themeMode = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';

		mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		systemPrefersDark = mediaQuery.matches;

		const handleChange = (event: MediaQueryListEvent) => {
			systemPrefersDark = event.matches;
		};

		mediaQuery.addEventListener('change', handleChange);
		return () => mediaQuery?.removeEventListener('change', handleChange);
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
	$effect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key.toLowerCase() !== 'k') return;
			if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
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
			showRecentLayouts = false;
			showQuickFind = true;
		}

		document.addEventListener('keydown', handleKeyDown);
		return () => document.removeEventListener('keydown', handleKeyDown);
	});

	function openQuickFind() {
		showRecentLayouts = false;
		showQuickFind = true;
	}

	function openRecentLayouts() {
		showQuickFind = false;
		showRecentLayouts = true;
	}

	function openCompare() {
		showRecentLayouts = false;
		showQuickFind = false;
		window.dispatchEvent(
			new CustomEvent('emulayout:open-compare', { detail: { mode: 'restore' } })
		);
	}

	function openCompareHotkey() {
		showRecentLayouts = false;
		showQuickFind = false;
		window.dispatchEvent(
			new CustomEvent('emulayout:open-compare', { detail: { mode: 'hotkey' } })
		);
	}

	function toggleTheme() {
		themeMode =
			themeMode === 'system' ? 'light' : themeMode === 'light' ? 'dark' : 'system';
	}

	const themeButtonLabel = $derived(
		themeMode === 'system'
			? `Theme: system (${dark ? 'dark' : 'light'}). Switch to light mode`
			: themeMode === 'light'
				? 'Theme: light. Switch to dark mode'
				: 'Theme: dark. Switch to system mode'
	);

	const hintsButtonLabel = $derived(
		uiPrefs.hintsEnabled ? 'Hide help hints' : 'Show help hints'
	);
</script>

<svelte:head>
	<title>Emulayout</title>
</svelte:head>

<div class="app-shell">
	<header class="app-header px-3 py-3 md:px-6">
		<div class="flex w-full items-center justify-between gap-3">
		<div class="flex min-w-0 items-center gap-3">
			<a
				href="/"
				data-sveltekit-reload
				class="flex min-w-0 items-center gap-3 no-underline hover:opacity-90 transition-opacity"
			>
				<img
					src="/keycap.png"
					alt=""
					width="71"
					height="72"
					class="shrink-0 h-8 w-auto"
				/>
				<h1 class="truncate text-3xl font-bold tracking-tight" style="color: var(--text-primary);">
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
				onclick={openRecentLayouts}
				class="group relative size-10 rounded-full transition-all duration-300 hover:scale-110"
				style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
				aria-label="New layouts from the last 7 days"
			>
				<svg
					class="absolute inset-0 m-auto size-5 transition-all duration-300"
					style="color: var(--text-primary);"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
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
						: 0}; transform: rotate({themeMode === 'light'
						? 0
						: -90}deg) scale({themeMode === 'light' ? 1 : 0.5});"
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
						: 0}; transform: rotate({themeMode === 'dark'
						? 0
						: 90}deg) scale({themeMode === 'dark' ? 1 : 0.5});"
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

	<main class="app-main px-3 pb-3 md:px-6 md:pb-4">
		{@render children()}
	</main>
</div>

<RecentLayoutsModal open={showRecentLayouts} onClose={() => (showRecentLayouts = false)} />
<QuickFindModal open={showQuickFind} onClose={() => (showQuickFind = false)} />

<style>
	.app-shell {
		min-height: 100dvh;
	}

	.app-header {
		position: relative;
		z-index: 20;
		background-color: var(--bg-primary);
		box-shadow: var(--app-bar-shadow-color) 0px -4px 20px 7px;
		margin-bottom: 1.5rem;
	}

	.app-header-toggle--on {
		border-color: var(--accent) !important;
		background-color: color-mix(in srgb, var(--accent) 16%, var(--bg-secondary)) !important;
	}

	/* Desktop split view: lock the shell to the viewport so columns scroll independently. */
	@media (min-width: 1024px) {
		.app-shell {
			height: 100dvh;
			max-height: 100dvh;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}

		.app-header {
			flex-shrink: 0;
		}

		.app-main {
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
