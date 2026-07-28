<script lang="ts">
	import { inputProfileMappingsLabel, type LayoutInputProfile } from '$lib/layoutInputBehaviors';
	import type { AdaptiveSwapRule } from '$lib/adaptiveSwaps';
	import {
		adaptiveRuleMappingId,
		magicFallbackMappingId,
		magicRuleMappingId
	} from '$lib/inputMappingControls';

	interface Props {
		profile: LayoutInputProfile;
		disabledMappingIds?: readonly string[];
		onDisabledMappingIdsChange?: (ids: string[]) => void;
	}

	const { profile, disabledMappingIds = [], onDisabledMappingIdsChange }: Props = $props();
	const triggerGroups = $derived(Object.entries(profile.magicKeys?.triggers ?? {}));
	const label = $derived(inputProfileMappingsLabel(profile));
	const accessibleLabel = $derived(label.charAt(0).toUpperCase() + label.slice(1));
	const disabledIds = $derived(new Set(disabledMappingIds));

	const magicMappingIds = $derived.by(() =>
		triggerGroups.flatMap(([trigger, definition]) => [
			...definition.rules.map((rule) => magicRuleMappingId(trigger, rule.after)),
			...(definition.fallback === 'repeat-last' ? [magicFallbackMappingId(trigger)] : [])
		])
	);
	const baselineAdaptiveMappingIds = $derived(
		(profile.adaptiveSwaps?.rules ?? []).map((rule) => adaptiveRuleMappingId(undefined, rule))
	);
	const adaptiveGroupMappingIds = $derived(
		new Map(
			(profile.adaptiveSwaps?.groups ?? []).map((group) => [
				group.id,
				group.rules.map((rule) => adaptiveRuleMappingId(group.id, rule))
			])
		)
	);
	const adaptiveMappingIds = $derived([
		...baselineAdaptiveMappingIds,
		...Array.from(adaptiveGroupMappingIds.values()).flat()
	]);

	function allEnabled(ids: readonly string[]): boolean {
		return ids.length > 0 && ids.every((id) => !disabledIds.has(id));
	}

	function someEnabled(ids: readonly string[]): boolean {
		return ids.some((id) => !disabledIds.has(id));
	}

	function setMappingsEnabled(ids: readonly string[], enabled: boolean) {
		const retained = disabledMappingIds.filter((id) => !ids.includes(id));
		const next = enabled ? retained : [...retained, ...ids];
		onDisabledMappingIdsChange?.(next);
	}

	function setMappingEnabled(id: string, enabled: boolean) {
		setMappingsEnabled([id], enabled);
	}
</script>

