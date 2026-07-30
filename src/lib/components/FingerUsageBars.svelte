<script lang="ts" module>
	export const FINGER_USAGE_BARS_HEIGHT = 103;

	export type FingerUsageBarKey =
		| 'LP'
		| 'LR'
		| 'LM'
		| 'LI'
		| 'LT'
		| 'RT'
		| 'RI'
		| 'RM'
		| 'RR'
		| 'RP';
	export type FingerUsageBarValues = Partial<Record<FingerUsageBarKey, number>>;
</script>

<script lang="ts">
	import HoverPopup from '$lib/components/HoverPopup.svelte';
	import { formatStatPercent } from '$lib/statsBlockFormatting';
	import type { StatsAnalyzer } from '$lib/statsAnalyzers';

	interface Props {
		/** Finger usage as 0–1 fractions. */
		usage: FingerUsageBarValues;
		/** Optional analyzer-provided hand totals. Defaults to the sum of the supplied fingers. */
		leftTotal?: number;
		rightTotal?: number;
		/** Usage represented by a full-height bar. Keeping this fixed makes cards comparable. */
		scaleMax?: number;
		label?: string;
		tone?: StatsAnalyzer;
		/** Fit two charts side by side within a layout card. */
		compact?: boolean;
		/** Show the accessible label as a visible chart caption. */
		showLabel?: boolean;
		/** Optional value shown directly below the visible chart caption. */
		labelDetail?: string;
		/** Format bar tooltips as normalized raw values rather than percentages. */
		valueUnit?: 'percent' | 'raw';
		height?: number;
	}

	const {
		usage,
		leftTotal,
		rightTotal,
		scaleMax = 0.25,
		label = 'Finger usage',
		tone,
		compact = false,
		showLabel = false,
		labelDetail,
		valueUnit = 'percent',
		height = FINGER_USAGE_BARS_HEIGHT
	}: Props = $props();

	let tipOpen = $state(false);
	let tipAnchor = $state<HTMLElement | undefined>(undefined);
	let tipText = $state('');

	const leftFingers = [
		{ key: 'LP', positionLabel: '1', name: 'Left pinky', thumb: false },
		{ key: 'LR', positionLabel: '2', name: 'Left ring', thumb: false },
		{ key: 'LM', positionLabel: '3', name: 'Left middle', thumb: false },
		{ key: 'LI', positionLabel: '4', name: 'Left index', thumb: false },
		{ key: 'LT', positionLabel: '5', name: 'Left thumb', thumb: true }
	] as const;

	const rightFingers = [
		{ key: 'RT', positionLabel: '6', name: 'Right thumb', thumb: true },
		{ key: 'RI', positionLabel: '7', name: 'Right index', thumb: false },
		{ key: 'RM', positionLabel: '8', name: 'Right middle', thumb: false },
		{ key: 'RR', positionLabel: '9', name: 'Right ring', thumb: false },
		{ key: 'RP', positionLabel: '10', name: 'Right pinky', thumb: false }
	] as const;

	function finiteNonNegative(value: number | undefined): number {
		return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
	}

	const safeScaleMax = $derived(Math.max(0.001, finiteNonNegative(scaleMax)));

	function formatBarValue(value: number): string {
		return valueUnit === 'raw' ? value.toFixed(1) : formatStatPercent(value);
	}

	function buildBars(fingers: typeof leftFingers | typeof rightFingers) {
		return fingers.map((finger) => {
			const value = finiteNonNegative(usage[finger.key]);
			return {
				...finger,
				value,
				visible: !finger.thumb || value > 0,
				height: Math.min(100, (value / safeScaleMax) * 100),
				tip: formatBarValue(value)
			};
		});
	}

	const leftBars = $derived(buildBars(leftFingers));
	const rightBars = $derived(buildBars(rightFingers));
	const displayedLeftTotal = $derived(
		leftTotal === undefined
			? leftBars.reduce((total, finger) => total + finger.value, 0)
			: finiteNonNegative(leftTotal)
	);
	const displayedRightTotal = $derived(
		rightTotal === undefined
			? rightBars.reduce((total, finger) => total + finger.value, 0)
			: finiteNonNegative(rightTotal)
	);

	function showTip(event: Event, text: string) {
		tipAnchor = event.currentTarget as HTMLElement;
		tipText = text;
		tipOpen = true;
	}

	function hideTip() {
		tipOpen = false;
	}
</script>

<figure
	class="finger-usage-bars"
	class:finger-usage-bars--cmini={tone === 'cmini'}
	class:finger-usage-bars--cyanophage={tone === 'cyanophage'}
	class:finger-usage-bars--mana2={tone === 'mana2'}
	class:finger-usage-bars--compact={compact}
	class:finger-usage-bars--with-label={showLabel}
	aria-label={label}
	style={`--finger-usage-height: ${height}px`}
