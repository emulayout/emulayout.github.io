<script lang="ts">
	import { CYANOPHAGE_UNSUPPORTED_LABEL } from '$lib/cyanophage';
	import {
		CYANOPHAGE_ANALYZER,
		DEFAULT_STATS_ANALYZER,
		formatCyanophageStatValue,
		formatStatPercent,
		MANA2_ANALYZER,
		type DerivedBotStats,
		type DerivedCyanophageStats,
		type DerivedMana2Stats,
		type StatsAnalyzer
	} from '$lib/layoutStats';

	interface Props {
		analyzer: StatsAnalyzer;
		label: string;
		stats: DerivedBotStats | DerivedCyanophageStats | DerivedMana2Stats | null;
		loading?: boolean;
		/** When cyanophage stats are missing because the layout is incompatible. */
		cyanophageUnsupported?: boolean;
	}

	const {
		analyzer,
		label,
		stats,
		loading = false,
		cyanophageUnsupported = false
	}: Props = $props();

	const toneClass = $derived(
		analyzer === CYANOPHAGE_ANALYZER
			? 'expand-unique--cyanophage'
			: analyzer === MANA2_ANALYZER
				? 'expand-unique--mana2'
				: 'expand-unique--cmini'
	);

	type Row = { label: string; value: string };

	function pct(value: number): string {
		return formatStatPercent(value);
	}

	function pair(a: number, b: number): string {
		return `${pct(a)} | ${pct(b)}`;
	}

	function mana2Raw(value: number): string {
		return value.toFixed(3);
	}

	const rows = $derived.by((): Row[] => {
		if (!stats) return [];

		if (analyzer === DEFAULT_STATS_ANALYZER) {
			const s = stats as DerivedBotStats;
			return [
				{ label: 'Roll in / out', value: pair(s.rollIn, s.rollOut) },
				{ label: 'One-hand', value: pct(s.one) },
				{ label: 'One-hand in / out', value: pair(s.oneIn, s.oneOut) },
				{ label: 'Roll total', value: pct(s.rtl) },
				{ label: 'Roll total in / out', value: pair(s.rtlIn, s.rtlOut) },
				{ label: 'Bad redirect', value: pct(s.badRedirect) },
				{ label: 'SFS redirect / alt', value: pair(s.dsfbRed, s.dsfbAlt) }
			];
		}

		if (analyzer === CYANOPHAGE_ANALYZER) {
			const s = stats as DerivedCyanophageStats;
			return [
				{ label: 'Total word effort', value: formatCyanophageStatValue(s.totalWordEffort) },
				{ label: 'Effort', value: formatCyanophageStatValue(s.effort) }
			];
		}

		const s = stats as DerivedMana2Stats;
		return [
			{ label: 'Same key bigram / skip', value: pair(s.skb, s.sks) },
			{ label: 'Stretch skip', value: mana2Raw(s.lss) },
			{ label: 'Scissor skip', value: mana2Raw(s.vss) },
			{ label: 'Alt (no thumbs)', value: pct(s.altNoThumbs) },
			{ label: 'Alt & SFS', value: pct(s.altSfs) },
			{ label: 'Redirect (no thumbs)', value: pct(s.redirectNoThumbs) },
			{
				label: 'Redirect SFS / weak / both',
				value: `${pct(s.redirectSfs)} | ${pct(s.redirectWeak)} | ${pct(s.redirectSfsWeak)}`
			},
			{ label: 'Roll (no thumbs)', value: pct(s.rollNoThumbs) },
			{
				label: 'Roll in2 / out2',
				value: pair(s.inroll2, s.outroll2)
			},
			{
				label: 'Roll in3 / out3',
				value: pair(s.inroll3, s.outroll3)
			},
			{ label: 'Good roll', value: pct(s.goodroll) },
			{ label: 'Off-pinky', value: pct(s.offpinky) }
		];
	});

	const statusText = $derived.by(() => {
		if (loading) return 'Loading…';
		if (stats) return null;
		if (analyzer === CYANOPHAGE_ANALYZER && cyanophageUnsupported) {
			return CYANOPHAGE_UNSUPPORTED_LABEL;
		}
		return 'Stats unavailable';
	});
</script>

<section class="expand-unique {toneClass}">
	<h3 class="expand-unique-title">{label}</h3>
	<p class="expand-unique-note">Analyzer-specific metrics</p>

	{#if statusText}
		<p class="expand-unique-status">{statusText}</p>
	{:else}
		<dl class="expand-unique-list">
			{#each rows as row (row.label)}
				<div class="expand-unique-row">
					<dt>{row.label}</dt>
					<dd>{row.value}</dd>
				</div>
			{/each}
		</dl>
	{/if}
</section>

<style>
	.expand-unique {
		min-width: 0;
		padding: 0.75rem;
		border-radius: 0.75rem;
		border: 1px solid var(--border);
		background-color: var(--bg-secondary);
	}

	.expand-unique-title {
		margin: 0;
		font-size: 0.8125rem;
		font-weight: 600;
		line-height: 1.2rem;
		color: var(--expand-unique-accent, var(--text-primary));
	}

	.expand-unique-note {
		margin: 0.15rem 0 0.65rem;
		font-size: 0.6875rem;
		line-height: 1rem;
		color: var(--text-secondary);
	}

	.expand-unique-status {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.2rem;
		color: var(--text-caption);
	}

	.expand-unique-list {
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.expand-unique-row {
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
		gap: 0.5rem;
		align-items: baseline;
	}

	.expand-unique-row dt {
		margin: 0;
		font-size: 0.6875rem;
		line-height: 1.1rem;
		color: var(--text-secondary);
	}

	.expand-unique-row dd {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 0.6875rem;
		line-height: 1.1rem;
		font-variant-numeric: tabular-nums;
		text-align: right;
		color: var(--text-primary);
		overflow-wrap: anywhere;
	}

	.expand-unique--cmini {
		--expand-unique-accent: var(--analyzer-cmini);
	}

	.expand-unique--cyanophage {
		--expand-unique-accent: var(--analyzer-cyanophage);
	}

	.expand-unique--mana2 {
		--expand-unique-accent: var(--analyzer-mana2);
	}
</style>
