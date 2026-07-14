<script lang="ts">
	import './layout.css';
	import RecentLayoutsModal from '$lib/components/RecentLayoutsModal.svelte';
	import QuickFindModal from '$lib/components/QuickFindModal.svelte';

	let { children } = $props();

	type ThemeMode = 'system' | 'light' | 'dark';

	let themeMode: ThemeMode = $state('system');
	let systemPrefersDark = $state(false);
	let showRecentLayouts = $state(false);
	let showQuickFind = $state(false);
	let mediaQuery: MediaQueryList | null = null;

	const dark = $derived.by(() => {
		return themeMode === 'dark' || (themeMode === 'system' && systemPrefersDark);
	});

	// Initialize theme mode and follow OS changes while in system mode.
	$effect(() => {
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

	// Cmd+K (Mac) / Ctrl+K (Windows, Linux) opens quick find
	$effect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			if (event.key.toLowerCase() !== 'k') return;
			if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
			event.preventDefault();
			showRecentLayouts = false;
			if (showQuickFind) {
				window.dispatchEvent(new Event('emulayout:quick-find-refocus'));
				return;
			}
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
</script>

<svelte:head>
	<title>Emulayout</title>
</svelte:head>

<div class="min-h-screen">
	<header
		class="flex items-center justify-between gap-3 py-3 px-3 max-w-7xl mx-auto md:grid md:grid-cols-3"
	>
		<div class="hidden md:block"></div>
		<a
			href="/"
			data-sveltekit-reload
			class="flex min-w-0 items-center justify-start gap-3 no-underline hover:opacity-90 transition-opacity md:justify-center"
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
		<div class="flex shrink-0 justify-end gap-2">
			<button
				onclick={openRecentLayouts}
				class="group relative size-10 rounded-full transition-all duration-300 hover:scale-110"
				style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
				aria-label="New layouts from the last 7 days"
			>
				<svg
					class="absolute inset-0 m-auto size-5 transition-all duration-300"
					style="color: var(--accent);"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
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
					style="color: var(--accent);"
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
				<!-- Sun icon -->
				<svg
					class="absolute inset-0 m-auto size-5 transition-all duration-300"
					style="color: var(--accent); opacity: {dark ? 0 : 1}; transform: rotate({dark
						? -90
						: 0}deg) scale({dark ? 0.5 : 1});"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<circle cx="12" cy="12" r="4" />
					<path
						d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
					/>
				</svg>
				<!-- Moon icon -->
				<svg
					class="absolute inset-0 m-auto size-5 transition-all duration-300"
					style="color: var(--accent); opacity: {dark ? 1 : 0}; transform: rotate({dark
						? 0
						: 90}deg) scale({dark ? 1 : 0.5});"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
				</svg>
			</button>
		</div>
	</header>

	<main class="px-3 pb-4">
		{@render children()}
	</main>
</div>

<RecentLayoutsModal open={showRecentLayouts} onClose={() => (showRecentLayouts = false)} />
<QuickFindModal open={showQuickFind} onClose={() => (showQuickFind = false)} />
