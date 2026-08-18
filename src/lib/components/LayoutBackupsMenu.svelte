<script lang="ts">
	import BackupExportPanel from '$lib/components/BackupExportPanel.svelte';
	import BackupImportPanel from '$lib/components/BackupImportPanel.svelte';
	import ModalHeader from '$lib/components/ModalHeader.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import Tabs from '$lib/components/Tabs.svelte';
	import {
		serializeSavedLayoutsDocument,
		type SavedCreatorLayout
	} from '$lib/layoutCreatorStorage';
	import {
		parseSavedLayoutsBackup,
		type SavedLayoutsBackupError,
		type SavedLayoutsImportMode
	} from '$lib/savedLayoutsBackup';
	import type { TabOption } from '$lib/tabs';

	type BackupSection = 'export' | 'import';

	interface Props {
		layouts: SavedCreatorLayout[];
		onImport: (layouts: SavedCreatorLayout[], mode: SavedLayoutsImportMode) => boolean;
	}

	const sections: TabOption<BackupSection>[] = [
		{
			value: 'export',
			label: 'Export layouts',
			id: 'layout-backups-tab-export',
			controls: 'layout-backups-panel-export'
		},
		{
			value: 'import',
			label: 'Import layouts',
			id: 'layout-backups-tab-import',
			controls: 'layout-backups-panel-import'
		}
	];

	let { layouts, onImport }: Props = $props();
	let open = $state(false);
	let activeSection = $state<BackupSection>('export');
	let settingsButton = $state<HTMLButtonElement | undefined>(undefined);
	let importSnackbar = $state<string | null>(null);
	let importSnackbarTimer: number | undefined;

	const exportItems = $derived(layouts.map((layout) => ({ key: layout.id, name: layout.name })));

	$effect(() => {
		if (open) return;
		importSnackbar = null;
		if (importSnackbarTimer !== undefined) {
			window.clearTimeout(importSnackbarTimer);
			importSnackbarTimer = undefined;
		}
	});

	function openSettings() {
		activeSection = 'export';
		open = true;
	}

	function close() {
		open = false;
		queueMicrotask(() => settingsButton?.focus());
	}

	function serialize(selectedKeys: ReadonlySet<string>) {
		return serializeSavedLayoutsDocument(
			layouts.filter((layout) => selectedKeys.has(layout.id)),
			2
		);
	}

	function parse(text: string) {
		const result = parseSavedLayoutsBackup(text);
		return result.ok
			? { ok: true as const, items: result.layouts, skippedCount: result.skippedCount }
			: result;
	}

	function errorMessage(code: string): string {
		switch (code as SavedLayoutsBackupError) {
			case 'empty':
				return 'Paste a backup or choose a JSON file first.';
			case 'invalid-json':
				return 'This is not valid JSON. Check the backup text and try again.';
			case 'unsupported-format':
				return 'This JSON is not an Emulayout layout backup.';
			case 'no-layouts':
				return 'No valid layouts were found in this backup.';
			default:
				return 'This backup could not be read.';
		}
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

<div class="layout-backups-menu">
	<button
		bind:this={settingsButton}
		type="button"
		onclick={openSettings}
		class="layout-backups-trigger"
		aria-label="Layout backup settings"
		aria-haspopup="dialog"
		aria-expanded={open}
	>
		<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true">
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
	labelledBy="layout-backups-title"
	panelClass="max-h-[calc(100dvh-2rem)] max-w-2xl w-[min(100%,42rem)]"
	initialFocusSelector=".layout-backups-tabs [role='tab'][aria-selected='true']"
>
	<ModalHeader titleId="layout-backups-title" title="Layout backups" onClose={close} />

	<div class="layout-backups-navigation">
		<Tabs
			value={activeSection}
			onChange={(section) => (activeSection = section)}
			options={sections}
			ariaLabel="Layout backup sections"
			class="layout-backups-tabs"
			buttonClass="layout-backups-tab"
			selectedClass="layout-backups-tab--selected"
		/>
	</div>

	<div class="layout-backups-panel-wrap">
		{#if activeSection === 'export'}
			<div
				id="layout-backups-panel-export"
				class="layout-backups-panel"
				role="tabpanel"
				aria-labelledby="layout-backups-tab-export"
			>
				<BackupExportPanel
					items={exportItems}
					{serialize}
					title="Back up saved layouts"
					description="Select the layouts to include, then copy the backup or save it as a JSON file."
					legend="Layouts to export"
					emptyMessage="Save a layout before exporting a backup."
					singularNoun="layout"
					pluralNoun="layouts"
					filenamePrefix="emulayout-layouts"
				/>
			</div>
		{:else}
			<div
				id="layout-backups-panel-import"
				class="layout-backups-panel"
				role="tabpanel"
				aria-labelledby="layout-backups-tab-import"
			>
				<BackupImportPanel
					{parse}
					itemId={(layout) => layout.id}
					itemName={(layout) => layout.name}
					{onImport}
					onImported={showImportSnackbar}
					{errorMessage}
					title="Restore a layout backup"
					description="Paste backup JSON or choose a file, then select the layouts to restore."
					placeholder="Paste an Emulayout layout backup here"
					legend="Layouts to import"
					emptyMessage="No layouts found."
					singularNoun="layout"
					pluralNoun="layouts"
					radioName="layout-import-mode"
					importError="The layouts could not be saved in this browser."
				/>
			</div>
		{/if}
	</div>

	{#if importSnackbar}
		<div class="layout-backups-snackbar" role="status" aria-live="polite">
			{importSnackbar}
		</div>
	{/if}
</ModalShell>

<style>
	.layout-backups-menu {
		flex: 0 0 auto;
		align-self: center;
		margin-bottom: 0.125rem;
	}

	.layout-backups-trigger {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.125rem;
		height: 2.125rem;
		padding: 0;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		cursor: pointer;
		transition:
			border-color 0.15s ease,
			background-color 0.15s ease;
	}

	.layout-backups-trigger:hover,
	.layout-backups-trigger[aria-expanded='true'] {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 8%, var(--bg-secondary));
	}

	.layout-backups-trigger:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.layout-backups-trigger svg {
		width: 1rem;
		height: 1rem;
	}

	.layout-backups-navigation {
		padding: 0 1.25rem;
		border-bottom: 1px solid var(--border);
		background: var(--bg-secondary);
	}

	.layout-backups-navigation :global(.layout-backups-tabs) {
		display: flex;
		gap: 0.25rem;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.layout-backups-navigation :global(.layout-backups-tabs::-webkit-scrollbar) {
		display: none;
	}

	.layout-backups-navigation :global(.layout-backups-tab) {
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

	.layout-backups-navigation :global(.layout-backups-tab:hover) {
		color: var(--text-primary);
	}

	.layout-backups-navigation :global(.layout-backups-tab--selected) {
		border-bottom-color: var(--accent);
		color: var(--text-primary);
		font-weight: 600;
	}

	.layout-backups-navigation :global(.layout-backups-tab:focus-visible) {
		border-radius: 0.25rem;
		outline: 2px solid var(--accent);
		outline-offset: -2px;
	}

	.layout-backups-panel-wrap {
		min-height: 0;
		overflow-y: auto;
	}

	.layout-backups-panel {
		padding: 1.25rem;
	}

	.layout-backups-snackbar {
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
		.layout-backups-snackbar {
			width: max-content;
			white-space: normal;
		}
	}
</style>
