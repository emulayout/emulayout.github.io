<script lang="ts">
	import ModalHeader from '$lib/components/ModalHeader.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import {
		applyKeyboardInputImport,
		parseKeyboardInputImportRows,
		type KeyboardInputConfig
	} from '$lib/keyboardInputConfig';

	interface Props {
		open: boolean;
		config: KeyboardInputConfig;
		onClose: () => void;
		onImport: (config: KeyboardInputConfig) => void;
	}

	let { open, config, onClose, onImport }: Props = $props();
	const exampleLayout = `q w e r t y u i o p
a s d f g h j k l ;
z x c v b n m , . /`;
	let text = $state('');
	const parsedRows = $derived(parseKeyboardInputImportRows(text));
	const invalidText = $derived(Boolean(text.trim()) && !parsedRows);

	$effect(() => {
		if (open) text = '';
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		const imported = applyKeyboardInputImport(config, text);
		if (!imported) return;
		onImport(imported);
		onClose();
	}
</script>

<ModalShell
	{open}
	{onClose}
	labelledBy="layout-key-import-title"
	panelClass="max-w-xl"
	initialFocusSelector="#layout-key-import-text"
>
	<ModalHeader titleId="layout-key-import-title" title="Import layout" {onClose} />

	<form onsubmit={submit}>
		<div class="layout-key-import-content">
			<p>
				Paste one keyboard row per line, with spaces between keys. Bracketed rows and
				Markdown-linked rows are also supported.
			</p>
			<label>
				<span>Layout keys</span>
				<textarea
					id="layout-key-import-text"
					bind:value={text}
					rows="6"
					spellcheck="false"
					aria-describedby="layout-key-import-hint"
					placeholder={exampleLayout}></textarea>
			</label>
			<p id="layout-key-import-hint" class="layout-key-import-hint">
				If a row has fewer keys than the editor, its remaining fields will be cleared.
			</p>
			{#if invalidText}
				<p class="layout-key-import-error" role="alert">
					Each key must be a single character separated from the next key by whitespace.
				</p>
			{/if}
		</div>

		<div class="layout-key-import-actions">
			<button type="button" class="filter-reset-button layout-key-import-button" onclick={onClose}>
				Cancel
			</button>
			<button
				type="submit"
				class="filter-reset-button layout-key-import-button layout-key-import-button--primary"
				disabled={!parsedRows}
			>
				Import
			</button>
		</div>
	</form>
</ModalShell>

<style>
	.layout-key-import-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem 1.25rem 1.25rem;
	}

	.layout-key-import-content > p {
		margin: 0;
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.layout-key-import-content label {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.layout-key-import-content textarea {
		width: 100%;
		min-height: 8rem;
		resize: vertical;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		outline: none;
		background-color: var(--input-bg);
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.875rem;
		font-weight: 400;
		line-height: 1.5;
	}

	.layout-key-import-content textarea:focus-visible {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
	}

	.layout-key-import-content .layout-key-import-hint {
		margin-top: -0.5rem;
		font-size: 0.8125rem;
	}

	.layout-key-import-content .layout-key-import-error {
		color: var(--keyboard-input-validation-error);
	}

	.layout-key-import-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--border);
	}

	.layout-key-import-button {
		min-width: 5rem;
		padding: 0.5rem 0.875rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
	}

	.layout-key-import-button--primary {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 18%, var(--bg-primary));
		color: var(--text-primary);
	}

	.layout-key-import-button--primary:hover:not(:disabled) {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 28%, var(--bg-primary));
		color: var(--accent);
	}

	.layout-key-import-button:disabled {
		cursor: not-allowed;
		opacity: 0.45;
	}
</style>
