<script lang="ts">
	import ViewSelectionList from '$lib/components/ViewSelectionList.svelte';
	import { filterStore, type SavedFilter } from '$lib/filterStore.svelte';
	import {
		parseSavedViewsBackup,
		type SavedViewsBackupError,
		type SavedViewsImportMode
	} from '$lib/savedViewsBackup';

	interface ImportCandidate {
		key: string;
		view: SavedFilter;
	}

	interface Props {
		onImported: (message: string) => void;
	}

	let { onImported }: Props = $props();

	let backupText = $state('');
	let candidates = $state<ImportCandidate[]>([]);
	let selectedKeys = $state<Set<string>>(new Set());
	let importMode = $state<SavedViewsImportMode>('add');
	let sourceLabel = $state('');
	let status = $state('');
	let error = $state('');
	let backupTextarea = $state<HTMLTextAreaElement | undefined>(undefined);

	const selectableViews = $derived(
		candidates.map((candidate) => ({ key: candidate.key, name: candidate.view.name }))
	);
	const selectedCount = $derived(selectedKeys.size);

	function errorMessage(code: SavedViewsBackupError): string {
		switch (code) {
			case 'empty':
				return 'Paste a backup or choose a JSON file first.';
			case 'invalid-json':
				return 'This is not valid JSON. Check the backup text and try again.';
			case 'unsupported-format':
				return 'This JSON is not an emulayout views backup.';
			case 'no-views':
				return 'No valid views were found in this backup.';
		}
	}

	function inspectBackup(label = '') {
		status = '';
		error = '';
		const result = parseSavedViewsBackup(backupText);
		if (!result.ok) {
			candidates = [];
			selectedKeys = new Set();
			error = errorMessage(result.error);
			return;
		}

		candidates = result.filters.map((view, index) => ({
			key: `${index}:${view.id}`,
			view
		}));
		selectedKeys = new Set(candidates.map((candidate) => candidate.key));
		sourceLabel = label;
		status = `${result.filters.length} ${result.filters.length === 1 ? 'view' : 'views'} ready to import.${
			result.skippedCount > 0
				? ` ${result.skippedCount} invalid ${result.skippedCount === 1 ? 'entry was' : 'entries were'} skipped.`
				: ''
		}`;
	}

	async function chooseFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		try {
			backupText = await file.text();
			inspectBackup(file.name);
		} catch {
			candidates = [];
			selectedKeys = new Set();
			status = '';
			error = 'The selected file could not be read.';
		} finally {
			input.value = '';
		}
	}

	function importSelectedViews() {
		const selected = candidates
			.filter((candidate) => selectedKeys.has(candidate.key))
			.map((candidate) => candidate.view);
		if (selected.length === 0) return;

		filterStore.importSavedViews(selected, importMode);
		const message = `${selected.length} ${selected.length === 1 ? 'view' : 'views'} imported${
			importMode === 'replace' ? ', replacing the previous collection' : ''
		}.`;
		backupText = '';
		candidates = [];
		selectedKeys = new Set();
		importMode = 'add';
		sourceLabel = '';
		error = '';
		status = '';
		onImported(message);
		queueMicrotask(() => backupTextarea?.focus());
	}
</script>

<div class="views-panel">
	<div class="views-panel-intro">
		<h3>Restore a views backup</h3>
		<p>Paste backup JSON or choose a file, then select the views to restore.</p>
	</div>

	<label class="views-field">
		<span>Backup JSON</span>
		<textarea
			bind:this={backupTextarea}
			bind:value={backupText}
			rows="6"
			spellcheck="false"
			placeholder="Paste an emulayout views backup here"
			oninput={() => {
				candidates = [];
				selectedKeys = new Set();
				sourceLabel = '';
				status = '';
				error = '';
			}}></textarea>
	</label>

	<div class="views-input-actions">
		<button
			type="button"
			class="views-button views-button--secondary"
			onclick={() => inspectBackup()}
		>
			Review pasted views
		</button>
		<label class="views-file-button">
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
					d="M4 16.5v2.25A1.25 1.25 0 005.25 20h13.5A1.25 1.25 0 0020 18.75V16.5M8 7l4-4m0 0 4 4m-4-4v13"
				/>
			</svg>
			<span>Choose JSON file</span>
			<input type="file" accept="application/json,.json" onchange={chooseFile} />
		</label>
		{#if sourceLabel}
			<span class="views-file-name" title={sourceLabel}>{sourceLabel}</span>
		{/if}
	</div>

	{#if error}
		<p class="views-message views-message--error" role="alert">{error}</p>
	{:else if status}
		<p class="views-message" role="status">{status}</p>
	{/if}

	{#if candidates.length > 0}
		<ViewSelectionList
			legend="Views to import"
			views={selectableViews}
			{selectedKeys}
			onChange={(next) => (selectedKeys = next)}
			emptyMessage="No views found."
		/>

		<fieldset class="import-mode">
			<legend>Import behavior</legend>
			<label>
				<input type="radio" name="view-import-mode" value="add" bind:group={importMode} />
				<span>
					<strong>Add to existing views</strong>
					<small>Matching view names or IDs are updated; other local views stay in place.</small>
				</span>
			</label>
			<label>
				<input type="radio" name="view-import-mode" value="replace" bind:group={importMode} />
				<span>
					<strong>Replace all views</strong>
					<small>Only the selected imported views will remain.</small>
				</span>
			</label>
		</fieldset>

		<div class="views-footer">
			<span>{selectedCount} of {candidates.length} selected</span>
			<button
				type="button"
				class="views-button views-button--primary"
				disabled={selectedCount === 0}
				onclick={importSelectedViews}
			>
				Import {selectedCount === 1 ? 'view' : 'views'}
			</button>
		</div>
	{/if}
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
		min-height: 7.5rem;
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

	.views-input-actions,
	.views-footer {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.views-button,
	.views-file-button {
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

	.views-button--secondary,
	.views-file-button {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.views-button--primary {
		border-color: var(--accent);
		background: var(--accent);
		color: white;
	}

	.views-button:focus-visible,
	.views-file-button:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.views-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.views-file-button input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}

	.views-file-icon {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	.views-file-name {
		min-width: 0;
		overflow: hidden;
		color: var(--text-secondary);
		font-size: 0.75rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.views-message {
		padding: 0.625rem 0.75rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--accent) 9%, transparent);
		color: var(--text-secondary);
		font-size: 0.8125rem;
		line-height: 1.4;
	}

	.views-message--error {
		background: color-mix(in srgb, #dc2626 10%, transparent);
		color: #dc2626;
	}

	.import-mode {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.625rem;
		margin: 0;
		padding: 0;
		border: 0;
	}

	.import-mode legend {
		grid-column: 1 / -1;
		margin-bottom: 0.125rem;
		padding: 0;
		color: var(--text-primary);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.import-mode label {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.625rem;
		cursor: pointer;
	}

	.import-mode label:has(input:checked) {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 7%, transparent);
	}

	.import-mode input {
		margin-top: 0.125rem;
		accent-color: var(--accent);
	}

	.import-mode span {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.import-mode strong {
		color: var(--text-primary);
		font-size: 0.8125rem;
	}

	.import-mode small {
		color: var(--text-secondary);
		font-size: 0.75rem;
		line-height: 1.4;
	}

	.views-footer {
		justify-content: space-between;
		padding-top: 0.875rem;
		border-top: 1px solid var(--border);
		color: var(--text-secondary);
		font-size: 0.75rem;
	}

	@media (max-width: 32rem) {
		.import-mode {
			grid-template-columns: minmax(0, 1fr);
		}

		.views-input-actions {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
