<script lang="ts">
	import DisplaySettingsPanel from '$lib/components/DisplaySettingsPanel.svelte';
	import ExportViewsPanel from '$lib/components/ExportViewsPanel.svelte';
	import ImportViewsPanel from '$lib/components/ImportViewsPanel.svelte';
	import ModalHeader from '$lib/components/ModalHeader.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import type { TabOption } from '$lib/tabs';

	type SettingsSection = 'display' | 'import' | 'export';

	const sections: TabOption<SettingsSection>[] = [
		{
			value: 'display',
			label: 'Display settings',
			id: 'settings-tab-display',
			controls: 'settings-panel-display'
		},
		{
			value: 'import',
			label: 'Import views',
			id: 'settings-tab-import',
			controls: 'settings-panel-import'
		},
		{
			value: 'export',
			label: 'Export views',
			id: 'settings-tab-export',
			controls: 'settings-panel-export'
		}
	];

	let open = $state(false);
	let activeSection = $state<SettingsSection>('display');
	let settingsButton = $state<HTMLButtonElement | undefined>(undefined);
	let importSnackbar = $state<string | null>(null);
	let importSnackbarTimer: number | undefined;

	$effect(() => {
		if (open) return;
		importSnackbar = null;
		if (importSnackbarTimer !== undefined) {
			window.clearTimeout(importSnackbarTimer);
			importSnackbarTimer = undefined;
		}
	});

	function openSettings() {
		activeSection = 'display';
		open = true;
	}

	function close() {
		open = false;
		queueMicrotask(() => settingsButton?.focus());
	}

	function showImportSnackbar(message: string) {
		importSnackbar = message;
		if (importSnackbarTimer !== undefined) window.clearTimeout(importSnackbarTimer);
		importSnackbarTimer = window.setTimeout(() => {
			importSnackbar = null;
			importSnackbarTimer = undefined;
		}, 3000);
	}
</script>

<div class="display-settings-menu">
	<button
		bind:this={settingsButton}
		type="button"
		onclick={openSettings}
		class="flex items-center justify-center size-[34px] rounded-lg transition-all outline-none focus:ring-2 cursor-pointer"
		style="
			background-color: var(--bg-secondary);
			color: var(--text-primary);
			border: 1px solid {open ? 'var(--accent)' : 'var(--border)'};
			--tw-ring-color: var(--accent);
		"
		aria-label="Settings"
		aria-haspopup="dialog"
		aria-expanded={open}
	>
		<svg
			class="size-4"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
			/>
			<path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
		</svg>
	</button>
</div>

<ModalShell
	{open}
	onClose={close}
	labelledBy="settings-title"
	panelClass="max-h-[calc(100dvh-2rem)] max-w-2xl w-[min(100%,42rem)]"
	initialFocusSelector=".settings-tabs [role='tab'][aria-selected='true']"
>
	<ModalHeader titleId="settings-title" title="Settings" onClose={close} />

	<div class="settings-navigation">
		<Tabs
			value={activeSection}
			onChange={(section) => (activeSection = section)}
			options={sections}
			ariaLabel="Settings sections"
			class="settings-tabs"
			buttonClass="settings-tab"
			selectedClass="settings-tab--selected"
		/>
	</div>

	<div class="settings-panel-wrap">
		{#if activeSection === 'display'}
			<div
				id="settings-panel-display"
				class="settings-panel"
				role="tabpanel"
				aria-labelledby="settings-tab-display"
			>
				<DisplaySettingsPanel />
			</div>
		{:else if activeSection === 'import'}
			<div
				id="settings-panel-import"
				class="settings-panel"
				role="tabpanel"
				aria-labelledby="settings-tab-import"
			>
				<ImportViewsPanel onImported={showImportSnackbar} />
			</div>
		{:else}
			<div
				id="settings-panel-export"
				class="settings-panel"
				role="tabpanel"
				aria-labelledby="settings-tab-export"
			>
				<ExportViewsPanel />
			</div>
		{/if}
	</div>

	{#if importSnackbar}
		<div class="settings-snackbar" role="status" aria-live="polite">
			{importSnackbar}
		</div>
	{/if}
</ModalShell>

<style>
	.display-settings-menu {
		flex-shrink: 0;
	}

	.settings-navigation {
		padding: 0 1.25rem;
		border-bottom: 1px solid var(--border);
		background: var(--bg-secondary);
	}

	.settings-navigation :global(.settings-tabs) {
		display: flex;
		gap: 0.25rem;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.settings-navigation :global(.settings-tabs::-webkit-scrollbar) {
		display: none;
	}

	.settings-navigation :global(.settings-tab) {
		flex-shrink: 0;
		padding: 0.75rem 0.625rem;
		border: 0;
		border-bottom: 2px solid transparent;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		outline: none;
	}

	.settings-navigation :global(.settings-tab:hover) {
		color: var(--text-primary);
	}

	.settings-navigation :global(.settings-tab--selected) {
		border-bottom-color: var(--accent);
		color: var(--text-primary);
		font-weight: 600;
	}

	.settings-navigation :global(.settings-tab:focus-visible) {
		border-radius: 0.25rem;
		box-shadow: 0 0 0 2px var(--accent);
	}

	.settings-panel-wrap {
		min-height: 0;
		overflow-y: auto;
	}

	.settings-panel {
		padding: 1.25rem;
	}

	.settings-snackbar {
		position: absolute;
		inset-inline-start: 50%;
		inset-block-end: 1rem;
		z-index: 5;
		max-width: calc(100% - 2rem);
		transform: translateX(-50%);
		padding: 0.55rem 0.8rem;
		border: 1px solid color-mix(in srgb, var(--accent) 48%, var(--border));
		border-radius: 0.65rem;
		color: var(--text-primary);
		background: color-mix(in srgb, var(--bg-primary) 88%, var(--accent));
		box-shadow: 0 0.5rem 1.5rem color-mix(in srgb, black 30%, transparent);
		font-size: 0.8rem;
		font-weight: 600;
		line-height: 1.2;
		text-align: center;
		white-space: nowrap;
		pointer-events: none;
	}

	@media (max-width: 32rem) {
		.settings-snackbar {
			width: max-content;
			white-space: normal;
		}
	}
</style>
