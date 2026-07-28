<script lang="ts">
	import type { MagicKeyProfile } from '$lib/magicKeys';

	interface Props {
		profile: MagicKeyProfile;
	}

	const { profile }: Props = $props();
	const triggerGroups = $derived(Object.entries(profile.triggers));
</script>

<section class="magic-key-mappings-panel" aria-label="Magic key mappings">
	<div class="magic-key-mappings-heading">Magic key mappings</div>
	<div class="magic-key-mappings-list">
		{#each triggerGroups as [trigger, rules] (trigger)}
			{#each rules as rule (rule.after)}
				<div class="magic-key-mapping">
					<span>{rule.after}</span>
					<span class="magic-key-trigger">{trigger}</span>
					<span class="magic-key-arrow" aria-hidden="true">→</span>
					<span>{rule.after}{rule.emit}</span>
				</div>
			{/each}
		{/each}
	</div>
</section>

<style>
	.magic-key-mappings-panel {
		min-height: 208px;
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background-color: var(--bg-primary);
		overflow: auto;
	}

	.magic-key-mappings-heading {
		margin-bottom: 0.5rem;
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1rem;
	}

	.magic-key-mappings-list {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		column-gap: 0.75rem;
		row-gap: 0.25rem;
	}

	.magic-key-mapping {
		display: grid;
		grid-template-columns: minmax(1ch, auto) minmax(1ch, auto) 1rem minmax(2ch, 1fr);
		align-items: baseline;
		min-width: 0;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		line-height: 1.25rem;
		white-space: nowrap;
	}

	.magic-key-trigger {
		color: var(--accent);
	}

	.magic-key-arrow {
		color: var(--text-caption);
		text-align: center;
	}
</style>