{#snippet adaptiveRules(rules: readonly AdaptiveSwapRule[], groupId?: string)}
	<div
		class="adaptive-swap-mappings-list"
		class:adaptive-swap-mappings-list--grouped={groupId !== undefined}
	>
		{#each rules as rule (`${rule.trigger}:${rule.left}:${rule.right}`)}
			{@const mappingId = adaptiveRuleMappingId(groupId, rule)}
			<label class="mapping-row" class:mapping-row--disabled={disabledIds.has(mappingId)}>
				<input
					type="checkbox"
					checked={!disabledIds.has(mappingId)}
					onchange={(event) => setMappingEnabled(mappingId, event.currentTarget.checked)}
				/>
				<span class="adaptive-swap-mapping">
					<span class="mapping-trigger">{rule.trigger}</span>
					<span class="mapping-punctuation" aria-hidden="true">:</span>
					<span>{rule.left}</span>
					<span class="mapping-arrow" aria-hidden="true">↔</span>
					<span>{rule.right}</span>
				</span>
			</label>
		{/each}
	</div>
{/snippet}

<section class="input-mappings-panel" aria-label={accessibleLabel}>
	{#if profile.magicKeys}
		<label class="input-mappings-heading">
			<input
				type="checkbox"
				checked={allEnabled(magicMappingIds)}
				indeterminate={someEnabled(magicMappingIds) && !allEnabled(magicMappingIds)}
				onchange={(event) => setMappingsEnabled(magicMappingIds, event.currentTarget.checked)}
			/>
			<span>Magic key mappings</span>
		</label>
		<div class="magic-key-mappings-list">
			{#each triggerGroups as [trigger, definition] (trigger)}
				{#each definition.rules as rule (rule.after)}
					{@const mappingId = magicRuleMappingId(trigger, rule.after)}
					<label class="mapping-row" class:mapping-row--disabled={disabledIds.has(mappingId)}>
						<input
							type="checkbox"
							checked={!disabledIds.has(mappingId)}
							onchange={(event) => setMappingEnabled(mappingId, event.currentTarget.checked)}
						/>
						<span class="magic-key-mapping">
							<span>{rule.after}</span>
							<span class="mapping-trigger">{trigger}</span>
							<span class="mapping-arrow" aria-hidden="true">→</span>
							<span>{rule.after}{rule.emit}</span>
						</span>
					</label>
				{/each}
				{#if definition.fallback === 'repeat-last'}
					{@const mappingId = magicFallbackMappingId(trigger)}
					<label
						class="mapping-row mapping-row--full"
						class:mapping-row--disabled={disabledIds.has(mappingId)}
					>
						<input
							type="checkbox"
							checked={!disabledIds.has(mappingId)}
							onchange={(event) => setMappingEnabled(mappingId, event.currentTarget.checked)}
						/>
						<span class="magic-key-mapping magic-key-mapping--fallback">
							<span>otherwise</span>
							<span class="mapping-trigger">{trigger}</span>
							<span class="mapping-arrow" aria-hidden="true">→</span>
							<span>repeat previous</span>
						</span>
					</label>
				{/if}
			{/each}
		</div>
	{/if}

	{#if profile.adaptiveSwaps}
		<label
			class="input-mappings-heading"
			class:input-mappings-heading--separated={Boolean(profile.magicKeys)}
		>
			<input
				type="checkbox"
				checked={allEnabled(adaptiveMappingIds)}
				indeterminate={someEnabled(adaptiveMappingIds) && !allEnabled(adaptiveMappingIds)}
				onchange={(event) => setMappingsEnabled(adaptiveMappingIds, event.currentTarget.checked)}
			/>
			<span>Adaptive swap mappings</span>
		</label>
		{#if profile.adaptiveSwaps.rules.length > 0}
			{@render adaptiveRules(profile.adaptiveSwaps.rules)}
		{/if}
		{#each profile.adaptiveSwaps.groups as group (group.id)}
			{@const groupMappingIds = adaptiveGroupMappingIds.get(group.id) ?? []}
			<label class="input-mappings-group-heading">
				<input
					type="checkbox"
					checked={allEnabled(groupMappingIds)}
					indeterminate={someEnabled(groupMappingIds) && !allEnabled(groupMappingIds)}
					onchange={(event) => setMappingsEnabled(groupMappingIds, event.currentTarget.checked)}
				/>
				<span>{group.label}</span>
			</label>
			{@render adaptiveRules(group.rules, group.id)}
		{/each}
	{/if}
</section>

<style>
	.input-mappings-panel {
		min-height: 208px;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background-color: var(--bg-primary);
		overflow: auto;
	}

	.input-mappings-heading,
	.input-mappings-group-heading,
	.mapping-row {
		cursor: pointer;
	}

	.input-mappings-heading,
	.input-mappings-group-heading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-secondary);
		font-weight: 600;
	}

	.input-mappings-heading {
		margin-bottom: 0.625rem;
		font-size: 0.875rem;
		line-height: 1.25rem;
	}

	.input-mappings-heading--separated {
		margin-top: 0.875rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border);
	}

	.input-mappings-group-heading {
		margin: 0.75rem 0 0.3rem;
		color: var(--text-caption);
		font-size: 0.8125rem;
		line-height: 1.125rem;
	}

	input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		flex: 0 0 1rem;
		margin: 0;
		accent-color: var(--accent);
		cursor: pointer;
	}

	.magic-key-mappings-list,
	.adaptive-swap-mappings-list {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: 0.875rem;
		row-gap: 0.35rem;
	}

	.adaptive-swap-mappings-list--grouped {
		padding-inline-start: 1.5rem;
	}

	.mapping-row {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.5rem;
	}

	.mapping-row--full {
		grid-column: 1 / -1;
	}

	.mapping-row--disabled > span {
		opacity: 0.45;
	}

	.magic-key-mapping,
	.adaptive-swap-mapping {
		display: grid;
		flex: 1;
		align-items: baseline;
		min-width: 0;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.875rem;
		line-height: 1.5rem;
		white-space: nowrap;
	}

	.magic-key-mapping {
		grid-template-columns: minmax(1ch, auto) minmax(1ch, auto) 1rem minmax(2ch, 1fr);
	}

	.magic-key-mapping--fallback {
		color: var(--text-secondary);
	}

	.adaptive-swap-mapping {
		grid-template-columns: minmax(1ch, auto) 0.75rem minmax(1ch, auto) 1.25rem minmax(1ch, 1fr);
	}

	.mapping-trigger {
		color: var(--accent);
	}

	.mapping-arrow,
	.mapping-punctuation {
		color: var(--text-caption);
		text-align: center;
	}

	@media (max-width: 32rem) {
		.magic-key-mappings-list,
		.adaptive-swap-mappings-list {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
