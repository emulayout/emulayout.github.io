<script lang="ts">
	import { inputProfileMappingsLabel, type LayoutInputProfile } from '$lib/layoutInputBehaviors';
	import type { AdaptiveSwapRule } from '$lib/adaptiveSwaps';

	interface Props {
		profile: LayoutInputProfile;
	}

	const { profile }: Props = $props();
	const triggerGroups = $derived(Object.entries(profile.magicKeys?.triggers ?? {}));
	const label = $derived(inputProfileMappingsLabel(profile));
	const accessibleLabel = $derived(label.charAt(0).toUpperCase() + label.slice(1));
</script>

{#snippet adaptiveRules(rules: readonly AdaptiveSwapRule[])}
	<div class="adaptive-swap-mappings-list">
		{#each rules as rule (`${rule.trigger}:${rule.left}:${rule.right}`)}
			<div class="adaptive-swap-mapping">
				<span class="mapping-trigger">{rule.trigger}</span>
				<span class="mapping-punctuation" aria-hidden="true">:</span>
				<span>{rule.left}</span>
				<span class="mapping-arrow" aria-hidden="true">↔</span>
				<span>{rule.right}</span>
			</div>
		{/each}
	</div>
{/snippet}

<section class="input-mappings-panel" aria-label={accessibleLabel}>
	{#if profile.magicKeys}
		<div class="input-mappings-heading">Magic key mappings</div>
		<div class="magic-key-mappings-list">
			{#each triggerGroups as [trigger, definition] (trigger)}
				{#each definition.rules as rule (rule.after)}
					<div class="magic-key-mapping">
						<span>{rule.after}</span>
						<span class="mapping-trigger">{trigger}</span>
						<span class="mapping-arrow" aria-hidden="true">→</span>
						<span>{rule.after}{rule.emit}</span>
					</div>
				{/each}
				{#if definition.fallback === 'repeat-last'}
					<div class="magic-key-mapping magic-key-mapping--fallback">
						<span>otherwise</span>
						<span class="mapping-trigger">{trigger}</span>
						<span class="mapping-arrow" aria-hidden="true">→</span>
						<span>repeat previous</span>
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	{#if profile.adaptiveSwaps}
		<div
			class="input-mappings-heading"
			class:input-mappings-heading--separated={Boolean(profile.magicKeys)}
		>
			Adaptive swap mappings
		</div>
		{#if profile.adaptiveSwaps.rules.length > 0}
			{@render adaptiveRules(profile.adaptiveSwaps.rules)}
		{/if}
		{#each profile.adaptiveSwaps.groups as group (group.id)}
			<div class="input-mappings-group-heading">{group.label}</div>
			{@render adaptiveRules(group.rules)}
		{/each}
	{/if}
</section>

<style>
	.input-mappings-panel {
		min-height: 208px;
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background-color: var(--bg-primary);
		overflow: auto;
	}

	.input-mappings-heading {
		margin-bottom: 0.5rem;
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1rem;
	}

	.input-mappings-heading--separated {
		margin-top: 0.75rem;
		padding-top: 0.625rem;
		border-top: 1px solid var(--border);
	}

	.input-mappings-group-heading {
		margin: 0.55rem 0 0.2rem;
		color: var(--text-caption);
		font-size: 0.6875rem;
		font-weight: 600;
		line-height: 1rem;
	}

	.magic-key-mappings-list,
	.adaptive-swap-mappings-list {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: 0.75rem;
		row-gap: 0.25rem;
	}

	.magic-key-mapping,
	.adaptive-swap-mapping {
		display: grid;
		align-items: baseline;
		min-width: 0;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		line-height: 1.25rem;
		white-space: nowrap;
	}

	.magic-key-mapping {
		grid-template-columns: minmax(1ch, auto) minmax(1ch, auto) 1rem minmax(2ch, 1fr);
	}

	.magic-key-mapping--fallback {
		grid-column: 1 / -1;
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

	@media (max-width: 28rem) {
		.magic-key-mappings-list,
		.adaptive-swap-mappings-list {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
