<script lang="ts">
	import Tooltip from '$lib/components/Tooltip.svelte';
	import { chiralMappingId, chiralCharacterLabel } from '$lib/chiralKeys';
	import {
		createCreatorChiralRule,
		creatorChiralRuleError,
		type CreatorChiralDraft,
		type CreatorChiralRule,
		type ChiralOutputKind
	} from '$lib/creatorChiralMappings';
	interface Props {
		draft: CreatorChiralDraft;
		availableKeys: readonly string[];
		magicTriggers?: readonly string[];
		disabledMappingIds: readonly string[];
		onDraftChange: (draft: CreatorChiralDraft) => void;
		onDisabledMappingIdsChange: (ids: string[]) => void;
	}
	const {
		draft,
		availableKeys,
		magicTriggers = [],
		disabledMappingIds,
		onDraftChange,
		onDisabledMappingIdsChange
	}: Props = $props();
	function update(id: string, change: Partial<CreatorChiralRule>) {
		onDraftChange({
			rules: draft.rules.map((rule) => (rule.id === id ? { ...rule, ...change } : rule))
		});
	}
</script>

<section class="chiral-editor" aria-label="Chiral mappings">
	<div class="chiral-heading">
		<h3>Chiral mappings</h3>
		<Tooltip
			text="Chiral keys choose an output based on whether the previous character is assigned to the same hand as the trigger or the opposite hand. Each side can emit a character, repeat the previous character, or type the trigger normally. Press Space to use a literal space in a trigger, output, or exception field. Space triggers need a Space assigned on the keyboard to establish their hand. Exceptions, no previous character, and unknown hand assignments type the trigger normally."
		/>
	</div>
	{#each draft.rules as rule (rule.id)}
		{@const error = creatorChiralRuleError(rule, availableKeys)}
		<fieldset>
			<legend>Chiral key {chiralCharacterLabel(rule.key) || '—'}</legend>
			<div class="chiral-top-row">
				<label class="enabled"
					><input
						type="checkbox"
						aria-label={`Enable chiral key ${chiralCharacterLabel(rule.key) || 'mapping'}`}
						checked={!disabledMappingIds.includes(chiralMappingId(rule.key))}
						onchange={(event) => {
							const id = chiralMappingId(rule.key);
							onDisabledMappingIdsChange(
								event.currentTarget.checked
									? disabledMappingIds.filter((value) => value !== id)
									: [...disabledMappingIds.filter((value) => value !== id), id]
							);
						}}
					/> Enabled</label
				>
				<button
					type="button"
					class="chiral-text-button"
					aria-label={`Remove chiral key ${chiralCharacterLabel(rule.key) || 'mapping'}`}
					onclick={() =>
						onDraftChange({ rules: draft.rules.filter((value) => value.id !== rule.id) })}
					>Remove</button
				>
			</div>
			<label
				>Trigger key<input
					value={rule.key}
					oninput={(event) => update(rule.id, { key: event.currentTarget.value })}
				/></label
			>
			{#if rule.key === ' '}<small>Trigger: Space</small>{/if}
			{#each ['same', 'opposite'] as const as side (side)}
				<div class="chiral-output-row">
					<label
						>{side === 'same' ? 'Same hand' : 'Opposite hand'}<select
							value={rule[`${side}Kind`]}
							onchange={(event) =>
								update(rule.id, { [`${side}Kind`]: event.currentTarget.value as ChiralOutputKind })}
						>
							<option value="key">Type trigger key</option><option value="repeat"
								>Repeat previous</option
							><option value="char">Emit character</option>
						</select></label
					>
					{#if rule[`${side}Kind`] === 'char'}
						<label class="chiral-output-character"
							><span class="sr-only"
								>{side === 'same' ? 'Same-hand output' : 'Opposite-hand output'}</span
							><input
								value={rule[`${side}Char`]}
								oninput={(event) => update(rule.id, { [`${side}Char`]: event.currentTarget.value })}
							/></label
						>
						{#if rule[`${side}Char`] === ' '}<small>Space</small>{/if}
					{/if}
				</div>
			{/each}
			<label
				>Exceptions<input
					value={rule.except}
					placeholder="e.g. qm"
					oninput={(event) => update(rule.id, { except: event.currentTarget.value })}
				/></label
			>
			{#if rule.except.includes(' ')}<small>Exceptions include Space</small>{/if}
			{#if error}<p role="status">{error}</p>{/if}
			{#if draft.rules.find((other) => other.key === rule.key)?.id !== rule.id}<p role="status">
					This trigger already has a chiral mapping; only the first applies.
				</p>{/if}
			{#if magicTriggers.includes(rule.key)}<p role="status">
					Magic mappings for this trigger take precedence over its chiral behavior.
				</p>{/if}
		</fieldset>
	{/each}
	<button
		type="button"
		class="chiral-text-button"
		onclick={() => onDraftChange({ rules: [...draft.rules, createCreatorChiralRule()] })}
		>Add chiral key</button
	>
</section>

<style>
	.chiral-editor {
		min-width: 0;
		width: 100%;
		max-width: 24rem;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background-color: var(--bg-primary);
	}
	.chiral-heading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.625rem;
	}
	h3 {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--text-secondary);
	}
	p {
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin: 0.5rem 0;
		line-height: 1.5;
		overflow-wrap: anywhere;
	}
	fieldset {
		min-width: 0;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		padding: 0.625rem;
		margin: 0.75rem 0;
	}
	legend {
		font-size: 0.8125rem;
		color: var(--text-primary);
		padding: 0 0.25rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: var(--text-secondary);
		margin-bottom: 0.5rem;
	}
	input[type='checkbox'] {
		appearance: none;
		-webkit-appearance: none;
		box-sizing: border-box;
		width: 1rem;
		height: 1rem;
		flex: 0 0 1rem;
		margin: 0;
		border: 1px solid var(--border);
		border-radius: 0.2rem;
		background-color: var(--bg-primary);
		background-position: center;
		background-repeat: no-repeat;
		background-size: 0.7rem 0.7rem;
		cursor: pointer;
	}

	input[type='checkbox']:checked,
	input[type='checkbox']:indeterminate {
		background-color: var(--chiral-key);
		border-color: var(--chiral-key);
	}

	input[type='checkbox']:checked {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%23f4f4f4' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round' d='M3.5 8.5 6.5 11.5 12.5 4.5'/%3E%3C/svg%3E");
	}
	:global(.dark) input[type='checkbox']:checked {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%23100f0d' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round' d='M3.5 8.5 6.5 11.5 12.5 4.5'/%3E%3C/svg%3E");
	}
	input:not([type='checkbox']),
	select {
		width: 100%;
		min-width: 0;
		height: 1.75rem;
		padding: 0 0.35rem;
		border: 1px solid var(--border);
		border-radius: 0.375rem;
		background-color: var(--input-bg);
		color: var(--text-primary);
		font: inherit;
	}
	input:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
	.chiral-top-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.enabled {
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
		margin: 0;
	}
	.chiral-output-row {
		display: flex;
		align-items: flex-end;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}
	.chiral-output-row > label {
		flex: 1;
		min-width: 0;
		margin-bottom: 0;
	}
	.chiral-output-row > .chiral-output-character {
		flex: 0 0 2.5rem;
	}
	.chiral-output-character input {
		text-align: center;
	}
	select {
		cursor: pointer;
	}
	p[role='status'] {
		color: var(--keyboard-input-validation-error);
	}
	.chiral-text-button {
		margin: 0;
		padding: 0.15rem 0;
		border: 0;
		background: transparent;
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-weight: 600;
		cursor: pointer;
	}
	.chiral-text-button:hover {
		color: var(--text-primary);
	}
	.chiral-text-button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
</style>