>
	{#if showLabel}
		<figcaption>
			<span>{label}</span>
			{#if labelDetail !== undefined}
				<span class="label-detail">{labelDetail}</span>
			{/if}
		</figcaption>
	{/if}

	<div class="hands">
		<div class="hand-bars">
			{#each leftBars as finger (finger.key)}
				<div class="bar-column">
					{#if finger.visible}
						<button
							type="button"
							class="bar"
							aria-label={`${finger.name}: ${finger.tip}`}
							style={`--bar-height: ${finger.height}%`}
							onmouseenter={(event) => showTip(event, finger.tip)}
							onmouseleave={hideTip}
							onfocus={(event) => showTip(event, finger.tip)}
							onblur={hideTip}
						></button>
					{/if}
				</div>
			{/each}
		</div>

		<div class="hand-bars">
			{#each rightBars as finger (finger.key)}
				<div class="bar-column">
					{#if finger.visible}
						<button
							type="button"
							class="bar"
							aria-label={`${finger.name}: ${finger.tip}`}
							style={`--bar-height: ${finger.height}%`}
							onmouseenter={(event) => showTip(event, finger.tip)}
							onmouseleave={hideTip}
							onfocus={(event) => showTip(event, finger.tip)}
							onblur={hideTip}
						></button>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<div class="hands finger-labels" aria-hidden="true">
		<div class="hand-label-row">
			{#each leftBars as finger (finger.key)}
				<span>{finger.visible ? finger.positionLabel : ''}</span>
			{/each}
		</div>
		<div class="hand-label-row">
			{#each rightBars as finger (finger.key)}
				<span>{finger.visible ? finger.positionLabel : ''}</span>
			{/each}
		</div>
	</div>

	<div class="hand-totals">
		<span class="hand-total-left">{formatStatPercent(displayedLeftTotal)}</span>
		<span class="hand-total-right">{formatStatPercent(displayedRightTotal)}</span>
	</div>
</figure>

<HoverPopup
	open={tipOpen}
	anchor={tipAnchor}
	text={tipText}
	size="compact"
	placement="above"
	mono
/>

<style>
	.finger-usage-bars {
		--finger-usage-bar-color: var(--stats-fg-highlight);
		--finger-usage-bar-width: 14px;
		--finger-usage-bar-gap: 6px;
		--finger-usage-hand-width: 94px;
		--finger-usage-hand-gap: 28px;
		box-sizing: border-box;
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto auto;
		gap: 2px;
		width: min(100%, 216px);
		height: var(--finger-usage-height);
		max-height: var(--finger-usage-height);
		min-width: 0;
		margin: 0 auto;
		overflow: visible;
		color: var(--stats-fg);
		font-family: var(--font-mono);
		font-size: 10px;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}

	.finger-usage-bars--with-label {
		grid-template-rows: auto minmax(0, 1fr) auto auto;
	}

	.finger-usage-bars--compact {
		--finger-usage-bar-width: 9px;
		--finger-usage-bar-gap: 3px;
		--finger-usage-hand-width: 57px;
		--finger-usage-hand-gap: 10px;
		width: min(100%, 124px);
		font-size: 9px;
	}

	figcaption {
		display: grid;
		gap: 1px;
		overflow: hidden;
		color: var(--text-secondary);
		font-size: 10px;
		line-height: 1.1;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.label-detail {
		color: var(--stats-fg);
		font-variant-numeric: tabular-nums;
	}

	.finger-usage-bars--cmini {
		--finger-usage-bar-color: var(--analyzer-cmini);
	}

	.finger-usage-bars--cyanophage {
		--finger-usage-bar-color: var(--analyzer-cyanophage);
	}

	.finger-usage-bars--mana2 {
		--finger-usage-bar-color: var(--analyzer-mana2);
	}

	.hands {
		display: grid;
		grid-template-columns: repeat(2, var(--finger-usage-hand-width));
		justify-content: center;
		gap: var(--finger-usage-hand-gap);
		min-height: 0;
	}

	.hand-bars,
	.hand-label-row {
		display: grid;
		grid-template-columns: repeat(5, var(--finger-usage-bar-width));
		gap: var(--finger-usage-bar-gap);
	}

	.hand-bars {
		align-items: end;
		min-height: 0;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 80%, transparent);
	}

	.bar-column {
		display: flex;
		align-items: flex-end;
		justify-content: center;
		height: 100%;
		min-width: 0;
	}

	.bar {
		display: block;
		width: var(--finger-usage-bar-width);
		height: var(--bar-height);
		min-height: 1px;
		margin: 0;
		padding: 0;
		background: color-mix(in srgb, var(--finger-usage-bar-color) 65%, transparent);
		border: 1px solid color-mix(in srgb, var(--finger-usage-bar-color) 82%, var(--border));
		border-bottom: 0;
		border-radius: 2px 2px 0 0;
		cursor: help;
		outline: none;
		appearance: none;
		-webkit-appearance: none;
	}

	.bar:focus-visible {
		box-shadow:
			0 0 0 2px var(--bg-secondary),
			0 0 0 4px var(--finger-usage-bar-color);
	}

	.hand-label-row {
		text-align: center;
		color: var(--text-caption);
	}

	.hand-totals {
		display: grid;
		grid-template-columns: repeat(2, var(--finger-usage-hand-width));
		justify-content: center;
		gap: var(--finger-usage-hand-gap);
		color: var(--stats-fg);
		font-weight: 600;
		text-align: center;
	}

	.hand-total-left {
		text-align: left;
	}

	.hand-total-right {
		text-align: right;
	}
</style>
