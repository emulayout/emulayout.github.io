<script lang="ts">
	import ViewSelectionList from '$lib/components/ViewSelectionList.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import { serializeSavedFiltersDocument } from '$lib/savedFiltersStorage';

	let selectedKeys = $state<Set<string>>(new Set(filterStore.savedFilters.map((view) => view.id)));
	let status = $state('');
	let error = $state('');

	const selectableViews = $derived(
		filterStore.savedFilters.map((view) => ({ key: view.id, name: view.name }))
	);
	const selectedViews = $derived(
		filterStore.savedFilters.filter((view) => selectedKeys.has(view.id))
	);
	const backupText = $derived(serializeSavedFiltersDocument(selectedViews, 2));

	async function copyBackup() {
		try {
			await navigator.clipboard.writeText(backupText);
			error = '';
			status = `${selectedViews.length} ${selectedViews.length === 1 ? 'view' : 'views'} copied.`;
		} catch {
			status = '';
			error = 'The backup could not be copied. Select the JSON text and copy it manually.';
		}
	}

	function downloadBackup() {
		const blob = new Blob([backupText], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		const date = new Date().toISOString().slice(0, 10);
		link.href = url;
		link.download = `emulayout-views-${date}.json`;
		document.body.append(link);
		link.click();
		link.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 0);
		error = '';
		status = `${selectedViews.length} ${selectedViews.length === 1 ? 'view' : 'views'} downloaded.`;
	}
</script>

<div class="views-panel">
	<div class="views-panel-intro">
		<h3>Back up custom views</h3>
		<p>Select the views to include, then copy the backup or save it as a JSON file.</p>
	</div>

	<ViewSelectionList
		legend="Views to export"
		views={selectableViews}
		{selectedKeys}
		onChange={(next) => {
			selectedKeys = next;
			status = '';
			error = '';
		}}
		emptyMessage="Create a custom view before exporting a backup."
	/>

	<label class="views-field">
		<span>Backup JSON</span>
		<textarea value={backupText} rows="8" readonly spellcheck="false"></textarea>
	</label>

	{#if error}
		<p class="views-message views-message--error" role="alert">{error}</p>
	{:else if status}
		<p class="views-message" role="status">{status}</p>
	{/if}

	<div class="views-footer">
		<span>{selectedViews.length} of {filterStore.savedFilters.length} selected</span>
		<div class="views-actions">
			<button
				type="button"
				class="views-button views-button--secondary"
				disabled={selectedViews.length === 0}
				onclick={copyBackup}>Copy JSON</button
			>
			<button
				type="button"
				class="views-button views-button--primary"
				disabled={selectedViews.length === 0}
				onclick={downloadBackup}
			>
				<svg
					class="views-file-icon"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M4 16.5v2.25A1.25 1.25 0 005.25 20h13.5A1.25 1.25 0 0020 18.75V16.5M8 12l4 4m0 0 4-4m-4 4V3"
					/>
				</svg>
				Download file
			</button>
		</div>
	</div>
</div>

<style>
	.views-panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.views-panel-intro h3,
	.views-panel-intro p,
	.views-message {
		margin: 0;
	}

	.views-panel-intro h3 {
		color: var(--text-primary);
		font-size: 1rem;
		font-weight: 600;
	}

	.views-panel-intro p {
		margin-top: 0.25rem;
		color: var(--text-secondary);
		font-size: 0.8125rem;
		line-height: 1.45;
	}

	.views-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		color: var(--text-primary);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.views-field textarea {
		width: 100%;
		min-height: 8.5rem;
		resize: vertical;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.625rem;
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.75rem;
		font-weight: 400;
		line-height: 1.45;
		outline: none;
	}

	.views-field textarea:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
	}

	.views-footer,
	.views-actions {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.views-footer {
		justify-content: space-between;
		padding-top: 0.875rem;
		border-top: 1px solid var(--border);
		color: var(--text-secondary);
		font-size: 0.75rem;
	}

	.views-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		min-height: 2.25rem;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		font-size: 0.8125rem;
		font-weight: 600;
		line-height: 1.2;
		cursor: pointer;
	}

	.views-button--secondary {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.views-button--primary {
		border-color: var(--accent);
		background: var(--accent);
		color: white;
	}

	.views-button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.views-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.views-file-icon {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	.views-message {
		padding: 0.625rem 0.75rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--accent) 9%, transparent);
		color: var(--text-secondary);
		font-size: 0.8125rem;
	}

	.views-message--error {
		background: color-mix(in srgb, #dc2626 10%, transparent);
		color: #dc2626;
	}

	@media (max-width: 32rem) {
		.views-footer {
			align-items: stretch;
			flex-direction: column;
		}

		.views-actions {
			width: 100%;
		}

		.views-actions .views-button {
			flex: 1;
		}
	}
</style>
