<script lang="ts">
	import {
		buildBotStatsDiffBlockLines,
		buildCyanophageStatsDiffBlockLines,
		buildMana2StatsDiffBlockLines,
		CYANOPHAGE_ANALYZER,
		decodeCyanophageStats,
		decodeMana2Stats,
		decodeMonkeyracerStats,
		deriveBotStats,
		deriveCyanophageStats,
		deriveMana2Stats,
		MANA2_ANALYZER,
		type StatsAnalyzer,
		type StatsBlockSegment
	} from '$lib/layoutStats';
	import type {
		CompactCyanophageStats,
		CompactLayoutStats,
		CompactMana2Stats
	} from '$lib/layout';

	interface Props {
		newCompact?: CompactLayoutStats | CompactCyanophageStats | CompactMana2Stats;
		oldCompact?: CompactLayoutStats | CompactCyanophageStats | CompactMana2Stats;
		analyzer: StatsAnalyzer;
		statsLoading?: boolean;
	}

	let { newCompact, oldCompact, analyzer, statsLoading = false }: Props = $props();

	const diffLines = $derived.by((): StatsBlockSegment[][] | null => {
		if (!newCompact || !oldCompact) return null;

		if (analyzer === CYANOPHAGE_ANALYZER) {
			const newer = decodeCyanophageStats(newCompact as CompactCyanophageStats);
			const older = decodeCyanophageStats(oldCompact as CompactCyanophageStats);
			if (!newer || !older) return null;
			return buildCyanophageStatsDiffBlockLines(
				deriveCyanophageStats(newer),
				deriveCyanophageStats(older)
			);
		}

		if (analyzer === MANA2_ANALYZER) {
			const newer = decodeMana2Stats(newCompact as CompactMana2Stats);
			const older = decodeMana2Stats(oldCompact as CompactMana2Stats);
			if (!newer || !older) return null;
			return buildMana2StatsDiffBlockLines(deriveMana2Stats(newer), deriveMana2Stats(older));
		}

		const newer = decodeMonkeyracerStats(newCompact as CompactLayoutStats);
		const older = decodeMonkeyracerStats(oldCompact as CompactLayoutStats);
		if (!newer || !older) return null;
		return buildBotStatsDiffBlockLines(deriveBotStats(newer), deriveBotStats(older));
	});

	const mana2Stats = $derived(analyzer === MANA2_ANALYZER);
</script>

{#if diffLines}
	<div class="stats-block" class:stats-block--mana2={mana2Stats}>
		{#each diffLines as line, lineIndex (lineIndex)}
			<div class="stats-block-line">
				{#each line as segment, segmentIndex (segmentIndex)}
					<span
						class:stats-diff-better={segment.tone === 'better'}
						class:stats-diff-worse={segment.tone === 'worse'}
					>{segment.text}</span
					>
				{/each}
			</div>
		{/each}
	</div>
{:else}
	<pre
		class="stats-block stats-block--unavailable"
		class:stats-block--mana2={mana2Stats}
	>{statsLoading ? 'LOADING STATS\n…' : 'STATS UNAVAILABLE\ncannot compare this pair'}</pre>
{/if}
