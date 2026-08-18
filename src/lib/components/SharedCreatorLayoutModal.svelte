<script lang="ts">
	import ModalHeader from '$lib/components/ModalHeader.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import LayoutKeyboardWorkspace from '$lib/components/LayoutKeyboardWorkspace.svelte';
	import { computeDisplayRows } from '$lib/layoutDisplay';
	import { LAYOUT_CREATOR_NEW_LAYOUT_NAME, createLayoutFromKeyConfig } from '$lib/layoutCreator';
	import { compileCreatorInputProfile } from '$lib/layoutCreatorMappings';
	import { createDefaultCreatorUrlSnapshot, type CreatorUrlSnapshot } from '$lib/layoutCreatorUrl';

	interface Props {
		open: boolean;
		snapshot: CreatorUrlSnapshot | null;
		saveError?: string | null;
		onClose: () => void;
		onSave: (name: string) => void;
	}

	let { open, snapshot, saveError = null, onClose, onSave }: Props = $props();
	let layoutName = $state('');
	let nameInput = $state<HTMLInputElement | undefined>(undefined);

	const shared = $derived(snapshot ?? createDefaultCreatorUrlSnapshot());
	const trimmedName = $derived(layoutName.trim());
	const canSave = $derived(trimmedName.length > 0);
	const previewName = $derived(trimmedName || LAYOUT_CREATOR_NEW_LAYOUT_NAME);
	const layout = $derived(
		createLayoutFromKeyConfig(shared.keyConfig, {
			name: previewName,
			magicKey: shared.includeMagicKey,
			adaptiveKey: shared.includeAdaptiveKey
		})
	);
	const rows = $derived(computeDisplayRows(layout));
	const inputProfile = $derived(
		compileCreatorInputProfile(
			shared.includeMagicKey,
			shared.magicDraft,
			shared.includeAdaptiveKey,
			shared.adaptiveDraft,
			Object.keys(layout.keys)
		)
	);

	$effect(() => {
		if (!open || !snapshot) return;
		layoutName = snapshot.name;
		requestAnimationFrame(() => {
			nameInput?.focus();
			nameInput?.select();
		});
	});

	function handleSave() {
		if (!canSave) return;
		onSave(trimmedName);
	}

	function handleNameKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		handleSave();
	}
</script>

<ModalShell
	{open}
	{onClose}
	labelledBy="shared-creator-layout-title"
	panelClass="max-h-[calc(100dvh-2rem)] max-w-5xl"
	initialFocusSelector="#shared-creator-layout-name"
>
	<ModalHeader titleId="shared-creator-layout-title" title="Shared layout" {onClose} />

	<div class="shared-creator-layout-content">
		<div class="shared-creator-layout-fields">
			<label class="shared-creator-layout-field" for="shared-creator-layout-name">
				<span>Layout name</span>
				<input
					bind:this={nameInput}
					id="shared-creator-layout-name"
					type="text"
					bind:value={layoutName}
					onkeydown={handleNameKeydown}
				/>
			</label>
			<div class="shared-creator-layout-field">
				<span>Author</span>
				<p>{shared.author || 'Not specified'}</p>
			</div>
		</div>

		<section class="shared-creator-layout-preview" aria-labelledby="shared-layout-keys-heading">
			<h3 id="shared-layout-keys-heading">Layout keys</h3>
			<LayoutKeyboardWorkspace
				{layout}
				{rows}
				{inputProfile}
				disabledMappingIds={shared.disabledMappingIds}
				showMappings={Boolean(inputProfile)}
				readOnlyMappings
			/>
			{#if !inputProfile}
				<p class="shared-creator-layout-empty-mappings">No complete Magic or Adaptive mappings.</p>
			{/if}
		</section>

		{#if saveError}
			<p class="shared-creator-layout-error" role="alert">{saveError}</p>
		{/if}
	</div>

	<div class="shared-creator-layout-actions">
		<button
			type="button"
			class="filter-reset-button shared-creator-layout-button"
			onclick={onClose}
		>
			Cancel
		</button>
		<button
			type="button"
			class="filter-reset-button shared-creator-layout-button shared-creator-layout-button--primary"
			disabled={!canSave}
			onclick={handleSave}
		>
			Save layout
		</button>
	</div>
</ModalShell>

<style>
	.shared-creator-layout-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-height: 0;
		padding: 1rem 1.25rem;
		overflow-y: auto;
	}

	.shared-creator-layout-fields {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
	}

	.shared-creator-layout-field {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		min-width: 0;
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.shared-creator-layout-field input,
	.shared-creator-layout-field p {
		box-sizing: border-box;
		width: 100%;
		min-height: 2.5rem;
		margin: 0;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		background: var(--input-bg);
		color: var(--text-primary);
		font-size: 0.875rem;
		line-height: 1.5rem;
	}

	.shared-creator-layout-field input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.shared-creator-layout-preview {
		min-width: 0;
	}

	.shared-creator-layout-preview h3 {
		margin: 0 0 0.625rem;
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.shared-creator-layout-empty-mappings {
		margin: 0.75rem 0 0;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		color: var(--text-secondary);
		font-size: 0.875rem;
	}

	.shared-creator-layout-error {
		margin: 0;
		color: var(--keyboard-input-validation-error);
		font-size: 0.875rem;
	}

	.shared-creator-layout-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		padding: 1rem 1.25rem;
		border-top: 1px solid var(--border);
	}

	.shared-creator-layout-button {
		min-height: 2.5rem;
		padding: 0.5rem 0.875rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
	}

	.shared-creator-layout-button--primary {
		border-color: var(--accent);
		background: var(--accent);
		color: var(--accent-contrast, white);
	}

	.shared-creator-layout-button--primary:disabled {
		opacity: 0.5;
	}

	@media (max-width: 640px) {
		.shared-creator-layout-fields {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
