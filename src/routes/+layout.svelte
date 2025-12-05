<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { browser } from '$app/environment';

	let { children } = $props();

	let dark = $state(false);

	// Initialize theme from localStorage or system preference
	$effect(() => {
		if (browser) {
			const stored = localStorage.getItem('theme');
			if (stored) {
				dark = stored === 'dark';
			} else {
				dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			}
		}
	});

	// Apply theme class to document
	$effect(() => {
		if (browser) {
			document.documentElement.classList.toggle('dark', dark);
			localStorage.setItem('theme', dark ? 'dark' : 'light');
		}
	});

	function toggleTheme() {
		dark = !dark;
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen">
	<header class="flex justify-end p-4">
		<button
			onclick={toggleTheme}
			class="group relative size-10 rounded-full transition-all duration-300 hover:scale-110"
			style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
			aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
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
	</header>

	<main class="px-4 pb-8">
		{@render children()}
	</main>
</div>
