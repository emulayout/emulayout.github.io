<script lang="ts" generics="T">
	import ViewSelectionList from '$lib/components/ViewSelectionList.svelte';

	type ImportMode = 'add' | 'replace';
	type ParseResult = { ok: true; items: T[]; skippedCount: number } | { ok: false; error: string };

	interface ImportCandidate {
		key: string;
		item: T;
	}

	interface Props {
		parse: (text: string) => ParseResult;
		itemId: (item: T) => string;
		itemName: (item: T) => string;
		onImport: (items: T[], mode: ImportMode) => boolean | void;
		onImported: (message: string) => void;
		errorMessage: (code: string) => string;
		title: string;
		description: string;
		placeholder: string;
		legend: string;
		emptyMessage: string;
		singularNoun: string;
		pluralNoun: string;
		radioName: string;
		importError: string;
	}

	const {
		parse,
		itemId,
		itemName,
		onImport,
		onImported,
		errorMessage,
		title,
		description,
		placeholder,
		legend,
		emptyMessage,
		singularNoun,
		pluralNoun,
		radioName,
		importError
	}: Props = $props();

	let backupText = $state('');
	let candidates = $state<ImportCandidate[]>([]);
	let selectedKeys = $state<Set<string>>(new Set());
	let importMode = $state<ImportMode>('add');
	let sourceLabel = $state('');
	let status = $state('');
	let error = $state('');
	let backupTextarea = $state<HTMLTextAreaElement | undefined>(undefined);

	const selectableItems = $derived(
		candidates.map((candidate) => ({ key: candidate.key, name: itemName(candidate.item) }))
	);
	const selectedCount = $derived(selectedKeys.size);

	function inspectBackup(label = '') {
		status = '';
		error = '';
		sourceLabel = '';
		const result = parse(backupText);
		if (!result.ok) {
			candidates = [];
			selectedKeys = new Set();
			error = errorMessage(result.error);
			return;
		}

		candidates = result.items.map((item, index) => ({
			key: `${index}:${itemId(item)}`,
			item
		}));
		selectedKeys = new Set(candidates.map((candidate) => candidate.key));
		sourceLabel = label;
		status = `${result.items.length} ${result.items.length === 1 ? singularNoun : pluralNoun} ready to import.${
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
			sourceLabel = '';
			status = '';
			error = 'The selected file could not be read.';
		} finally {
			input.value = '';
		}
	}

	function importSelectedItems() {
		const selected = candidates
			.filter((candidate) => selectedKeys.has(candidate.key))
			.map((candidate) => candidate.item);
		if (selected.length === 0) return;
		if (onImport(selected, importMode) === false) {
			error = importError;
			status = '';
			return;
		}

		const message = `${selected.length} ${selected.length === 1 ? singularNoun : pluralNoun} imported${
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

<div class="backup-panel">
	<div class="backup-panel-intro">
		<h3>{title}</h3>
		<p>{description}</p>
	</div>

	<label class="backup-field">
		<span>Backup JSON</span>
		<textarea
			bind:this={backupTextarea}
			bind:value={backupText}
			rows="6"
			spellcheck="false"
			{placeholder}
			oninput={() => {
				candidates = [];
				selectedKeys = new Set();
				sourceLabel = '';
				status = '';
				error = '';
			}}></textarea>
	</label>

	<div class="backup-input-actions">
		<button
			type="button"
			class="backup-button backup-button--secondary"
			onclick={() => inspectBackup()}
		>
			Review pasted {pluralNoun}
		</button>
		<label class="backup-file-button">
			<svg
				class="backup-file-icon"
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
			<span class="backup-file-name" title={sourceLabel}>{sourceLabel}</span>
		{/if}
	</div>

	{#if error}
		<p class="backup-message backup-message--error" role="alert">{error}</p>
	{:else if status}
		<p class="backup-message" role="status">{status}</p>
	{/if}

	{#if candidates.length > 0}
		<ViewSelectionList
			{legend}
			views={selectableItems}
			{selectedKeys}
			onChange={(next) => (selectedKeys = next)}
			{emptyMessage}
		/>

		<fieldset class="import-mode">
			<legend>Import behavior</legend>
			<label>
				<input type="radio" name={radioName} value="add" bind:group={importMode} />
				<span>
					<strong>Add to existing {pluralNoun}</strong>
					<small
						>Matching {singularNoun} names or IDs are updated; other local {pluralNoun} stay in place.</small
					>
				</span>
			</label>
			<label>
				<input type="radio" name={radioName} value="replace" bind:group={importMode} />
				<span>
					<strong>Replace all {pluralNoun}</strong>
					<small>Only the selected imported {pluralNoun} will remain.</small>
				</span>
			</label>
		</fieldset>

		<div class="backup-footer">
			<span>{selectedCount} of {candidates.length} selected</span>
			<button
				type="button"
				class="backup-button backup-button--primary"
				disabled={selectedCount === 0}
				onclick={importSelectedItems}
			>
				Import {selectedCount === 1 ? singularNoun : pluralNoun}
			</button>
		</div>
	{/if}
</div>

<style>
	.backup-panel {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.backup-panel-intro h3,
	.backup-panel-intro p,
	.backup-message {
		margin: 0;
	}

	.backup-panel-intro h3 {
		color: var(--text-primary);
		font-size: 1rem;
		font-weight: 600;
	}

	.backup-panel-intro p {
		margin-top: 0.25rem;
		color: var(--text-secondary);
		font-size: 0.8125rem;
		line-height: 1.45;
	}

	.backup-field {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		color: var(--text-primary);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.backup-field textarea {
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

	.backup-field textarea:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
	}

	.backup-input-actions,
	.backup-footer {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.backup-button,
	.backup-file-button {
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

	.backup-button--secondary,
	.backup-file-button {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.backup-button--primary {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accent-fg);
	}

	.backup-button:focus-visible,
	.backup-file-button:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.backup-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.backup-file-button input {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}

	.backup-file-icon {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	.backup-file-name {
		min-width: 0;
		overflow: hidden;
		color: var(--text-secondary);
		font-size: 0.75rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.backup-message {
		padding: 0.625rem 0.75rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--accent) 9%, transparent);
		color: var(--text-secondary);
		font-size: 0.8125rem;
		line-height: 1.4;
	}

	.backup-message--error {
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

	.backup-footer {
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

		.backup-input-actions {
			align-items: stretch;
			flex-direction: column;
		}
	}
</style>
