<script lang="ts">
	import type { LayoutData } from '$lib/layout';
	import type { LayoutInputProfile } from '$lib/layoutInputBehaviors';
	import LayoutInputFeatureControl, {
		type LayoutInputFeatureState
	} from '$lib/components/LayoutInputFeatureControl.svelte';

	interface Props {
		layout: LayoutData;
		mappingsLabel: string;
		inputProfile?: LayoutInputProfile;
		active?: boolean;
		repeatKeyEnabled?: boolean;
		adaptiveMappingsEnabled?: boolean;
		magicMappingsEnabled?: boolean;
		onToggleRepeat?: () => void;
		onToggleMappings?: () => void;
	}

	const {
		layout,
		mappingsLabel,
		inputProfile,
		active = false,
		repeatKeyEnabled = true,
		adaptiveMappingsEnabled = true,
		magicMappingsEnabled = true,
		onToggleRepeat,
		onToggleMappings
	}: Props = $props();

	const hasAvailableMagicBehavior = $derived(Boolean(inputProfile?.magicKeys));
	const hasAvailableRepeatBehavior = $derived(Boolean(inputProfile?.repeatKey));
	const hasAvailableAdaptiveBehavior = $derived(Boolean(inputProfile?.adaptiveSwaps));
	const hasUnavailableMagicBehavior = $derived(
		!hasAvailableMagicBehavior &&
			(layout.hasMagicKey ||
				layout.hasMagicKeyMappings ||
				Object.prototype.hasOwnProperty.call(layout.keys, '*'))
	);
	const hasUnavailableAdaptiveBehavior = $derived(
		layout.hasAdaptiveSwap && !hasAvailableAdaptiveBehavior
	);
	const hasAnyIndicator = $derived(
		hasAvailableRepeatBehavior ||
			hasAvailableMagicBehavior ||
			hasAvailableAdaptiveBehavior ||
			hasUnavailableMagicBehavior ||
			hasUnavailableAdaptiveBehavior
	);
	const mappingsTitle = $derived(active ? `Close ${mappingsLabel}` : `Show ${mappingsLabel}`);
	const repeatTitle = $derived(repeatKeyEnabled ? 'Disable repeat key' : 'Enable repeat key');
	const adaptiveMappingsLabel = $derived(
		onToggleMappings
			? mappingsTitle
			: `Adaptive swap mappings ${adaptiveMappingsEnabled ? 'enabled' : 'disabled'}`
	);
	const magicMappingsLabel = $derived(
		onToggleMappings
			? mappingsTitle
			: `Magic key mappings ${magicMappingsEnabled ? 'enabled' : 'disabled'}`
	);
	const unavailableMagicLabel = $derived(
		Object.prototype.hasOwnProperty.call(layout.keys, '*')
			? 'Magic key "*" mappings unavailable'
			: 'Magic key mappings unavailable'
	);

	function mappingState(enabled: boolean): LayoutInputFeatureState {
		return enabled ? 'on' : 'off';
	}
</script>

{#if hasAnyIndicator}
	<div class="input-mappings-indicators">
		{#if hasAvailableRepeatBehavior}
			<LayoutInputFeatureControl
				feature="repeat"
				state={mappingState(repeatKeyEnabled)}
				label={repeatTitle}
				pressed={repeatKeyEnabled}
				onActivate={onToggleRepeat}
			/>
		{/if}

		{#if hasAvailableAdaptiveBehavior}
			<LayoutInputFeatureControl
				feature="adaptive"
				state={mappingState(adaptiveMappingsEnabled)}
				label={adaptiveMappingsLabel}
				pressed={active}
				highlighted={active}
				onActivate={onToggleMappings}
			/>
		{:else if hasUnavailableAdaptiveBehavior}
			<LayoutInputFeatureControl
				feature="adaptive"
				state="unavailable"
				label="Adaptive swap layout; mappings unavailable"
			/>
		{/if}

		{#if hasAvailableMagicBehavior}
			<LayoutInputFeatureControl
				feature="magic"
				state={mappingState(magicMappingsEnabled)}
				label={magicMappingsLabel}
				pressed={active}
				highlighted={active}
				onActivate={onToggleMappings}
			/>
		{:else if hasUnavailableMagicBehavior}
			<LayoutInputFeatureControl
				feature="magic"
				state="unavailable"
				label={unavailableMagicLabel}
			/>
		{/if}
	</div>
{/if}

<style>
	.input-mappings-indicators {
		display: inline-flex;
		flex-shrink: 0;
		flex-direction: column;
		align-items: center;
		gap: 0.125rem;
		padding-right: 0.25rem;
	}
</style>
