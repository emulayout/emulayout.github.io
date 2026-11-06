<script lang="ts">
	import {
		KEYBOARD_TOPOLOGIES,
		type KeyboardTopologyId,
		type MissingKeyPolicy
	} from '$lib/keyboardTopology';
	import { untrack } from 'svelte';
	import { uiPrefs } from '$lib/uiPrefs.svelte';
	import KeyboardInputEditor from '$lib/components/KeyboardInputEditor.svelte';
	import TextAutocomplete from '$lib/components/TextAutocomplete.svelte';
	import ModalHeader from '$lib/components/ModalHeader.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import {
		KEYBOARD_INPUT_PRESETS,
		createKeyboardInputPreset,
		keyboardInputTopology,
		setKeyboardInputTopology,
		setKeyboardInputType,
		clearKeyboardInputConfig,
		cloneKeyboardInputConfig,
		createDefaultKeyboardInputConfig,
		createKeyboardInputConfigFromLayout,
		keyboardInputMissingAnsiValues,
		validateKeyboardInputConfig,
		type InputKeyboardType,
		type KeyboardInputConfig
	} from '$lib/keyboardInputConfig';
	import { geometryLabel } from '$lib/keyboardGeometry';
	import { layoutsCatalog } from '$lib/layoutsCatalog.svelte';

	interface Props {
		open: boolean;
		config: KeyboardInputConfig;
		onClose: () => void;
		onSave: (config: KeyboardInputConfig) => void;
	}

	let { open, config, onClose, onSave }: Props = $props();
	const hintsButtonLabel = $derived(uiPrefs.hintsEnabled ? 'Hide help hints' : 'Show help hints');
	const purposeHint =
		'Tell Emulayout which characters your physical keys send. This lets typing practice and layout test areas translate them correctly to the layout you are testing.';
	let draft = $state<KeyboardInputConfig>(createDefaultKeyboardInputConfig());
	const baseOptions = $derived([
		...new Set([
			...KEYBOARD_INPUT_PRESETS.map(baseLabel),
			...layoutsCatalog.layouts.map((layout) => layout.name)
		])
	]);
	const preferredBases = $derived(
		keyboardInputTopology(draft) === 'iso'
			? ['QWERTY UK (ISO)', 'QWERTY']
			: ['QWERTY', 'QWERTY UK (ISO)']
	);
	const validation = $derived(validateKeyboardInputConfig(draft));
	const validationError = $derived(validation.error);
	const missingAnsiValues = $derived(keyboardInputMissingAnsiValues(draft));

	$effect(() => {
		if (!open) return;
		const savedConfig = config;
		untrack(() => {
			draft = cloneKeyboardInputConfig(savedConfig);
			void layoutsCatalog.ensureLoaded();
		});
	});

	function baseLabel(name: string): string {
		return name === 'QWERTY UK' ? 'QWERTY UK (ISO)' : name;
	}

	function selectBaseLayout(name: string) {
		if (name === 'QWERTY UK (ISO)') name = 'QWERTY UK';
		if (name === 'QWERTY' || name === 'QWERTY UK') {
			draft = createKeyboardInputPreset(name, draft);
			return;
		}
		const layout = layoutsCatalog.layouts.find((candidate) => candidate.name === name);
		if (layout) {
			draft = createKeyboardInputConfigFromLayout(layout, draft.keyboardType, {
				topology: draft.topology ?? 'ansi',
				missingKeyPolicy: draft.missingKeyPolicy ?? 'preserve'
			});
		}
	}

	function setKeyboardType(keyboardType: InputKeyboardType) {
		draft = setKeyboardInputType(draft, keyboardType);
	}

	function resetDraft() {
		draft = createDefaultKeyboardInputConfig();
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
	panelClass="max-w-5xl max-h-[calc(100dvh-2rem)]"
	initialFocusSelector="#keyboard-input-base"
>
	<ModalHeader titleId="keyboard-input-config-title" title="Configure input layout" {onClose}>
		{#snippet actions()}
			<span class="mr-auto inline-flex">
				<Tooltip alwaysVisible text={purposeHint} />
			</span>
			<button
				type="button"
				onclick={() => uiPrefs.toggleHints()}
				class="flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
				style:color={uiPrefs.hintsEnabled ? 'var(--accent)' : 'var(--text-secondary)'}
				aria-label={hintsButtonLabel}
				aria-pressed={uiPrefs.hintsEnabled}
				title={hintsButtonLabel}
			>
				<svg
					class="size-5"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
					<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
					<path d="M12 17h.01" />
				</svg>
			</button>
		{/snippet}
	</ModalHeader>

	<form class="keyboard-input-config-form" onsubmit={submit}>
		<div class="keyboard-input-config-content">
			<div class="keyboard-input-config-fields">
				<label class="keyboard-input-config-field">
					<span>Keyboard geometry</span>
					<select
						value={draft.keyboardType}
						onchange={(event) => setKeyboardType(event.currentTarget.value as InputKeyboardType)}
					>
						<option value="ortho">{geometryLabel('column-stagger')}</option>
						<option value="staggered">{geometryLabel('row-stagger')}</option>
					</select>
				</label>
				{#if draft.keyboardType === 'staggered'}
					<div class="keyboard-input-config-field">
						<div class="flex items-center gap-1.5">
							<label for="keyboard-input-topology">Keyboard topology</label>
							<Tooltip
								text="Choose your physical keyboard: ANSI has a wide left Shift and a horizontal Enter key. ISO has a shorter left Shift, an extra key beside it (before Z on QWERTY), and a tall Enter key."
							/>
						</div>
						<select
							id="keyboard-input-topology"
							value={draft.topology ?? 'ansi'}
							onchange={(event) =>
								(draft = setKeyboardInputTopology(
									draft,
									event.currentTarget.value as KeyboardTopologyId
								))}
						>
							{#each Object.values(KEYBOARD_TOPOLOGIES).filter((topology) => topology.id !== 'ortho') as topology (topology.id)}
								<option value={topology.id}>{topology.label}</option>
							{/each}
						</select>
					</div>
					{#if (draft.topology ?? 'ansi') === 'ansi'}
						<div class="keyboard-input-config-field">
							<div class="flex items-center gap-1.5">
								<label for="keyboard-input-missing-key-policy">ISO layouts on ANSI hardware</label>
								<Tooltip
									text="Preserve positions keeps the ISO layout in place and disables its extra key, shown with a slash. Shift to fit moves the bottom row one key to the right, putting the extra ISO key on ANSI’s Z position. The rightmost key may no longer fit and is disabled instead."
								/>
							</div>
							<select
								id="keyboard-input-missing-key-policy"
								value={draft.missingKeyPolicy ?? 'preserve'}
								onchange={(event) =>
									(draft = {
										...draft,
										missingKeyPolicy: event.currentTarget.value as MissingKeyPolicy
									})}
							>
								<option value="preserve">Preserve positions</option>
								<option value="shift">Shift to fit</option>
							</select>
						</div>
					{/if}
				{/if}
			</div>
			<div class="keyboard-input-base-fields">
				<div class="keyboard-input-config-field">
					<span id="keyboard-input-base-label">Base layout (optional)</span>
					<TextAutocomplete
						options={baseOptions}
						preferredOptions={preferredBases}
						selectedFirst={false}
						kind="layout"
						emptyText="No layouts match."
						loadingText="Loading layouts…"
						clearLabel="Clear selected layout"
						showOptionsLabel="Show layout options"
						hideOptionsLabel="Hide layout options"
						id="keyboard-input-base"
						label="Base layout (optional)"
						placeholder="Search layouts…"
						selected={draft.baseLayoutName ? baseLabel(draft.baseLayoutName) : undefined}
						onSelect={selectBaseLayout}
						onClear={() => (draft = clearKeyboardInputConfig(draft))}
						loading={layoutsCatalog.loading && layoutsCatalog.layouts.length === 0}
					/>
					{#if layoutsCatalog.loadError && layoutsCatalog.layouts.length === 0}
						<p class="keyboard-input-config-error" role="alert">
							Unable to load the layout catalog.
						</p>
					{/if}
				</div>
			</div>

			<KeyboardInputEditor
				config={draft}
				invalidSlots={validation.invalidSlots}
				onConfigChange={(nextConfig) => (draft = nextConfig)}
			/>

			{#if draft.keyboardType === 'staggered' && missingAnsiValues.length > 0}
				<p class="keyboard-input-config-hint" data-keyboard-input-missing-ansi>
					<span>Potentially missing ANSI keys:</span>
					<span class="keyboard-input-config-hint__keys">
						{#each missingAnsiValues as value (value)}
							<kbd>{value}</kbd>
						{/each}
					</span>
				</p>
			{/if}

			{#if validationError}
				<p class="keyboard-input-config-error" role="alert">{validationError}</p>
			{/if}
		</div>

		<div class="keyboard-input-config-actions">
			<button
				type="button"
				class="filter-reset-button keyboard-input-config-button keyboard-input-config-button--destructive"
				onclick={resetDraft}
			>
				Reset
			</button>
			<div class="keyboard-input-config-actions__primary">
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
		grid-template-columns: none;
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, 1fr);
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

	.keyboard-input-config-error {
		margin: 0;
		color: var(--keyboard-input-validation-error);
		font-size: 0.875rem;
	}

	.keyboard-input-config-hint {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem 0.5rem;
		margin: 0;
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.keyboard-input-config-hint__keys {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.keyboard-input-config-hint kbd {
		display: inline-flex;
		min-width: 1.5rem;
		min-height: 1.5rem;
		align-items: center;
		justify-content: center;
		padding: 0.1rem 0.35rem;
		border: 1px solid var(--border);
		border-radius: 0.3rem;
		background: var(--bg-primary);
		color: var(--text-primary);
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: 0.8rem;
		line-height: 1;
	}

	.keyboard-input-config-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--border);
	}

	.keyboard-input-config-actions__primary {
		display: flex;
		align-items: center;
		gap: 0.5rem;
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

	.keyboard-input-config-button--destructive {
		border-color: color-mix(in srgb, var(--keyboard-input-reset-destructive) 60%, var(--border));
		background-color: color-mix(
			in srgb,
			var(--keyboard-input-reset-destructive) 8%,
			var(--bg-primary)
		);
		color: var(--keyboard-input-reset-destructive);
	}

	.keyboard-input-config-button--destructive:hover {
		border-color: var(--keyboard-input-reset-destructive);
		background-color: color-mix(
			in srgb,
			var(--keyboard-input-reset-destructive) 16%,
			var(--bg-primary)
		);
		color: var(--keyboard-input-reset-destructive);
	}

	.keyboard-input-config-button--destructive:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px
			color-mix(in srgb, var(--keyboard-input-reset-destructive) 35%, transparent);
	}

	.keyboard-input-config-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	@media (max-width: 40rem) {
		.keyboard-input-config-fields {
			grid-template-columns: 1fr;
			grid-auto-flow: row;
		}
	}
</style>
