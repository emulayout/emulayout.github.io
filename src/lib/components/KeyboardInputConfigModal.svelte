<script lang="ts">
	import { untrack } from 'svelte';
	import KeyboardInputEditor from '$lib/components/KeyboardInputEditor.svelte';
	import LayoutAutocomplete from '$lib/components/LayoutAutocomplete.svelte';
	import ModalHeader from '$lib/components/ModalHeader.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import {
		clearKeyboardInputConfig,
		cloneKeyboardInputConfig,
		createDefaultKeyboardInputConfig,
		createKeyboardInputConfigFromLayout,
		keyboardInputConfigError,
		type InputKeyboardType,
		type KeyboardInputConfig
	} from '$lib/keyboardInputConfig';
	import { layoutsCatalog } from '$lib/layoutsCatalog.svelte';

	interface Props {
		open: boolean;
		config: KeyboardInputConfig;
		onClose: () => void;
		onSave: (config: KeyboardInputConfig) => void;
	}

	let { open, config, onClose, onSave }: Props = $props();
	let draft = $state<KeyboardInputConfig>(createDefaultKeyboardInputConfig());
	const validationError = $derived(keyboardInputConfigError(draft));

	$effect(() => {
		if (!open) return;
		const savedConfig = config;
		untrack(() => {
			draft = cloneKeyboardInputConfig(savedConfig);
			void layoutsCatalog.ensureLoaded();
		});
	});

	function selectBaseLayout(name: string) {
		const layout = layoutsCatalog.layouts.find((candidate) => candidate.name === name);
		if (layout) draft = createKeyboardInputConfigFromLayout(layout);
	}

	function setKeyboardType(keyboardType: InputKeyboardType) {
		draft = { ...draft, keyboardType };
	}

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (validationError) return;
		onSave(draft);
	}
</script>

<ModalShell
	{open}
	{onClose}
	labelledBy="keyboard-input-config-title"
	panelClass="max-w-5xl max-h-[calc(100vh-2rem)]"
	initialFocusSelector="#keyboard-input-base"
>
	<ModalHeader titleId="keyboard-input-config-title" title="Configure input layout" {onClose} />

	<form class="keyboard-input-config-form" onsubmit={submit}>
		<div class="keyboard-input-config-content">
			<div class="keyboard-input-config-fields">
				<div class="keyboard-input-config-field">
					<span id="keyboard-input-base-label">Base layout (optional)</span>
					<LayoutAutocomplete
						layouts={layoutsCatalog.layouts}
						id="keyboard-input-base"
						label="Base layout (optional)"
						placeholder="Search layouts…"
						selected={draft.baseLayoutName}
						onSelect={selectBaseLayout}
						onClear={() => (draft = clearKeyboardInputConfig(draft))}
					/>
					{#if layoutsCatalog.loading && layoutsCatalog.layouts.length === 0}
						<p class="keyboard-input-config-status" aria-live="polite">Loading layouts…</p>
					{/if}
					{#if layoutsCatalog.loadError && layoutsCatalog.layouts.length === 0}
						<p class="keyboard-input-config-error" role="alert">
							Unable to load the layout catalog.
						</p>
					{/if}
				</div>

				<label class="keyboard-input-config-field">
					<span>Keyboard type</span>
					<select
						value={draft.keyboardType}
						onchange={(event) => setKeyboardType(event.currentTarget.value as InputKeyboardType)}
					>
						<option value="ortho">Ortho</option>
						<option value="staggered">Staggered</option>
					</select>
				</label>
			</div>

			<KeyboardInputEditor config={draft} onConfigChange={(nextConfig) => (draft = nextConfig)} />

			{#if validationError}
				<p class="keyboard-input-config-error" role="alert">{validationError}</p>
			{/if}
		</div>

		<div class="keyboard-input-config-actions">
			<button
				type="button"
				class="filter-reset-button keyboard-input-config-button"
				onclick={onClose}
			>
				Cancel
			</button>
			<button
				type="submit"
				class="filter-reset-button keyboard-input-config-button keyboard-input-config-button--primary"
				disabled={Boolean(validationError)}
			>
				Save
			</button>
		</div>
	</form>
</ModalShell>

<style>
	.keyboard-input-config-form {
		display: flex;
		min-height: 0;
		flex: 1;
		flex-direction: column;
	}

	.keyboard-input-config-content {
		display: flex;
		min-height: 0;
		flex: 1;
		flex-direction: column;
		gap: 1.5rem;
		overflow-y: auto;
		padding: 1.25rem;
	}

	.keyboard-input-config-fields {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(10rem, 0.45fr);
		gap: 1rem;
		align-items: start;
	}

	.keyboard-input-config-field {
		display: flex;
		min-width: 0;
		flex-direction: column;
		gap: 0.375rem;
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.keyboard-input-config-field select {
		width: 100%;
		height: 2.375rem;
		padding: 0 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		outline: none;
		background-color: var(--input-bg);
		color: var(--text-primary);
		font-size: 0.875rem;
		font-weight: 400;
	}

	.keyboard-input-config-field select:focus-visible {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
	}

	.keyboard-input-config-field select {
		cursor: pointer;
	}

	.keyboard-input-config-status {
		margin: 0;
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-weight: 400;
	}

	.keyboard-input-config-error {
		margin: 0;
		color: var(--typing-practice-incorrect);
		font-size: 0.875rem;
	}

	.keyboard-input-config-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--border);
	}

	.keyboard-input-config-button {
		min-width: 5rem;
		padding: 0.5rem 0.875rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
	}

	.keyboard-input-config-button--primary {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 18%, var(--bg-primary));
		color: var(--text-primary);
	}

	.keyboard-input-config-button--primary:hover:not(:disabled) {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 28%, var(--bg-primary));
		color: var(--accent);
	}

	.keyboard-input-config-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	@media (max-width: 40rem) {
		.keyboard-input-config-fields {
			grid-template-columns: 1fr;
		}
	}
</style>
