<script lang="ts">
	import ViewSelectionList from '$lib/components/ViewSelectionList.svelte';

	interface BackupListItem {
		key: string;
		name: string;
	}

	interface Props {
		items: BackupListItem[];
		serialize: (selectedKeys: ReadonlySet<string>) => string;
		title: string;
		description: string;
		legend: string;
		emptyMessage: string;
		singularNoun: string;
		pluralNoun: string;
		filenamePrefix: string;
	}

	const {
		items,
		serialize,
		title,
		description,
		legend,
		emptyMessage,
		singularNoun,
		pluralNoun,
		filenamePrefix
	}: Props = $props();

	let selectedKeys = $state<Set<string>>(new Set());
	let selectionInitialized = $state(false);
	let status = $state('');
	let error = $state('');

	const selectedCount = $derived(items.filter((item) => selectedKeys.has(item.key)).length);
	const backupText = $derived(serialize(selectedKeys));

	$effect(() => {
		if (selectionInitialized) return;
		selectedKeys = new Set(items.map((item) => item.key));
		selectionInitialized = true;
	});

	async function copyBackup() {
		try {
			await navigator.clipboard.writeText(backupText);
			error = '';
			status = `${selectedCount} ${selectedCount === 1 ? singularNoun : pluralNoun} copied.`;
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
		link.download = `${filenamePrefix}-${date}.json`;
		document.body.append(link);
		link.click();
		link.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 0);
		error = '';
		status = `${selectedCount} ${selectedCount === 1 ? singularNoun : pluralNoun} downloaded.`;
	}
</script>

<div class="backup-panel">
	<div class="backup-panel-intro">
		<h3>{title}</h3>
		<p>{description}</p>
	</div>

	<ViewSelectionList
		{legend}
		views={items}
		{selectedKeys}
		onChange={(next) => {
			selectedKeys = next;
			status = '';
			error = '';
		}}
		{emptyMessage}
	/>

	<label class="backup-field">
		<span>Backup JSON</span>
		<textarea value={backupText} rows="8" readonly spellcheck="false"></textarea>
	</label>

	{#if error}
		<p class="backup-message backup-message--error" role="alert">{error}</p>
	{:else if status}
		<p class="backup-message" role="status">{status}</p>
	{/if}

	<div class="backup-footer">
		<span>{selectedCount} of {items.length} selected</span>
		<div class="backup-actions">
			<button
				type="button"
				class="backup-button backup-button--secondary"
				disabled={selectedCount === 0}
				onclick={copyBackup}>Copy JSON</button
			>
			<button
				type="button"
				class="backup-button backup-button--primary"
				disabled={selectedCount === 0}
				onclick={downloadBackup}
			>
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
						d="M4 16.5v2.25A1.25 1.25 0 005.25 20h13.5A1.25 1.25 0 0020 18.75V16.5M8 12l4 4m0 0 4-4m-4 4V3"
					/>
				</svg>
				Download file
			</button>
		</div>
	</div>
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

	.backup-field textarea:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
	}

	.backup-footer,
	.backup-actions {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.backup-footer {
		justify-content: space-between;
		padding-top: 0.875rem;
		border-top: 1px solid var(--border);
		color: var(--text-secondary);
		font-size: 0.75rem;
	}

	.backup-button {
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

	.backup-button--secondary {
		background: var(--bg-secondary);
		color: var(--text-primary);
	}

	.backup-button--primary {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accent-fg);
	}

	.backup-button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.backup-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.backup-file-icon {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
	}

	.backup-message {
		padding: 0.625rem 0.75rem;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--accent) 9%, transparent);
		color: var(--text-secondary);
		font-size: 0.8125rem;
	}

	.backup-message--error {
		background: color-mix(in srgb, #dc2626 10%, transparent);
		color: #dc2626;
	}

	@media (max-width: 32rem) {
		.backup-footer {
			align-items: stretch;
			flex-direction: column;
		}

		.backup-actions {
			width: 100%;
		}

		.backup-actions .backup-button {
			flex: 1;
		}
	}
</style>
